"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chatJson, resolveProvider, ProviderError } from "@/lib/ai/provider";
import { candidatesFor, type PlannerMember, type SlotKey } from "@/lib/planner";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO, istHour } from "@/lib/date";

export type IntakeActionState = { error: string | null; ok: string | null };

const todayISO = () => istDateISO();

/** Craving/exra snack: logs it, then re-fits remaining planned slots to the leftover budget. */
export async function cravingAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const profile = await requireFullProfile();
  const parsed = z
    .object({
      description: z.string().trim().min(2, "What did you crave?").max(120),
      kcal: z.coerce.number().min(10).max(3000),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid craving", ok: null };
  const { description, kcal } = parsed.data;

  const supabase = await createClient();
  const today = todayISO();

  await supabase.from("intake_logs").insert({
    member_id: profile.id,
    logged_on: today,
    slot: "snack",
    description: `${description} (craving)`,
    kcal,
    protein_g: 0,
    carbs_g: 0,
    fat_g: 0,
    source: "manual",
  });

  // Remaining budget = target − everything consumed today (incl. the craving).
  const { data: logs } = await supabase
    .from("intake_logs")
    .select("kcal")
    .eq("member_id", profile.id)
    .eq("logged_on", today);
  const consumed = (logs ?? []).reduce((s, l) => s + Number(l.kcal), 0);
  const targets = profile.targets_cache?.targets;
  const remaining = targets ? targets.kcal - consumed : null;
  const t = targets as { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number } | undefined;

  // Re-fit the remaining planned personal slots of today.
  let swaps = 0;
  if (remaining != null && remaining > 0 && t) {
    const { data: plan } = await supabase
      .from("weekly_plans")
      .select("id")
      .eq("household_id", profile.household_id!)
      .lte("week_start", today)
      .gte("week_start", new Date(Date.parse(today) - 6 * 86400000).toISOString().slice(0, 10))
      .maybeSingle();
    if (plan) {
      const { data: remainingEntries } = await supabase
        .from("plan_entries")
        .select("id, slot, recipe_id")
        .eq("plan_id", plan.id)
        .eq("entry_date", today)
        .eq("member_id", profile.id);
      const { data: recipes } = await supabase
        .from("recipes")
        .select("id, title, is_veg, servings, prep_minutes, recipe_nutrition(kcal, protein_g, fiber_g), recipe_items(ingredients(name))");

      const plannerRecipes = (recipes ?? [])
        .filter((r) => r.recipe_nutrition?.[0])
        .map((r) => ({
          id: r.id,
          title: r.title,
          isVeg: r.is_veg,
          servings: r.servings,
          prepMinutes: r.prep_minutes,
          kcal: Number(r.recipe_nutrition[0].kcal),
          proteinG: Number(r.recipe_nutrition[0].protein_g),
          fiberG: Number(r.recipe_nutrition[0].fiber_g ?? 0),
          ingredientNames: (r.recipe_items ?? []).map((i: { ingredients: { name: string }[] | null }) => (i.ingredients?.[0]?.name ?? "")),
          ingredientIds: [],
        }));

      const plannerMember: PlannerMember = {
        id: profile.id,
        name: profile.display_name,
        diet: profile.diet_type,
        allergies: profile.allergies ?? [],
        targets: {
          kcal: remaining,
          proteinG: t.proteinG,
          carbsG: t.carbsG,
          fatG: t.fatG,
          fiberG: t.fiberG,
        },
      };

      for (const entry of remainingEntries ?? []) {
        const planned = plannerRecipes.find((r) => r.id === entry.recipe_id);
        if (!planned) continue;
        const slot = entry.slot as SlotKey;
        const slotsLeft = Math.max(1, (remainingEntries ?? []).length);
        const budget = remaining / slotsLeft;
        if (planned.kcal <= budget * 1.15) continue; // planned dish still fits
        const pick = candidatesFor(plannerRecipes, plannerMember, slot, new Set(), 1)[0];
        if (pick && pick.recipe.id !== entry.recipe_id) {
          await supabase.from("plan_entries").update({ recipe_id: pick.recipe.id }).eq("id", entry.id);
          await supabase.from("adjustment_events").insert({
            member_id: profile.id,
            event_date: today,
            trigger: "craving",
            consumed: { description, kcal },
            reoptimization: {
              slot,
              from: planned.title,
              to: pick.recipe.title,
              budgetPerSlot: Math.round(budget),
            },
          });
          swaps++;
        }
      }
    }
  }

  revalidatePath("/");
  revalidatePath("/week");
  return {
    error: null,
    ok:
      remaining != null && remaining <= 0
        ? `Logged ${description} (${kcal} kcal) — day budget is spent, consider a lighter dinner.`
        : `Logged ${description} (${kcal} kcal).${swaps > 0 ? ` Re-fitted ${swaps} remaining meal${swaps > 1 ? "s" : ""} to your leftover budget.` : " Remaining meals still fit."}`,
  };
}

const aiParseSchema = z.object({
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        kcal: z.coerce.number().min(0).max(3000),
        proteinG: z.coerce.number().min(0).max(300),
        carbsG: z.coerce.number().min(0).max(500),
        fatG: z.coerce.number().min(0).max(300),
      }),
    )
    .min(1)
    .max(15),
});

const AI_LOG_SYSTEM = `You extract everything a person ATE from a short message (Hinglish, English, or food names with counts).
Respond with ONLY JSON: {"items": [{"name": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number}]}.
Estimate nutrition for typical Indian home portions. One entry per distinct food item, name kept short.`;

/** Freeform AI meal logging: "2 roti and dal, plus a mango" → intake rows. */
export async function aiLogIntakeAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const profile = await requireFullProfile();
  const text = z.string().trim().min(2, "Tell me what you ate").max(500).safeParse(formData.get("text"));
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Invalid input", ok: null };

  const provider = await resolveProvider();
  if (!provider) return { error: "No AI provider configured — add one in Settings → AI Providers, or use the craving form to log the calories manually.", ok: null };
  if (!checkRate(`ailog:${profile.id}`, 30, 60 * 60 * 1000)) return { error: rateLimited(30, 60 * 60 * 1000), ok: null };

  let items: z.infer<typeof aiParseSchema>["items"];
  try {
    const parsed = await chatJson(
      provider,
      aiParseSchema,
      [
        { role: "system", content: AI_LOG_SYSTEM },
        { role: "user", content: text.data },
      ],
      { maxTokens: 900, temperature: 0.2, feature: "meal_log" },
    );
    items = parsed.items;
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Could not parse that — try again.", ok: null };
  }

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (totalKcal > 8000) {
    return { error: "That adds up to over 8,000 kcal — double-check the message and try again.", ok: null };
  }

  const supabase = await createClient();
  const hour = istHour();
  const slot = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner";
  const today = todayISO();

  await supabase.from("intake_logs").insert(
    items.map((i) => ({
      member_id: profile.id,
      logged_on: today,
      slot,
      description: i.name,
      kcal: i.kcal,
      protein_g: i.proteinG,
      carbs_g: i.carbsG,
      fat_g: i.fatG,
      source: "ai_chat",
    })),
  );

  revalidatePath("/");
  const loggedKcal = items.reduce((s, i) => s + i.kcal, 0);
  return { error: null, ok: `Logged ${items.length} item${items.length > 1 ? "s" : ""} (~${Math.round(loggedKcal)} kcal) from your message.` };
}

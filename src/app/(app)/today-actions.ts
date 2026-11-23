"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chatJson, resolveProvider, ProviderError } from "@/lib/ai/provider";
import { candidatesFor, type PlannerMember, type SlotKey } from "@/lib/planner";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO, istHour } from "@/lib/date";
import {
  MEAL_PARSE_SYSTEM,
  intakeDescription,
  mealParseItemSchema,
  mealParseSchema,
  type MealParseItem,
} from "@/lib/ai/meal-parse";
import type { MealSlot } from "@/lib/db-types";

export interface AiLogDraft {
  items: MealParseItem[];
  slot: MealSlot;
  date: string;
}

export type IntakeActionState = {
  error: string | null;
  ok: string | null;
  /** Parsed AI meal waiting for explicit confirmation. */
  draft?: AiLogDraft | null;
};

const todayISO = () => istDateISO();

/** Re-validated server-side when the confirmation card posts it back. */
const aiLogDraftSchema = z.object({
  items: z.array(mealParseItemSchema).min(1).max(15),
  slot: z.enum(["breakfast", "lunch", "snack", "dinner"]),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => d <= todayISO(), "Cannot log a future day"),
});

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

/**
 * Freeform AI meal logging: "2 roti and dal, plus a mango" → a parsed draft.
 * Nothing is written here; the UI shows the items and only a second,
 * explicitly confirmed request writes the intake rows.
 */
export async function aiLogIntakeAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const profile = await requireFullProfile();
  const mode = formData.get("mode");

  if (mode === "cancel") return { error: null, ok: null, draft: null };
  if (mode === "confirm") return confirmAiLog(profile.id, formData);

  const text = z.string().trim().min(2, "Tell me what you ate").max(500).safeParse(formData.get("text"));
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Invalid input", ok: null };

  const provider = await resolveProvider();
  if (!provider) return { error: "No AI provider configured — add one in Settings → AI Providers, or use the craving form to log the calories manually.", ok: null };
  if (!checkRate(`ailog:${profile.id}`, 30, 60 * 60 * 1000)) return { error: rateLimited(30, 60 * 60 * 1000), ok: null };

  let items: MealParseItem[];
  try {
    const parsed = await chatJson(
      provider,
      mealParseSchema,
      [
        { role: "system", content: MEAL_PARSE_SYSTEM },
        { role: "user", content: text.data },
      ],
      // Reasoning models burn part of the budget before writing JSON, so this
      // needs generous headroom — 900 produced empty completions.
      { maxTokens: 2500, temperature: 0.2, feature: "meal_log" },
    );
    items = parsed.items;
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Could not parse that — try again.", ok: null };
  }

  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (totalKcal > 8000) {
    return { error: "That adds up to over 8,000 kcal — double-check the message and try again.", ok: null };
  }

  const hour = istHour();
  const slot: MealSlot = hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner";

  return {
    error: null,
    ok: null,
    draft: { items, slot, date: todayISO() },
  };
}

/**
 * Second step of the AI meal log: the confirmation card posts the draft back,
 * the server re-validates it against the same zod schema, and only then are
 * the intake rows written. The model never gets a direct write path.
 */
async function confirmAiLog(memberId: string, formData: FormData): Promise<IntakeActionState> {
  const raw = formData.get("draft");
  if (typeof raw !== "string") {
    return { error: "That draft expired — parse the message again.", ok: null, draft: null };
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "That draft expired — parse the message again.", ok: null, draft: null };
  }

  const parsed = aiLogDraftSchema.safeParse(json);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "That draft expired — parse the message again.",
      ok: null,
      draft: null,
    };
  }

  const { items, slot, date } = parsed.data;
  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (totalKcal > 8000) {
    return { error: "That adds up to over 8,000 kcal — double-check the message and try again.", ok: null, draft: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("intake_logs").insert(
    items.map((i) => ({
      member_id: memberId,
      logged_on: date,
      slot,
      description: intakeDescription(i),
      kcal: i.kcal,
      protein_g: i.proteinG,
      carbs_g: i.carbsG,
      fat_g: i.fatG,
      fiber_g: i.fiberG ?? null,
      source: "ai_chat",
    })),
  );
  if (error) return { error: error.message, ok: null, draft: { items, slot, date } };

  revalidatePath("/");
  return {
    error: null,
    ok: `Logged ${items.length} item${items.length > 1 ? "s" : ""} (~${Math.round(totalKcal)} kcal) to ${slot}.`,
    draft: null,
  };
}

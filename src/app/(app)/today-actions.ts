"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { chatJson, resolveProvider, ProviderError } from "@/lib/ai/provider";
import { candidatesFor, type PlannerMember, type SlotKey } from "@/lib/planner";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO, istHour, isDiaryDateISO, parseDateHint } from "@/lib/date";
import {
  MEAL_COMMAND_SYSTEM,
  intakeDescription,
  mealCommandSchema,
  mealParseItemSchema,
  type MealCommand,
  type MealMoveCommand,
  type MealParseItem,
} from "@/lib/ai/meal-parse";
import type { MealSlot } from "@/lib/db-types";
import { findIntakeMatch, type IntakeMatchRow } from "@/lib/intake-match";

export type AiLogDraft =
  | { kind: "log"; items: MealParseItem[]; slot: MealSlot; date: string }
  | {
      kind: "move";
      rowId: string;
      description: string;
      fromSlot: MealSlot;
      toSlot: MealSlot;
      /** Day the item is currently logged on. */
      date: string;
      /** Day to move it to. */
      toDate: string;
    };

export type IntakeActionState = {
  error: string | null;
  ok: string | null;
  /** Parsed AI command waiting for explicit confirmation. */
  draft?: AiLogDraft | null;
};

const todayISO = () => istDateISO();
const SLOT_VALUES = ["breakfast", "lunch", "snack", "dinner"] as const;

/** Re-validated server-side when the confirmation card posts it back. */
const aiLogDraftSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("log"),
    items: z.array(mealParseItemSchema).min(1).max(15),
    slot: z.enum(SLOT_VALUES),
    date: z.string().refine(isDiaryDateISO, "Use a valid calendar date"),
  }),
  z.object({
    kind: z.literal("move"),
    rowId: z.string().uuid(),
    description: z.string().min(1).max(120),
    fromSlot: z.enum(SLOT_VALUES),
    toSlot: z.enum(SLOT_VALUES),
    date: z.string().refine(isDiaryDateISO, "Use a valid calendar date"),
    toDate: z.string().refine(isDiaryDateISO, "Use a valid calendar date"),
  }),
]);

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

function slotForNow(): MealSlot {
  const hour = istHour();
  return hour < 11 ? "breakfast" : hour < 16 ? "lunch" : hour < 19 ? "snack" : "dinner";
}

function slotLabel(slot: string): string {
  return slot.charAt(0).toUpperCase() + slot.slice(1);
}

/**
 * Resolve a move command against today's actual diary rows. The model names
 * the food; the server decides which row that is, so the model never gets to
 * choose an arbitrary row id.
 */
async function resolveMove(
  memberId: string,
  command: MealMoveCommand,
  date: string,
): Promise<{ draft: Extract<AiLogDraft, { kind: "move" }> } | { error: string }> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("intake_logs")
    .select("id, slot, description, kcal")
    .eq("member_id", memberId)
    .eq("logged_on", date)
    .order("created_at");
  const rows = (data ?? []) as IntakeMatchRow[];
  const matching = findIntakeMatch(rows, command.item, command.fromSlot);
  const dayLabel = date === todayISO() ? "today's" : `${date}'s`;

  if (!matching) {
    return {
      error: `I couldn't find “${command.item}” in ${dayLabel} ${command.fromSlot ?? "diary"}. Check the item's name in the diary and try again.`,
    };
  }
  if ("ambiguous" in matching) {
    return {
      error: `“${command.item}” matches more than one item: ${matching.ambiguous
        .map((r) => r.description ?? "unnamed")
        .join("; ")}. Be more specific or use the pencil on the diary row.`,
    };
  }

  const row = matching.row;
  if (!SLOT_VALUES.includes(row.slot as (typeof SLOT_VALUES)[number])) {
    return { error: "That item has an unknown meal slot — edit it from the diary." };
  }
  const targetSlot = command.toSlot ?? (row.slot as MealSlot);
  if (!SLOT_VALUES.includes(targetSlot)) {
    return { error: "That target meal is not valid." };
  }

  return {
    draft: {
      kind: "move",
      rowId: row.id,
      description: row.description ?? command.item,
      fromSlot: row.slot as MealSlot,
      toSlot: targetSlot,
      date,
      toDate: date,
    },
  };
}

/**
 * Freeform AI meal command: "2 roti and dal" or "move the soya tikki to
 * breakfast". Parsing never writes; the UI shows a confirmation card and a
 * second request applies the log or the move.
 */
export async function aiLogIntakeAction(
  _prev: IntakeActionState,
  formData: FormData,
): Promise<IntakeActionState> {
  const profile = await requireFullProfile();
  const mode = formData.get("mode");

  if (mode === "cancel") return { error: null, ok: null, draft: null };
  if (mode === "confirm") return confirmAiLog(profile.id, formData);

  const requestedDate = z
    .string()
    .refine(isDiaryDateISO, "Use a valid calendar date")
    .safeParse(formData.get("date"));
  const date = requestedDate.success ? requestedDate.data : todayISO();

  const text = z.string().trim().min(2, "Tell me what you ate").max(500).safeParse(formData.get("text"));
  if (!text.success) return { error: text.error.issues[0]?.message ?? "Invalid input", ok: null };

  const provider = await resolveProvider();
  if (!provider) return { error: "No AI provider configured — add one in Settings → AI Providers, or use the craving form to log the calories manually.", ok: null };
  if (!checkRate(`ailog:${profile.id}`, 30, 60 * 60 * 1000)) return { error: rateLimited(30, 60 * 60 * 1000), ok: null };

  let command: MealCommand;
  try {
    command = await chatJson(
      provider,
      mealCommandSchema,
      [
        { role: "system", content: MEAL_COMMAND_SYSTEM },
        { role: "user", content: text.data },
      ],
      // Reasoning models burn part of the budget before writing JSON, so this
      // needs generous headroom — 900 produced empty completions.
      { maxTokens: 2500, temperature: 0.2, feature: "meal_log" },
    );
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Could not parse that — try again.", ok: null };
  }

  if (command.action === "unsupported") {
    return { error: command.reason, ok: null, draft: null };
  }

  if (command.action === "move") {
    const resolved = await resolveMove(profile.id, command, date);
    if ("error" in resolved) return { error: resolved.error, ok: null, draft: null };
    return { error: null, ok: null, draft: resolved.draft };
  }

  const items = command.items;
  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (totalKcal > 8000) {
    return { error: "That adds up to over 8,000 kcal — double-check the message and try again.", ok: null };
  }

  return {
    error: null,
    ok: null,
    draft: {
      kind: "log",
      items,
      slot: command.slot ?? slotForNow(),
      // A day named inside the message ("log yesterday's dinner") wins over
      // the picker; the review card shows it before anything is written.
      date: parseDateHint(text.data, todayISO()) ?? date,
    },
  };
}

/**
 * Second step: the confirmation card posts the draft back, the server
 * re-validates it against the same zod schema, and only then is the diary
 * written. The model never gets a direct write path.
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
  const draft = parsed.data;
  const supabase = await createClient();

  if (draft.kind === "move") {
    const { data: row } = await supabase
      .from("intake_logs")
      .select("id, description, slot, logged_on")
      .eq("id", draft.rowId)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!row) {
      return { error: "That item is no longer in your diary — refresh and try again.", ok: null, draft: null };
    }
    if (row.slot === draft.toSlot && row.logged_on === draft.toDate) {
      return {
        error: null,
        ok: `It's already in ${slotLabel(draft.toSlot)} on ${draft.toDate}.`,
        draft: null,
      };
    }

    const { error } = await supabase
      .from("intake_logs")
      .update({ slot: draft.toSlot, logged_on: draft.toDate })
      .eq("id", draft.rowId)
      .eq("member_id", memberId);
    if (error) return { error: error.message, ok: null, draft };

    revalidatePath("/");
    const when = (date: string) => (date === todayISO() ? "today" : date);
    return {
      error: null,
      ok: `Moved “${row.description ?? draft.description}” from ${when(row.logged_on)} ${slotLabel(row.slot)} to ${when(draft.toDate)} ${slotLabel(draft.toSlot)}.`,
      draft: null,
    };
  }

  const { items, slot, date } = draft;
  const totalKcal = items.reduce((s, i) => s + i.kcal, 0);
  if (totalKcal > 8000) {
    return { error: "That adds up to over 8,000 kcal — double-check the message and try again.", ok: null, draft };
  }

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
  if (error) return { error: error.message, ok: null, draft };

  revalidatePath("/");
  const when = date === todayISO() ? "" : ` on ${date}`;
  return {
    error: null,
    ok: `Logged ${items.length} item${items.length > 1 ? "s" : ""} (~${Math.round(totalKcal)} kcal) to ${slotLabel(slot)}${when}.`,
    draft: null,
  };
}

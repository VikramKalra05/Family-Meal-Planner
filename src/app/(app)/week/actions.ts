"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { generateWeek, portionFor, type PlannerMember, type SlotKey } from "@/lib/planner";
import { loadPlanData, loadPantry } from "@/lib/plan-data";
import { buildShoppingList, aggregateIngredients, mondayOf } from "@/lib/planner";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";

/**
 * Creates (or force-regenerates) the household's plan for a week and stores
 * the generated entries. Deterministic — same inputs, same plan.
 */
export async function generateWeekAction(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const weekStart = mondayOf(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(formData.get("weekStart")));
  const supabase = await createClient();

  const { plannerRecipes, members } = await loadPlanData();
  const entries = generateWeek({ recipes: plannerRecipes, members, weekStart });

  const { data: plan } = await supabase
    .from("weekly_plans")
    .upsert(
      { household_id: profile.household_id!, week_start: weekStart, status: "active" },
      { onConflict: "household_id,week_start" },
    )
    .select("id")
    .single();
  if (!plan) return;

  await supabase.from("plan_entries").delete().eq("plan_id", plan.id);
  if (entries.length > 0) {
    await supabase.from("plan_entries").insert(
      entries.map((e) => ({
        plan_id: plan.id,
        entry_date: e.date,
        slot: e.slot,
        recipe_id: e.recipeId,
        member_id: e.memberId,
        servings_base: e.servingsBase,
        member_portions: e.memberPortions,
        status: "planned",
      })),
    );
  }

  revalidatePath("/week");
  revalidatePath("/shopping");
}

const entryId = z.string().uuid();

export async function swapEntryAction(formData: FormData): Promise<void> {
  await requireFullProfile();
  const e = z
    .object({ entryId: entryId, recipeId: entryId })
    .safeParse(Object.fromEntries(formData));
  if (!e.success) return;

  const supabase = await createClient();
  // RLS scopes the entry to the household's plans; this check also confirms
  // the replacement recipe is actually readable by this household (otherwise
  // a foreign recipe UUID could be referenced into the plan).
  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, recipe_nutrition(kcal)")
    .eq("id", e.data.recipeId)
    .maybeSingle();
  if (!recipe) return;

  // Re-portion the replacement for the eater so the slot target still holds.
  const { data: entry } = await supabase
    .from("plan_entries")
    .select("member_id, slot")
    .eq("id", e.data.entryId)
    .maybeSingle();
  const nut = recipe.recipe_nutrition as unknown as { kcal: number }[] | null;
  const kcal = nut?.[0] ? Number(nut[0].kcal) : null;

  let memberPortions: Record<string, number> = {};
  if (entry?.member_id && kcal) {
    const { data: mp } = await supabase
      .from("profiles")
      .select("display_name, diet_type, allergies, targets_cache")
      .eq("id", entry.member_id)
      .maybeSingle();
    if (mp?.targets_cache) {
      const member: PlannerMember = {
        id: entry.member_id,
        name: mp.display_name,
        diet: mp.diet_type,
        allergies: mp.allergies ?? [],
        targets: mp.targets_cache.targets,
      };
      const portion = portionFor(
        { id: recipe.id, title: "", isVeg: true, servings: 1, prepMinutes: null, kcal, proteinG: 0, fiberG: 0, ingredientNames: [], ingredientIds: [] },
        member,
        entry.slot as SlotKey,
      );
      memberPortions = { [entry.member_id]: portion };
      await supabase
        .from("plan_entries")
        .update({ recipe_id: e.data.recipeId, servings_base: portion, member_portions: memberPortions })
        .eq("id", e.data.entryId);
      revalidatePath("/week");
      redirect("/week");
    }
  }

  await supabase.from("plan_entries").update({ recipe_id: e.data.recipeId }).eq("id", e.data.entryId);
  revalidatePath("/week");
  redirect("/week");
}

export async function removeEntryAction(formData: FormData): Promise<void> {
  await requireFullProfile();
  const id = entryId.safeParse(formData.get("entryId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("plan_entries").delete().eq("id", id.data);
  revalidatePath("/week");
}

export async function setEntryStatusAction(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const parsed = z
    .object({ entryId: entryId, status: z.enum(["planned", "cooked", "eaten", "skipped"]) })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("plan_entries").update({ status: parsed.data.status }).eq("id", parsed.data.entryId);

  // Eating a planned dish writes an intake log — actuals vs targets stay true.
  if (parsed.data.status === "eaten") {
    const { data: entry } = await supabase
      .from("plan_entries")
      .select("entry_date, slot, recipe_id, servings_base, member_portions")
      .eq("id", parsed.data.entryId)
      .maybeSingle();
    const { data: nut } = await supabase
      .from("recipe_nutrition")
      .select("kcal, protein_g, carbs_g, fat_g, fiber_g")
      .eq("recipe_id", entry!.recipe_id)
      .maybeSingle();
    if (entry && nut) {
      // The eater eats THEIR portion, not the whole batch: shared dinners are
      // per-member scaled, so read the multiplier from member_portions.
      const portions = (entry.member_portions ?? {}) as Record<string, number>;
      const factor = portions[profile.id] ?? Number(entry.servings_base);
      await supabase.from("intake_logs").insert({
        member_id: profile.id,
        logged_on: entry.entry_date,
        slot: entry.slot,
        recipe_id: entry.recipe_id,
        description: "from plan",
        kcal: Number(nut.kcal) * factor,
        protein_g: Number(nut.protein_g) * factor,
        carbs_g: Number(nut.carbs_g) * factor,
        fat_g: Number(nut.fat_g) * factor,
        fiber_g: nut.fiber_g == null ? null : Number(nut.fiber_g) * factor,
        source: "plan",
      });
    }
  }
  revalidatePath("/week");
  revalidatePath("/");
}

/** Aggregates the week's plan − pantry into the household shopping list. */
export async function buildShoppingListAction(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const weekStart = mondayOf(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(formData.get("weekStart")));
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("weekly_plans")
    .select("id")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!plan) return;

  const { data: entries } = await supabase
    .from("plan_entries")
    .select("id, entry_date, slot, member_id, recipe_id, servings_base, status, member_portions")
    .eq("plan_id", plan.id);
  if (!entries || entries.length === 0) return;

  const { itemsByRecipe } = await loadPlanData();
  const plannedEntries = entries.map((e) => ({
    date: e.entry_date,
    slot: e.slot as "breakfast" | "lunch" | "snack" | "dinner",
    memberId: e.member_id,
    recipeId: e.recipe_id,
    servingsBase: Number(e.servings_base),
    memberPortions: (e.member_portions ?? {}) as Record<string, number>,
  }));
  const agg = aggregateIngredients(plannedEntries, itemsByRecipe);
  const pantry = await loadPantry();
  const items = buildShoppingList(agg, pantry);

  await supabase.from("shopping_lists").upsert(
    {
      household_id: profile.household_id!,
      week_start: weekStart,
      items,
      status: "open",
    },
    { onConflict: "household_id,week_start" },
  );

  revalidatePath("/shopping");
}

export async function toggleShoppingItemAction(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const weekStart = mondayOf(z.string().regex(/^\d{4}-\d{2}-\d{2}$/).parse(formData.get("weekStart")));
  const index = z.coerce.number().int().min(0).safeParse(formData.get("index"));
  if (!index.success) return;

  const supabase = await createClient();
  const { data: list } = await supabase
    .from("shopping_lists")
    .select("id, items")
    .eq("household_id", profile.household_id!)
    .eq("week_start", weekStart)
    .maybeSingle();
  if (!list) return;

  const items = (list.items as { name: string; display: string; checked: boolean }[]) ?? [];
  if (!items[index.data]) return;
  items[index.data].checked = !items[index.data].checked;

  await supabase.from("shopping_lists").update({ items }).eq("id", list.id);
  revalidatePath("/shopping");
}

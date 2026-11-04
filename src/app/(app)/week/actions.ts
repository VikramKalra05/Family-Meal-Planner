"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  aggregateIngredients,
  buildShoppingList,
  generateWeek,
  isRecipeSafeFor,
  mondayOf,
  portionFor,
  sharedDiet,
  type PlannerMember,
  type PlannerRecipe,
  type SlotKey,
} from "@/lib/planner";
import { loadPlanData, loadPantry } from "@/lib/plan-data";
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

  const { plannerRecipes, members } = await loadPlanData(profile);
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
  revalidatePath("/");
}

const entryId = z.string().uuid();

export async function swapEntryAction(formData: FormData): Promise<void> {
  const profile = await requireFullProfile();
  const e = z
    .object({ entryId: entryId, recipeId: entryId })
    .safeParse(Object.fromEntries(formData));
  if (!e.success) return;

  const supabase = await createClient();
  // RLS scopes the entry to the household's plans; this check also confirms
  // the replacement recipe is actually readable by this household (otherwise
  // a foreign recipe UUID could be referenced into the plan).
  const { data: recipeRow } = await supabase
    .from("recipes")
    .select("id, title, is_veg, servings, prep_minutes, recipe_nutrition(kcal, protein_g, fiber_g), recipe_items(ingredients(name))")
    .eq("id", e.data.recipeId)
    .maybeSingle();
  if (!recipeRow) return;

  const rawNut = recipeRow.recipe_nutrition as unknown;
  const nut = (Array.isArray(rawNut) ? rawNut[0] : rawNut) as
    | { kcal: number; protein_g: number; fiber_g: number | null }
    | null;
  if (!nut) return;

  const items = (recipeRow.recipe_items ?? []) as unknown as {
    ingredients: { name: string } | null;
  }[];
  const candidate: PlannerRecipe = {
    id: recipeRow.id,
    title: recipeRow.title,
    isVeg: recipeRow.is_veg,
    servings: recipeRow.servings,
    prepMinutes: recipeRow.prep_minutes,
    kcal: Number(nut.kcal),
    proteinG: Number(nut.protein_g),
    fiberG: nut.fiber_g == null ? 0 : Number(nut.fiber_g),
    ingredientNames: items.map((i) => i.ingredients?.name ?? "").filter(Boolean),
    ingredientIds: [],
  };

  const { data: entry } = await supabase
    .from("plan_entries")
    .select("member_id, slot")
    .eq("id", e.data.entryId)
    .maybeSingle();
  if (!entry) return;

  // Re-portion for the eater (personal) or every eater (shared dinner).
  // Without this, swapping a shared dish kept the old dish's portions and the
  // day silently drifted off target. Staff never eat from the plan.
  const { data: memberRows } = await supabase
    .from("profiles")
    .select("id, display_name, diet_type, allergies, targets_cache, role")
    .eq("household_id", profile.household_id!)
    .neq("role", "staff");

  const allMembers: PlannerMember[] = (memberRows ?? [])
    .filter((m) => m.targets_cache)
    .map((m) => ({
      id: m.id,
      name: m.display_name,
      diet: m.diet_type,
      allergies: m.allergies ?? [],
      targets: m.targets_cache!.targets,
    }));
  if (allMembers.length === 0) return;

  const slot = entry.slot as SlotKey;
  const eater = entry.member_id
    ? allMembers.find((m) => m.id === entry.member_id)
    : sharedDiet(allMembers);
  if (!eater) return;
  // Defence-in-depth: the candidate UI already filters, but never let a
  // crafted request put an allergen or non-veg dish in front of someone.
  if (!isRecipeSafeFor(candidate, eater)) return;

  const targets = entry.member_id ? allMembers.filter((m) => m.id === entry.member_id) : allMembers;
  const memberPortions: Record<string, number> = {};
  let totalPortions = 0;
  for (const member of targets) {
    const portion = portionFor(candidate, member, slot);
    memberPortions[member.id] = portion;
    totalPortions += portion;
  }
  if (totalPortions <= 0) return;

  await supabase
    .from("plan_entries")
    .update({
      recipe_id: e.data.recipeId,
      servings_base: Math.round(totalPortions * 100) / 100,
      member_portions: memberPortions,
    })
    .eq("id", e.data.entryId);

  revalidatePath("/week");
  revalidatePath("/");
  redirect("/week");
}

export async function removeEntryAction(formData: FormData): Promise<void> {
  await requireFullProfile();
  const id = entryId.safeParse(formData.get("entryId"));
  if (!id.success) return;
  const supabase = await createClient();
  await supabase.from("plan_entries").delete().eq("id", id.data);
  revalidatePath("/week");
  revalidatePath("/");
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
      .select("entry_date, slot, recipe_id, member_id, servings_base, member_portions")
      .eq("id", parsed.data.entryId)
      .maybeSingle();
    if (!entry) return;
    const { data: nut } = await supabase
      .from("recipe_nutrition")
      .select("kcal, protein_g, carbs_g, fat_g, fiber_g")
      .eq("recipe_id", entry.recipe_id)
      .maybeSingle();
    if (nut && (entry.member_id === null || entry.member_id === profile.id)) {
      // Only the eater's own entries write intake. Marking someone else's
      // personal meal as eaten must not log that dish against the caller.
      // (intake_logs RLS is self-only anyway.)
      // The eater eats THEIR portion, not the whole batch: shared dinners are
      // per-member scaled, so read the multiplier from member_portions.
      const portions = (entry.member_portions ?? {}) as Record<string, number>;
      const factor =
        portions[profile.id] ??
        (entry.member_id === profile.id ? Number(entry.servings_base) : 1);
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

  const { itemsByRecipe } = await loadPlanData(profile);
  const plannedEntries = entries.map((e) => ({
    date: e.entry_date,
    slot: e.slot as "breakfast" | "lunch" | "snack" | "dinner",
    memberId: e.member_id,
    recipeId: e.recipe_id,
    servingsBase: Number(e.servings_base),
    memberPortions: (e.member_portions ?? {}) as Record<string, number>,
  }));
  const agg = aggregateIngredients(plannedEntries, itemsByRecipe);
  const pantry = await loadPantry(profile);
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

import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/db-types";
import type { PlannerMember, PlannerRecipe, RecipeItemsInfo } from "@/lib/planner";
import type { NutrientTargets } from "@/lib/nutrition/types";

export interface PlanEntryRow {
  id: string;
  entry_date: string;
  slot: string;
  member_id: string | null;
  recipe_id: string;
  servings_base: number;
  status: string;
}

export interface PlanData {
  planId: string | null;
  entries: PlanEntryRow[];
  plannerRecipes: PlannerRecipe[];
  itemsByRecipe: Map<string, RecipeItemsInfo>;
  members: PlannerMember[];
  recipesById: Map<string, { title: string; servings: number; kcal: number | null }>;
}

/** Loads everything the week planner needs for the current household. */
export async function loadPlanData(
  profileArg?: Profile,
): Promise<Omit<PlanData, "planId" | "entries">> {
  const profile = profileArg ?? (await requireFullProfile());
  const supabase = await createClient();
  const householdId = profile.household_id!;

  const [recipesRes, membersRes] = await Promise.all([
    supabase
      .from("recipes")
      .select("id, title, is_veg, servings, prep_minutes, recipe_nutrition(kcal, protein_g, fiber_g), recipe_items(quantity_g, unit, ingredient_id, ingredients(name))")
      .order("title"),
    supabase
      .from("profiles")
      .select("id, display_name, diet_type, allergies, targets_cache, role")
      .eq("household_id", householdId),
  ]);

  const plannerRecipes: PlannerRecipe[] = [];
  const itemsByRecipe = new Map<string, RecipeItemsInfo>();
  const recipesById = new Map<string, { title: string; servings: number; kcal: number | null }>();

  for (const r of recipesRes.data ?? []) {
    const n = r.recipe_nutrition as unknown as { kcal: number; protein_g: number; fiber_g: number | null } | null;
    recipesById.set(r.id, { title: r.title, servings: r.servings, kcal: n ? Number(n.kcal) : null });
    if (!n) continue; // never plan an unrated recipe
    const items = (r.recipe_items ?? []) as unknown as {
      quantity_g: number | null;
      unit: string | null;
      ingredient_id: string | null;
      ingredients: { name: string } | null;
    }[];
    const names = items.map((i) => i.ingredients?.name ?? "").filter(Boolean);
    plannerRecipes.push({
      id: r.id,
      title: r.title,
      isVeg: r.is_veg,
      servings: r.servings,
      prepMinutes: r.prep_minutes,
      kcal: Number(n.kcal),
      proteinG: Number(n.protein_g),
      fiberG: n.fiber_g == null ? 0 : Number(n.fiber_g),
      ingredientNames: names,
      ingredientIds: items.map((i) => i.ingredient_id).filter((x): x is string => !!x),
    });
    itemsByRecipe.set(r.id, {
      recipeId: r.id,
      servings: r.servings,
      items: items.map((i) => ({
        name: i.ingredients?.name ?? "unknown",
        ingredientId: i.ingredient_id,
        grams: Number(i.quantity_g ?? 0),
        unit: i.unit ?? "g",
      })),
    });
  }

  const members: PlannerMember[] = (membersRes.data ?? [])
    .filter((m) => m.role !== "staff" && m.targets_cache)
    .map((m) => ({
      id: m.id,
      name: m.display_name,
      diet: m.diet_type,
      allergies: m.allergies ?? [],
      targets: m.targets_cache!.targets as NutrientTargets,
    }));

  return { plannerRecipes, itemsByRecipe, members, recipesById };
}

export async function loadPantry(
  profileArg?: Profile,
): Promise<{ ingredientId: string | null; name: string; quantity: number; unit: string }[]> {
  const profile = profileArg ?? (await requireFullProfile());
  const supabase = await createClient();
  const { data } = await supabase
    .from("pantry_items")
    .select("id, ingredient_id, name, quantity, unit")
    .eq("household_id", profile.household_id!);
  return (data ?? []).map((p) => ({
    ingredientId: p.ingredient_id,
    name: p.name,
    quantity: Number(p.quantity),
    unit: p.unit,
  }));
}

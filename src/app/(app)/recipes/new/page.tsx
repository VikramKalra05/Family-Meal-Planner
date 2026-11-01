import { createClient } from "@/lib/supabase/server";
import { defaultUnitFor } from "@/lib/food";
import { BackLink } from "@/components/back-link";
import { createRecipe, createCustomIngredientOption, estimateIngredientAction } from "../actions";
import { RecipeForm } from "../recipe-form";
import type { IngredientOption } from "../types";

export const instant = false;

export default async function NewRecipePage() {
  const supabase = await createClient();
  const { data: ingredients } = await supabase
    .from("ingredients")
    .select("id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .order("name");

  const options: IngredientOption[] = (ingredients ?? []).map((i) => ({
    id: i.id,
    name: i.name,
    category: i.category,
    kcalPer100g: Number(i.kcal_per_100g),
    proteinPer100g: Number(i.protein_per_100g),
    carbsPer100g: Number(i.carbs_per_100g),
    fatPer100g: Number(i.fat_per_100g),
    fiberPer100g: i.fiber_per_100g == null ? null : Number(i.fiber_per_100g),
    unit: defaultUnitFor(i.name, i.category),
  }));

  return (
    <div className="space-y-5 mx-auto max-w-3xl">
      <div>
        <BackLink href="/recipes" label="Recipes" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">New family recipe</h1>
        <p className="text-sm text-neutral-500">
          Nutrition updates live as you add ingredients — the same math the planner uses.
        </p>
      </div>
      <RecipeForm
        action={createRecipe}
        ingredients={options}
        onCreateIngredient={createCustomIngredientOption}
        onEstimateIngredient={estimateIngredientAction}
      />
    </div>
  );
}

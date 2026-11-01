import { notFound, redirect } from "next/navigation";
import { defaultUnitFor } from "@/lib/food";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/back-link";
import { updateRecipe, createCustomIngredientOption } from "../../actions";
import { RecipeForm } from "../../recipe-form";
import type { IngredientOption } from "../../types";

export const instant = false;

export default async function EditRecipePage({
  params,
}: PageProps<"/recipes/[id]/edit">) {
  const { id } = await params;
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("id, owner_id, title, description, cuisine, servings, prep_minutes, is_veg, steps, image_url, notes")
    .eq("id", id)
    .maybeSingle();
  if (!recipe) notFound();
  if (recipe.owner_id !== profile.id) redirect(`/recipes/${id}`);

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

  const { data: items } = await supabase
    .from("recipe_items")
    .select("ingredient_id, quantity_g, unit, note")
    .eq("recipe_id", id);
  const { data: media } = await supabase
    .from("recipe_media")
    .select("kind, url, label")
    .eq("recipe_id", id);

  return (
    <div className="space-y-5 mx-auto max-w-3xl">
      <div>
        <BackLink href={`/recipes/${recipe.id}`} label="Recipe" />
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Edit recipe</h1>
      </div>
      <RecipeForm
        action={updateRecipe}
        ingredients={options}
        onCreateIngredient={createCustomIngredientOption}
        recipeId={recipe.id}
        initial={{
          title: recipe.title,
          description: recipe.description,
          cuisine: recipe.cuisine,
          servings: recipe.servings,
          prep_minutes: recipe.prep_minutes,
          is_veg: recipe.is_veg,
          image_url: recipe.image_url,
          notes: recipe.notes,
          steps: recipe.steps,
          items: (items ?? []).map((i) => ({
            id: i.ingredient_id,
            grams: Number(i.quantity_g ?? 0),
            unit: i.unit === "ml" ? "ml" : "g",
            note: i.note,
          })),
          media: (media ?? []) as { kind: "image" | "video"; url: string; label: string | null }[],
        }}
      />
    </div>
  );
}

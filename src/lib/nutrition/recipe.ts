import { z } from "zod";

export const ingredientNutritionSchema = z.object({
  name: z.string().min(1),
  kcalPer100g: z.number().min(0),
  proteinPer100g: z.number().min(0),
  carbsPer100g: z.number().min(0),
  fatPer100g: z.number().min(0),
  fiberPer100g: z.number().min(0).nullable().optional(),
});
export type IngredientNutrition = z.infer<typeof ingredientNutritionSchema>;

export const recipeItemInputSchema = z.object({
  ingredient: ingredientNutritionSchema,
  grams: z.number().min(0).max(5000),
});
export type RecipeItemInput = z.infer<typeof recipeItemInputSchema>;

export const recipeNutritionSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number(),
  totalGrams: z.number(),
  unmatchedItems: z.array(z.string()),
});
export type RecipeNutritionResult = z.infer<typeof recipeNutritionSchema>;

/**
 * Deterministically computes whole-recipe and per-serving nutrition from
 * ingredient per-100g values and item weights. The ingredient kcal column is
 * authoritative (IFCT-style tables do not always follow Atwater exactly);
 * macros are reported alongside for the UI and evaluation module.
 */
export function computeRecipeNutrition(
  items: RecipeItemInput[],
  servings: number,
): RecipeNutritionResult {
  let kcal = 0;
  let protein = 0;
  let carbs = 0;
  let fat = 0;
  let fiber = 0;
  let totalGrams = 0;
  const unmatchedItems: string[] = [];

  for (const item of items) {
    const f = item.grams / 100;
    totalGrams += item.grams;
    if (item.grams <= 0) continue;
    kcal += item.ingredient.kcalPer100g * f;
    protein += item.ingredient.proteinPer100g * f;
    carbs += item.ingredient.carbsPer100g * f;
    fat += item.ingredient.fatPer100g * f;
    fiber += (item.ingredient.fiberPer100g ?? 0) * f;
    if (item.ingredient.kcalPer100g === 0 && item.ingredient.proteinPer100g === 0) {
      unmatchedItems.push(item.ingredient.name);
    }
  }

  const n = Math.max(1, servings);
  const r1 = (x: number) => Math.round(x * 10) / 10;

  return {
    kcal: Math.round(kcal / n),
    proteinG: r1(protein / n),
    carbsG: r1(carbs / n),
    fatG: r1(fat / n),
    fiberG: r1(fiber / n),
    totalGrams: r1(totalGrams),
    unmatchedItems,
  };
}

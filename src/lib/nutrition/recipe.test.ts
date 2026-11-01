import { describe, expect, it } from "vitest";
import { computeRecipeNutrition, type RecipeItemInput } from "./recipe";

const ing = (
  name: string,
  kcal: number,
  protein: number,
  carbs: number,
  fat: number,
  fiber = 0,
): RecipeItemInput["ingredient"] => ({
  name,
  kcalPer100g: kcal,
  proteinPer100g: protein,
  carbsPer100g: carbs,
  fatPer100g: fat,
  fiberPer100g: fiber,
});

describe("computeRecipeNutrition", () => {
  it("scales per-100g values by item weight", () => {
    // 200 g of rice (345 kcal/100g) across 2 servings = 345 kcal/serving
    const result = computeRecipeNutrition(
      [{ ingredient: ing("rice", 345, 6.8, 78, 0.7, 1), grams: 200 }],
      2,
    );
    expect(result.kcal).toBe(345);
    expect(result.proteinG).toBe(6.8);
    expect(result.carbsG).toBe(78);
    expect(result.totalGrams).toBe(200);
  });

  it("sums multiple items and divides by servings", () => {
    // Dal tadka for 3: 150g toor dal (343) + 10g ghee (900) = 51500+9000 = 60500 kcal total
    const result = computeRecipeNutrition(
      [
        { ingredient: ing("toor dal", 343, 22, 58, 1.7, 8), grams: 150 },
        { ingredient: ing("ghee", 900, 0, 0, 100, 0), grams: 10 },
      ],
      3,
    );
    expect(result.kcal).toBe(Math.round(60500 / 300)); // (150*343 + 10*900)/100/3
    expect(result.fatG).toBeCloseTo((1.7 * 1.5 + 10) / 3, 1);
  });

  it("handles fiber and reports totals rounded to 0.1", () => {
    const result = computeRecipeNutrition(
      [{ ingredient: ing("spinach", 23, 2.9, 3.6, 0.4, 2.2), grams: 250 }],
      1,
    );
    expect(result.fiberG).toBe(5.5);
  });

  it("treats zero-gram items as no-ops", () => {
    const result = computeRecipeNutrition(
      [
        { ingredient: ing("rice", 345, 6.8, 78, 0.7), grams: 100 },
        { ingredient: ing("salt", 0, 0, 0, 0), grams: 0 },
      ],
      1,
    );
    expect(result.kcal).toBe(345);
    expect(result.totalGrams).toBe(100);
  });

  it("flags salt-like items (all-zero macros) as unmatched", () => {
    const result = computeRecipeNutrition(
      [{ ingredient: ing("salt", 0, 0, 0, 0), grams: 5 }],
      1,
    );
    expect(result.unmatchedItems).toEqual(["salt"]);
  });

  it("never divides by zero servings", () => {
    const result = computeRecipeNutrition(
      [{ ingredient: ing("rice", 345, 6.8, 78, 0.7), grams: 100 }],
      0,
    );
    expect(result.kcal).toBe(345);
  });
});

import type { FoodUnit } from "@/app/(app)/recipes/types";

/**
 * Volume vs weight: recipes measure liquids in ml, solids in g. Nutrition
 * math treats ml as grams (density ≈ 1 g/ml for the liquids we carry —
 * milk, oils, cream), the same simplification mainstream food-loggers use.
 */
const LIQUID_NAMES = [
  "milk",
  "coconut milk",
  "fresh cream",
  "soy sauce",
  "vinegar",
  "water",
];

export function defaultUnitFor(name: string, category: string | null): FoodUnit {
  if (category === "oil") return "ml";
  const n = name.toLowerCase();
  return LIQUID_NAMES.some((l) => n.includes(l)) ? "ml" : "g";
}

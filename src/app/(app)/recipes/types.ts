export type FoodUnit = "g" | "ml";

export interface IngredientOption {
  id: string;
  name: string;
  category: string | null;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  fiberPer100g: number | null;
  unit: FoodUnit;
}

/** One dynamic ingredient row in the recipe form. */
export interface IngredientItemRow {
  id: string;
  name?: string;
  grams: number;
  unit: FoodUnit;
  note: string | null;
}

export interface RecipeFormValues {
  title: string;
  description: string | null;
  cuisine: string | null;
  servings: number;
  prep_minutes: number | null;
  is_veg: boolean;
  image_url: string | null;
  notes: string | null;
  steps: string[];
  items: IngredientItemRow[];
  media: MediaRow[];
}

export interface MediaRow {
  kind: "image" | "video";
  url: string;
  label: string | null;
}

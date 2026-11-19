import { z } from "zod";
import { formatIntakeName } from "@/lib/intake";

/**
 * One parsed food item from a freeform meal message.
 *
 * `quantity` is the portion the person actually ate; kcal/macros are totals
 * for that portion — never per unit. Keeping the count in its own field stops
 * the model from collapsing "2 bananas" into a row labelled just "banana".
 */
export const mealParseItemSchema = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().trim().max(40).optional(),
  kcal: z.coerce.number().min(0).max(3000),
  proteinG: z.coerce.number().min(0).max(300),
  carbsG: z.coerce.number().min(0).max(500),
  fatG: z.coerce.number().min(0).max(300),
  fiberG: z.coerce.number().min(0).max(200).optional(),
});

export const mealParseSchema = z.object({
  items: z.array(mealParseItemSchema).min(1).max(15),
});

export type MealParseItem = z.infer<typeof mealParseItemSchema>;

export const MEAL_PARSE_SYSTEM = `You extract everything a person ATE from a short message (Hinglish, English, or food names with counts).
Respond with ONLY JSON: {"items": [{"name": string, "quantity": string, "kcal": number, "proteinG": number, "carbsG": number, "fatG": number, "fiberG": number}]}.
"quantity" is the portion the person actually ate, copied from their words when given ("2 pieces", "1 plate", "500 ml"). kcal and macros are the TOTAL for that portion, not per unit.
Example: "2 bananas" → {"items":[{"name":"Banana","quantity":"2 pieces","kcal":210,"proteinG":2.6,"carbsG":54,"fatG":0.8,"fiberG":6}]}.
Estimate nutrition for typical Indian home portions. One entry per distinct food item; keep the name short and put the count in "quantity".`;

/** Diary label: "Banana (2 pieces)" — the count survives into the UI. */
export function intakeDescription(item: MealParseItem): string {
  return formatIntakeName(item.name, item.quantity);
}

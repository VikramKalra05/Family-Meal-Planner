import { z } from "zod";
import type { Profile } from "@/lib/db-types";
import type { NutrientTargets } from "@/lib/nutrition/types";

/** One food component estimated from a meal photo. */
export const photoItemSchema = z.object({
  description: z.string().trim().min(1).max(120),
  /** Edible weight of the portion being logged. */
  grams: z.coerce.number().min(1).max(3000),
  kcal: z.coerce.number().min(0).max(3000),
  protein_g: z.coerce.number().min(0).max(300),
  carbs_g: z.coerce.number().min(0).max(500),
  fat_g: z.coerce.number().min(0).max(300),
  fiber_g: z.coerce.number().min(0).max(200).optional(),
});

export const photoAnalysisSchema = z.object({
  reply: z.string().min(1).max(2000),
  /** Empty when the image contains no food. */
  items: z.array(photoItemSchema).max(15),
});

export type PhotoAnalysis = z.infer<typeof photoAnalysisSchema>;

/**
 * Vision prompt. Deliberately separate from the text assistant contract: the
 * model only estimates the plate, and the app converts the result into a
 * confirmation-gated `log_meal_items` action.
 */
export function photoAnalysisPrompt(profile: Profile, targets: NutrientTargets | null): string {
  const targetLine = targets
    ? `${targets.kcal} kcal, ${targets.proteinG} g protein, ${targets.carbsG} g carbs, ${targets.fatG} g fat, ${targets.fiberG} g fiber per day`
    : "not set";

  return `You are Rasoi AI's food-photo analyst for an Indian household. Analyse the single meal photo and return JSON only:
{"reply": string, "items": [{"description": string, "grams": number, "kcal": number, "protein_g": number, "carbs_g": number, "fat_g": number, "fiber_g": number}]}

Rules:
- Identify every distinct food or drink item visible. Keep names short; include the vessel/portion if it helps ("Dal, 1 katori").
- Estimate the edible weight in grams for the portion the user is about to eat. If the photo shows a shared family spread, assume one standard serving on the nearest plate unless the user says otherwise.
- kcal and macros are totals for that gram weight, NOT per 100 g. Account for the invisible oil/ghee used in home cooking.
- Use typical Indian home portions and visible cues (plate size, count, thickness). If an item is unclear, estimate it and say so in the reply.
- The member's diet preference is "${profile.diet_type}". Never claim a dish is allergen-free and never guess allergies.
- Daily targets are context only: ${targetLine}.
- "reply" is what the user sees: 2–4 short lines. List each item with grams and kcal, then the totals, then one line saying portions are estimates they can edit after logging. No JSON, no markdown table, no headings.
- If the image is not food, return {"reply":"That doesn't look like food — try another photo.","items":[]}.
- Never invent items you cannot see, and never return a zero-gram item.`;
}

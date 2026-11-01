import { z } from "zod";

export const SEXES = ["male", "female"] as const;
export type Sex = (typeof SEXES)[number];

export const ACTIVITY_LEVELS = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

export const GOALS = ["weight_loss", "maintenance", "muscle_gain"] as const;
export type Goal = (typeof GOALS)[number];

export const DIET_TYPES = ["veg", "egg", "non_veg"] as const;
export type DietType = (typeof DIET_TYPES)[number];

/** Standard Harris activity multipliers applied to BMR to get TDEE. */
export const ACTIVITY_MULTIPLIERS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

/**
 * Goal energy adjustment as a fraction of TDEE.
 * Midpoints of the evidence-based ranges from the project spec:
 * weight_loss −20..−15 %, muscle_gain +10..+15 %.
 */
export const GOAL_ADJUSTMENTS: Record<Goal, number> = {
  weight_loss: -0.175,
  maintenance: 0,
  muscle_gain: 0.125,
};

/** Protein target in g per kg bodyweight, per goal (global cap 2.2 applies). */
export const PROTEIN_G_PER_KG: Record<Goal, number> = {
  weight_loss: 2.0,
  maintenance: 1.6,
  muscle_gain: 1.8,
};

/** Hard calorie floors below which a deficit plan is not considered safe. */
export const CALORIE_FLOORS: Record<Sex, number> = {
  female: 1200,
  male: 1500,
};

/** Protein never exceeds this fraction of bodyweight (g/kg). */
export const PROTEIN_CAP_G_PER_KG = 2.2;

/** Minimum fat intake for hormonal health, as g per kg bodyweight. */
export const FAT_FLOOR_G_PER_KG = 0.8;

/** Default share of calories coming from fat before floors are applied. */
export const DEFAULT_FAT_SHARE = 0.25;

/** Institute of Medicine baseline: 14 g fiber per 1000 kcal. */
export const FIBER_G_PER_1000_KCAL = 14;

/** Absolute fiber floor regardless of intake. */
export const FIBER_FLOOR_G = 25;

/** Carbohydrates are never planned below this many grams (brain glucose need). */
export const CARB_FLOOR_G = 40;

export const profileSchema = z.object({
  sex: z.enum(SEXES),
  age: z.number().int().min(10).max(100),
  heightCm: z.number().min(100).max(230),
  weightKg: z.number().min(30).max(250),
  activityLevel: z.enum(ACTIVITY_LEVELS),
  goal: z.enum(GOALS),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const nutrientTargetsSchema = z.object({
  kcal: z.number(),
  proteinG: z.number(),
  carbsG: z.number(),
  fatG: z.number(),
  fiberG: z.number(),
});
export type NutrientTargets = z.infer<typeof nutrientTargetsSchema>;

export const targetsResultSchema = z.object({
  targets: nutrientTargetsSchema,
  breakdown: z.object({
    bmr: z.number(),
    tdee: z.number(),
    goalKcal: z.number(),
    goalAdjustmentPct: z.number(),
    proteinGPerKg: z.number(),
    calorieFloorApplied: z.boolean(),
    carbFloorApplied: z.boolean(),
    fatFloorApplied: z.boolean(),
    formula: z.literal("mifflin-st-jeor"),
  }),
});
export type TargetsResult = z.infer<typeof targetsResultSchema>;

/** Knobs the evaluation module can turn without touching engine internals. */
export const engineOptionsSchema = z.object({
  proteinGPerKg: z.number().min(0.8).max(3).optional(),
  fatShare: z.number().min(0.15).max(0.45).optional(),
  goalAdjustmentPct: z.number().min(-0.4).max(0.4).optional(),
});
export type EngineOptions = z.infer<typeof engineOptionsSchema>;

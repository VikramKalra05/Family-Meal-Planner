import {
  ACTIVITY_MULTIPLIERS,
  CALORIE_FLOORS,
  CARB_FLOOR_G,
  DEFAULT_FAT_SHARE,
  FAT_FLOOR_G_PER_KG,
  FIBER_FLOOR_G,
  FIBER_G_PER_1000_KCAL,
  GOAL_ADJUSTMENTS,
  PROTEIN_CAP_G_PER_KG,
  PROTEIN_G_PER_KG,
  type EngineOptions,
  type NutrientTargets,
  type ProfileInput,
  type TargetsResult,
} from "./types";

export const round1 = (n: number) => Math.round(n);
export const round5 = (n: number) => Math.round(n / 5) * 5;

/** Mifflin-St Jeor resting metabolic rate, unrounded. */
export function calculateBMR(profile: Pick<ProfileInput, "sex" | "age" | "heightCm" | "weightKg">): number {
  const base = 10 * profile.weightKg + 6.25 * profile.heightCm - 5 * profile.age;
  return profile.sex === "male" ? base + 5 : base - 161;
}

/** Total daily energy expenditure = BMR x activity multiplier, unrounded. */
export function calculateTDEE(
  profile: Pick<ProfileInput, "sex" | "age" | "heightCm" | "weightKg" | "activityLevel">,
): number {
  return calculateBMR(profile) * ACTIVITY_MULTIPLIERS[profile.activityLevel];
}

/**
 * Deterministic daily targets: energy via Mifflin-St Jeor with goal
 * adjustment and safety floors, then macros filled protein-first,
 * fat second, carbs as remainder.
 */
export function calculateTargets(profile: ProfileInput, options: EngineOptions = {}): TargetsResult {
  const bmr = calculateBMR(profile);
  const tdee = calculateTDEE(profile);

  const adjustmentPct = options.goalAdjustmentPct ?? GOAL_ADJUSTMENTS[profile.goal];
  const goalKcal = tdee * (1 + adjustmentPct);

  const floor = CALORIE_FLOORS[profile.sex];
  const calorieFloorApplied = goalKcal < floor;
  const kcal = calorieFloorApplied ? floor : goalKcal;

  const proteinGPerKg = Math.min(
    options.proteinGPerKg ?? PROTEIN_G_PER_KG[profile.goal],
    PROTEIN_CAP_G_PER_KG,
  );
  const proteinG = profile.weightKg * proteinGPerKg;
  const proteinKcal = proteinG * 4;

  const fatFloorG = profile.weightKg * FAT_FLOOR_G_PER_KG;
  const fatFromShareG = (kcal * (options.fatShare ?? DEFAULT_FAT_SHARE)) / 9;
  const fatFloorApplied = fatFromShareG < fatFloorG;
  const fatG = Math.max(fatFromShareG, fatFloorG);
  const fatKcal = fatG * 9;

  const carbsKcal = kcal - proteinKcal - fatKcal;
  const carbFloorApplied = carbsKcal < CARB_FLOOR_G * 4;
  let finalFatG = fatG;
  const carbsG = carbFloorApplied ? CARB_FLOOR_G : carbsKcal / 4;
  if (carbFloorApplied) {
    // Give carbs their floor and let fat absorb the remainder, floored at zero.
    finalFatG = Math.max(0, (kcal - proteinKcal - CARB_FLOOR_G * 4) / 9);
  }

  const fiberG = Math.max((kcal / 1000) * FIBER_G_PER_1000_KCAL, FIBER_FLOOR_G);

  const targets: NutrientTargets = {
    kcal: round5(kcal),
    proteinG: round1(proteinG),
    carbsG: round1(carbsG),
    fatG: round1(finalFatG),
    fiberG: round1(fiberG),
  };

  return {
    targets,
    breakdown: {
      bmr: Math.round(bmr),
      tdee: Math.round(tdee),
      goalKcal: Math.round(goalKcal),
      goalAdjustmentPct: adjustmentPct,
      proteinGPerKg,
      calorieFloorApplied,
      carbFloorApplied,
      fatFloorApplied,
      formula: "mifflin-st-jeor",
    },
  };
}

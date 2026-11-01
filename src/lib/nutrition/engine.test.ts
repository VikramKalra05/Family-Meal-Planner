import { describe, expect, it } from "vitest";
import { calculateBMR, calculateTDEE, calculateTargets } from "@/lib/nutrition/engine";
import { profileSchema, type ProfileInput } from "@/lib/nutrition/types";

const male: ProfileInput = {
  sex: "male",
  age: 30,
  heightCm: 175,
  weightKg: 70,
  activityLevel: "moderate",
  goal: "weight_loss",
};

describe("calculateBMR (Mifflin-St Jeor)", () => {
  it("computes the male formula: 10w + 6.25h − 5a + 5", () => {
    expect(calculateBMR(male)).toBeCloseTo(1648.75, 2);
  });

  it("computes the female formula: 10w + 6.25h − 5a − 161", () => {
    const female = { ...male, sex: "female" as const, weightKg: 60, heightCm: 165 };
    expect(calculateBMR(female)).toBeCloseTo(1320.25, 2);
  });
});

describe("calculateTDEE", () => {
  it("multiplies BMR by the activity factor", () => {
    expect(calculateTDEE(male)).toBeCloseTo(1648.75 * 1.55, 2);
  });

  it("scales with activity level", () => {
    const sedentary = calculateTDEE({ ...male, activityLevel: "sedentary" });
    const veryActive = calculateTDEE({ ...male, activityLevel: "very_active" });
    expect(veryActive).toBeGreaterThan(sedentary);
    expect(sedentary).toBeCloseTo(1648.75 * 1.2, 2);
  });
});

describe("calculateTargets — energy", () => {
  it("applies the −17.5% weight-loss adjustment", () => {
    const { targets, breakdown } = calculateTargets(male);
    expect(breakdown.goalKcal).toBeCloseTo(2555.5625 * 0.825, 0);
    expect(targets.kcal).toBe(2110); // round5(2108.34)
    expect(breakdown.calorieFloorApplied).toBe(false);
  });

  it("applies the +12.5% muscle-gain adjustment", () => {
    const { targets } = calculateTargets({ ...male, goal: "muscle_gain" });
    expect(targets.kcal).toBe(2875); // round5(2875.01)
  });

  it("keeps maintenance at TDEE", () => {
    const { targets, breakdown } = calculateTargets({ ...male, goal: "maintenance" });
    expect(targets.kcal).toBe(2555);
    expect(breakdown.goalAdjustmentPct).toBe(0);
  });

  it("enforces the 1200 kcal floor for small females", () => {
    const smallFemale: ProfileInput = {
      sex: "female",
      age: 45,
      heightCm: 150,
      weightKg: 45,
      activityLevel: "sedentary",
      goal: "weight_loss",
    };
    const { targets, breakdown } = calculateTargets(smallFemale);
    expect(breakdown.goalKcal).toBe(991); // Math.round(991.485)
    expect(targets.kcal).toBe(1200);
    expect(breakdown.calorieFloorApplied).toBe(true);
  });
});

describe("calculateTargets — macros", () => {
  it("sets protein by goal (2.0 g/kg for weight loss) and fills fat then carbs", () => {
    const { targets } = calculateTargets(male);
    expect(targets.proteinG).toBe(140);
    expect(targets.fatG).toBe(59); // max(2108.34*0.25/9, 70*0.8) = 58.6, no floor
    expect(targets.carbsG).toBe(255);
    const kcalFromMacros = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;
    expect(Math.abs(kcalFromMacros - targets.kcal)).toBeLessThanOrEqual(12);
  });

  it("uses 1.8 g/kg protein for muscle gain", () => {
    const { targets } = calculateTargets({ ...male, goal: "muscle_gain" });
    expect(targets.proteinG).toBe(126);
  });

  it("caps protein at 2.2 g/kg even with an aggressive override", () => {
    const { targets, breakdown } = calculateTargets(male, { proteinGPerKg: 3 });
    expect(breakdown.proteinGPerKg).toBe(2.2);
    expect(targets.proteinG).toBe(154);
  });

  it("floors fat at 0.8 g/kg for small females", () => {
    const smallFemale: ProfileInput = {
      sex: "female",
      age: 45,
      heightCm: 150,
      weightKg: 45,
      activityLevel: "sedentary",
      goal: "weight_loss",
    };
    const { targets, breakdown } = calculateTargets(smallFemale);
    expect(targets.fatG).toBe(36); // 45*0.8 beats the 25% share (33.3)
    expect(breakdown.fatFloorApplied).toBe(true);
  });

  it("gives carbs their 40 g floor and lets fat absorb the remainder in extreme cases", () => {
    const heavy: ProfileInput = {
      sex: "male",
      age: 30,
      heightCm: 175,
      weightKg: 150,
      activityLevel: "sedentary",
      goal: "weight_loss",
    };
    const { targets, breakdown } = calculateTargets(heavy, {
      proteinGPerKg: 3, // capped to 2.2 -> 330 g
      fatShare: 0.45,
    });
    expect(breakdown.carbFloorApplied).toBe(true);
    expect(targets.carbsG).toBe(40);
    const kcalFromMacros = targets.proteinG * 4 + targets.carbsG * 4 + targets.fatG * 9;
    expect(Math.abs(kcalFromMacros - targets.kcal)).toBeLessThanOrEqual(12);
  });

  it("respects the custom fat share override", () => {
    const { targets } = calculateTargets({ ...male, goal: "maintenance" }, { fatShare: 0.35 });
    expect(targets.fatG).toBe(99); // 2555.56*0.35/9 = 99.4
  });
});

describe("calculateTargets — fiber", () => {
  it("targets 14 g per 1000 kcal", () => {
    const { targets } = calculateTargets({ ...male, goal: "maintenance" });
    expect(targets.fiberG).toBe(36); // 2555 kcal * 14/1000
  });

  it("never plans below the 25 g fiber floor", () => {
    const tiny: ProfileInput = {
      sex: "female",
      age: 45,
      heightCm: 150,
      weightKg: 45,
      activityLevel: "sedentary",
      goal: "weight_loss",
    };
    const { targets } = calculateTargets(tiny);
    expect(targets.fiberG).toBe(25);
  });
});

describe("profileSchema validation", () => {
  it("rejects children under 10", () => {
    expect(profileSchema.safeParse({ ...male, age: 8 }).success).toBe(false);
  });

  it("rejects implausible weights", () => {
    expect(profileSchema.safeParse({ ...male, weightKg: 25 }).success).toBe(false);
  });

  it("accepts a valid profile", () => {
    expect(profileSchema.safeParse(male).success).toBe(true);
  });
});

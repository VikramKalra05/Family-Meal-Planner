import { describe, expect, it } from "vitest";
import {
  KG_PLATE_PRESET,
  LB_PLATE_PRESET,
  addDays,
  weekdayIndex,
} from "./types";
import {
  formatPlates,
  presetPlates,
  solvePlates,
  stackKg,
  totalFromPlates,
  warmupRamp,
} from "./plates";
import { bestE1rm, epley1rm, isPr, pctChange, totalVolume } from "./e1rm";
import { shouldDeload, suggestNextLoad, weeklySetsByMuscle } from "./progression";
import { computeStreak, isTrainingDay } from "./streak";
import {
  applyCalorieAdjustment,
  calorieFloorFor,
  dayFuel,
  trainingDatesForWeek,
  weekTargets,
  weeklyKcal,
} from "./fuel";
import { suggestAdaptation } from "./adapt";
import { CALORIE_FLOORS } from "@/lib/nutrition/types";

const baseTargets = { kcal: 2000, proteinG: 150, carbsG: 200, fatG: 60, fiberG: 30 };

describe("plate solver", () => {
  it("builds an exact 82.5 kg bar", () => {
    const s = solvePlates(82.5, 20, KG_PLATE_PRESET)!;
    expect(s.exact).toBe(true);
    expect(s.total).toBe(82.5);
    expect(s.perSideWeight).toBe(31.25);
    expect(s.perSide.map((p) => p.denom.label)).toEqual(["25", "5", "1.25"]);
  });

  it("builds 100 kg from 25 + 15 per side", () => {
    const s = solvePlates(100, 20, KG_PLATE_PRESET)!;
    expect(s.exact).toBe(true);
    expect(s.total).toBe(100);
  });

  it("prefers the closest weight under the target on a tie", () => {
    const s = solvePlates(83, 20, KG_PLATE_PRESET)!;
    expect(s.total).toBe(82.5);
    expect(s.diff).toBe(0.5);
    expect(s.exact).toBe(false);
  });

  it("returns null below bar weight", () => {
    expect(solvePlates(15, 20, KG_PLATE_PRESET)).toBeNull();
  });

  it("works in pounds", () => {
    const s = solvePlates(135, 45, LB_PLATE_PRESET)!;
    expect(s.exact).toBe(true);
    expect(s.perSide[0].denom.label).toBe("45");
  });

  it("handles sparse inventories", () => {
    const sparse = [
      { id: "a", label: "25", weight: 25, count: 2 },
      { id: "b", label: "10", weight: 10, count: 4 },
    ];
    const s = solvePlates(60, 20, sparse)!;
    expect(s.exact).toBe(true);
    expect(s.perSideWeight).toBe(20);
  });

  it("formats and forward-solves", () => {
    const s = solvePlates(82.5, 20, KG_PLATE_PRESET)!;
    expect(formatPlates(s)).toBe("25 + 5 + 1.25 per side");
    expect(totalFromPlates([{ weight: 20, qty: 1 }, { weight: 10, qty: 1 }, { weight: 2.5, qty: 1 }], 20)).toBe(85);
  });

  it("interpolates an unlabelled machine stack", () => {
    const stack = { positionCount: 12, points: [{ position: 1, kg: 5 }, { position: 10, kg: 50 }] };
    expect(stackKg(5.5, stack)).toBe(27.5);
    expect(stackKg(1, stack)).toBe(5);
    expect(stackKg(12, stack)).toBe(50);
  });

  it("keeps a warm-up ramp below the working weight", () => {
    const ramp = warmupRamp(100, 20);
    expect(ramp[0].weight).toBe(20);
    expect(ramp.every((r) => r.weight < 100)).toBe(true);
  });

  it("returns fresh preset objects", () => {
    const a = presetPlates("kg");
    a[0].count = 99;
    expect(KG_PLATE_PRESET[0].count).not.toBe(99);
  });
});

describe("e1RM + volume", () => {
  it("uses Epley and caps reps at 12", () => {
    expect(epley1rm(100, 1)).toBe(100);
    expect(epley1rm(100, 5)).toBe(116.7);
    expect(epley1rm(100, 20)).toBe(140);
  });

  it("ignores warm-ups and zero-weight sets", () => {
    expect(bestE1rm([{ weightKg: 60, reps: 10 }, { weightKg: 100, reps: 1, isWarmup: true }])).toBe(80);
    expect(bestE1rm([])).toBeNull();
  });

  it("sums tonnage", () => {
    expect(totalVolume([{ weightKg: 60, reps: 10 }, { weightKg: 60, reps: 8 }, { weightKg: 100, reps: 1, isWarmup: true }])).toBe(1080);
  });

  it("detects PRs and percent change", () => {
    expect(isPr(null, 80)).toBe(true);
    expect(isPr(80, 80)).toBe(false);
    expect(isPr(80, 82.5)).toBe(true);
    expect(pctChange(100, 105)).toBe(5);
    expect(pctChange(null, 105)).toBeNull();
  });
});

describe("progression", () => {
  const sets = (reps: number[]) => reps.map((r) => ({ weightKg: 60, reps: r }));

  it("adds weight when every set hits the top of the range", () => {
    const s = suggestNextLoad({ lastSets: sets([12, 12, 12]), repMin: 8, repMax: 12, incrementKg: 2.5 })!;
    expect(s.action).toBe("increase");
    expect(s.weightKg).toBe(62.5);
  });

  it("holds when every set is inside the range", () => {
    const s = suggestNextLoad({ lastSets: sets([9, 9, 8]), repMin: 8, repMax: 12, incrementKg: 2.5 })!;
    expect(s.action).toBe("hold");
    expect(s.weightKg).toBe(60);
  });

  it("reduces after a bad session", () => {
    const s = suggestNextLoad({ lastSets: sets([5, 4, 4]), repMin: 8, repMax: 12, incrementKg: 2.5 })!;
    expect(s.action).toBe("reduce");
    expect(s.weightKg).toBe(55);
  });

  it("has no suggestion without sets", () => {
    expect(suggestNextLoad({ lastSets: [], repMin: 8, repMax: 12, incrementKg: 2.5 })).toBeNull();
  });

  it("detects a deload", () => {
    expect(shouldDeload([100, 105, 110, 90, 88])).toBe(true);
    expect(shouldDeload([100, 105, 110, 112, 115])).toBe(false);
    expect(shouldDeload([100, 100])).toBe(false);
  });

  it("counts primary and secondary volume", () => {
    const map = new Map([
      ["bench", { primary: ["chest" as const], secondary: ["triceps" as const, "shoulders" as const] }],
      ["row", { primary: ["back" as const], secondary: ["biceps" as const] }],
    ]);
    const result = weeklySetsByMuscle(
      [
        { exerciseId: "bench" },
        { exerciseId: "bench" },
        { exerciseId: "row" },
        { exerciseId: "bench", isWarmup: true },
      ],
      map,
    );
    expect(result.find((r) => r.muscle === "chest")?.sets).toBe(2);
    expect(result.find((r) => r.muscle === "triceps")?.sets).toBe(1);
    expect(result.find((r) => r.muscle === "back")?.sets).toBe(1);
  });
});

describe("streak", () => {
  // 2026-11-16 is a Monday.
  const today = "2026-11-19"; // Thursday
  const monWedFri = [0, 2, 4];

  it("counts a streak across rest days", () => {
    const s = computeStreak({ sessionDates: ["2026-11-16", "2026-11-18"], scheduledDays: monWedFri, today });
    expect(s.current).toBe(2);
    expect(s.consistencyPct).toBe(100);
  });

  it("does not break the streak when today is still pending", () => {
    const s = computeStreak({ sessionDates: ["2026-11-16"], scheduledDays: monWedFri, today: "2026-11-18" });
    expect(s.current).toBe(1);
    expect(s.recentMisses).toEqual([]);
  });

  it("breaks on a missed past scheduled day", () => {
    const s = computeStreak({ sessionDates: ["2026-11-18"], scheduledDays: monWedFri, today });
    expect(s.current).toBe(1);
    expect(s.consistencyPct).toBe(50);
    expect(s.recentMisses).toContain("2026-11-16");
  });

  it("lets a freeze cover a miss", () => {
    const s = computeStreak({
      sessionDates: ["2026-11-18"],
      scheduledDays: monWedFri,
      today,
      freezes: ["2026-11-16"],
    });
    expect(s.current).toBe(2);
    expect(s.freezesAvailable).toBe(0);
  });

  it("returns no streak without a schedule", () => {
    const s = computeStreak({ sessionDates: ["2026-11-16"], scheduledDays: [], today });
    expect(s.current).toBe(0);
    expect(s.consistencyPct).toBeNull();
  });

  it("finds the longest run", () => {
    const s = computeStreak({
      sessionDates: ["2026-11-02", "2026-11-04", "2026-11-06", "2026-11-09", "2026-11-16", "2026-11-18"],
      scheduledDays: monWedFri,
      today,
    });
    expect(s.longest).toBe(4);
  });

  it("knows training days", () => {
    expect(isTrainingDay("2026-11-16", monWedFri)).toBe(true);
    expect(isTrainingDay("2026-11-17", monWedFri)).toBe(false);
  });
});

describe("fuel cycling", () => {
  it("is weekly-neutral at 4 training days", () => {
    const t = dayFuel(baseTargets, { isTrainingDay: true, trainingDaysPerWeek: 4 });
    const r = dayFuel(baseTargets, { isTrainingDay: false, trainingDaysPerWeek: 4 });
    expect(t.kcal).toBe(2120);
    expect(r.kcal).toBe(1840);
    expect(t.kcal * 4 + r.kcal * 3).toBe(14000);
    expect(t.proteinG).toBe(150);
    expect(t.carbsG).toBeGreaterThan(r.carbsG);
  });

  it("is weekly-neutral at 3 training days", () => {
    expect(weeklyKcal(baseTargets, [0, 2, 4])).toBe(14000);
  });

  it("stays flat with no schedule or an every-day schedule", () => {
    expect(dayFuel(baseTargets, { isTrainingDay: true, trainingDaysPerWeek: 0 }).kcal).toBe(2000);
    expect(dayFuel(baseTargets, { isTrainingDay: true, trainingDaysPerWeek: 7 }).kcal).toBe(2000);
  });

  it("maps the week and marks the right dates", () => {
    const dates = trainingDatesForWeek("2026-11-16", [0, 2, 4]);
    expect(dates).toEqual(["2026-11-16", "2026-11-18", "2026-11-20"]);
    const targets = weekTargets(baseTargets, "2026-11-16", [0, 2, 4]);
    expect(Object.keys(targets)).toHaveLength(7);
    expect(targets["2026-11-16"].kcal).toBe(2120);
    expect(targets["2026-11-17"].kcal).toBe(1910);
  });

  it("handles date helpers at month boundaries", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(weekdayIndex("2026-11-16")).toBe(0);
  });

  it("clamps the adaptive offset at the calorie safety floor", () => {
    const cut = applyCalorieAdjustment(
      { ...baseTargets, kcal: 1200, carbsG: 120 },
      -400,
      CALORIE_FLOORS.female,
    );
    expect(cut.kcal).toBe(1200);
    expect(cut.carbsG).toBe(120);
    expect(calorieFloorFor(null)).toBe(1200);
    expect(calorieFloorFor("male")).toBe(1500);
  });

  it("clamps rest-day carb cycling at the same floor", () => {
    const rest = dayFuel(
      { ...baseTargets, kcal: 1200, carbsG: 120 },
      { isTrainingDay: false, trainingDaysPerWeek: 6, floorKcal: 1200 },
    );
    expect(rest.kcal).toBe(1200);
    expect(rest.deltaKcal).toBe(0);
    expect(rest.deltaCarbsG).toBe(0);
  });
});

describe("adaptive loop", () => {
  const base = {
    goal: "muscle_gain" as const,
    weightKg: 70,
    weightTrendPerWeek: 0,
    strengthTrendPct: 0,
    waistDeltaCm: 0,
    weightLogs: 14,
    sessions: 8,
    currentAdjustmentKcal: 0,
  };

  it("collects until there is enough data", () => {
    expect(suggestAdaptation({ ...base, weightLogs: 3 }).action).toBe("collect");
  });

  it("adds calories when muscle gain stalls", () => {
    const s = suggestAdaptation(base);
    expect(s.action).toBe("increase");
    expect(s.nextAdjustmentKcal).toBe(150);
  });

  it("pulls back when gaining fast with a waist increase", () => {
    const s = suggestAdaptation({ ...base, weightTrendPerWeek: 0.8, waistDeltaCm: 2 });
    expect(s.action).toBe("decrease");
    expect(s.nextAdjustmentKcal).toBe(-150);
  });

  it("tightens a slow cut", () => {
    const s = suggestAdaptation({
      ...base,
      goal: "weight_loss",
      weightTrendPerWeek: -0.05,
      strengthTrendPct: 0,
    });
    expect(s.action).toBe("decrease");
  });

  it("holds instead of cutting below the safety floor", () => {
    const s = suggestAdaptation({
      ...base,
      goal: "weight_loss",
      weightTrendPerWeek: -0.05,
      strengthTrendPct: 0,
      currentAdjustmentKcal: -400,
      minAdjustmentKcal: -400,
    });
    expect(s.action).toBe("hold");
    expect(s.deltaKcal).toBe(0);
    expect(s.reason).toContain("safety floor");
  });

  it("eases a cut that is too fast or costing strength", () => {
    const s = suggestAdaptation({
      ...base,
      goal: "weight_loss",
      weightTrendPerWeek: -0.9,
      strengthTrendPct: -6,
    });
    expect(s.action).toBe("increase");
  });

  it("holds when maintenance is stable", () => {
    const s = suggestAdaptation({ ...base, goal: "maintenance", weightTrendPerWeek: 0.05 });
    expect(s.action).toBe("hold");
  });

  it("never exceeds the adjustment clamp", () => {
    const s = suggestAdaptation({ ...base, currentAdjustmentKcal: 400 });
    expect(s.nextAdjustmentKcal).toBe(400);
    expect(s.deltaKcal).toBe(0);
  });
});

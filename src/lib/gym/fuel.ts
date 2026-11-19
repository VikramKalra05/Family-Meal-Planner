/**
 * Training-day fuel targets — carb cycling that is weekly-neutral.
 *
 * The base targets already include the user's goal adjustment and activity
 * level. We do NOT add "calories burned" on top: MET estimates are noisy and
 * double-count the activity multiplier. Instead, the same weekly calories are
 * redistributed: a modest surplus on training days (mostly carbs) and an
 * offsetting deficit on rest days (mostly carbs, a little fat).
 *
 *   training-day surplus  a = min(6%, 12% × restDays / trainingDays)
 *   rest-day deficit      b = a × trainingDays / restDays
 *
 * By construction: trainingDays × a − restDays × b = 0.
 */

import type { NutrientTargets } from "@/lib/nutrition/types";
import { addDays, clamp, weekdayIndex } from "./types";

export interface DayFuel extends NutrientTargets {
  trainingDay: boolean;
  deltaKcal: number;
  deltaCarbsG: number;
  deltaFatG: number;
  note: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
const round5 = (n: number) => Math.round(n / 5) * 5;

export function dayFuel(
  base: NutrientTargets,
  opts: { isTrainingDay: boolean; trainingDaysPerWeek: number },
): DayFuel {
  const trainingDays = clamp(Math.round(opts.trainingDaysPerWeek), 0, 7);

  if (trainingDays === 0 || trainingDays >= 7 || base.kcal <= 0) {
    return {
      ...base,
      trainingDay: opts.isTrainingDay,
      deltaKcal: 0,
      deltaCarbsG: 0,
      deltaFatG: 0,
      note:
        trainingDays >= 7
          ? "Training every day — targets stay flat."
          : "No training schedule set yet.",
    };
  }

  const restDays = 7 - trainingDays;
  const surplusPct = Math.min(0.06, (0.12 * restDays) / trainingDays);
  const deficitPct = (surplusPct * trainingDays) / restDays;
  const deltaPct = opts.isTrainingDay ? surplusPct : -deficitPct;

  const deltaKcal = base.kcal * deltaPct;
  // Carbs carry the swing; a little fat moves with it so the macro maths
  // still adds up. Protein is held constant — it is a bodyweight target,
  // not an energy buffer.
  const deltaCarbsG = (deltaKcal * 0.9) / 4;
  const deltaFatG = (deltaKcal * 0.1) / 9;

  const kcal = round5(Math.max(0, base.kcal + deltaKcal));
  const carbsG = Math.max(40, round1(base.carbsG + deltaCarbsG));
  const fatG = Math.max(0, round1(base.fatG + deltaFatG));

  return {
    kcal,
    proteinG: base.proteinG,
    carbsG,
    fatG,
    fiberG: base.fiberG,
    trainingDay: opts.isTrainingDay,
    deltaKcal: Math.round(deltaKcal),
    deltaCarbsG: round1(deltaCarbsG),
    deltaFatG: round1(deltaFatG),
    note: opts.isTrainingDay
      ? `Training day · ${deltaKcal >= 0 ? "+" : ""}${Math.round(deltaKcal)} kcal, ${deltaCarbsG >= 0 ? "+" : ""}${Math.round(deltaCarbsG)} g carbs`
      : `Rest day · ${Math.round(deltaKcal)} kcal, ${Math.round(deltaCarbsG)} g carbs`,
  };
}

/** Monday-start week → the seven ISO dates that are training days. */
export function trainingDatesForWeek(weekStart: string, scheduledDays: number[]): string[] {
  const days: string[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    if (scheduledDays.includes(weekdayIndex(date))) days.push(date);
  }
  return days;
}

/** Full week of per-date targets for the planner. */
export function weekTargets(
  base: NutrientTargets,
  weekStart: string,
  scheduledDays: number[],
): Record<string, NutrientTargets> {
  const out: Record<string, NutrientTargets> = {};
  const perWeek = scheduledDays.filter((d) => d >= 0 && d <= 6).length;
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i);
    const fuel = dayFuel(base, {
      isTrainingDay: scheduledDays.includes(weekdayIndex(date)),
      trainingDaysPerWeek: perWeek,
    });
    out[date] = {
      kcal: fuel.kcal,
      proteinG: fuel.proteinG,
      carbsG: fuel.carbsG,
      fatG: fuel.fatG,
      fiberG: fuel.fiberG,
    };
  }
  return out;
}

/** Sanity check used in tests and the settings UI: weekly sum is neutral. */
export function weeklyKcal(base: NutrientTargets, scheduledDays: number[]): number {
  const perWeek = scheduledDays.filter((d) => d >= 0 && d <= 6).length;
  let total = 0;
  for (let i = 0; i < 7; i++) {
    total += dayFuel(base, {
      isTrainingDay: i < perWeek,
      trainingDaysPerWeek: perWeek,
    }).kcal;
  }
  return total;
}

/**
 * Apply the adaptive weekly offset before carb cycling. The offset is a
 * calorie change; carbs absorb it (fat and protein stay put) so the macro
 * maths still adds up.
 */
export function applyCalorieAdjustment(
  base: NutrientTargets,
  deltaKcal: number,
): NutrientTargets {
  if (!deltaKcal) return base;
  return {
    kcal: Math.max(0, round5(base.kcal + deltaKcal)),
    proteinG: base.proteinG,
    carbsG: Math.max(40, round1(base.carbsG + deltaKcal / 4)),
    fatG: base.fatG,
    fiberG: base.fiberG,
  };
}

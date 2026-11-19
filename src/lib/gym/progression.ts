/**
 * Progressive overload assistant. Double progression: stay at the same load
 * until every working set reaches the top of the rep range, then add the
 * smallest sensible jump. Never invents a weight — the suggestion is always
 * last session's load plus or minus one increment.
 */

import type { Muscle } from "./types";
import type { WorkingSet } from "./e1rm";

export interface ProgressionInput {
  lastSets: WorkingSet[];
  repMin: number;
  repMax: number;
  incrementKg: number;
}

export type ProgressionAction = "increase" | "hold" | "reduce" | "start";

export interface ProgressionSuggestion {
  weightKg: number;
  /** Compact prescription, e.g. "3 × 8–12 @ 60 kg". */
  prescription: string;
  action: ProgressionAction;
  reason: string;
}

function workingSets(sets: WorkingSet[]): WorkingSet[] {
  return sets.filter((s) => !s.isWarmup && s.reps > 0);
}

export function suggestNextLoad(input: ProgressionInput): ProgressionSuggestion | null {
  const sets = workingSets(input.lastSets);
  if (sets.length === 0) return null;

  const weight = Math.max(...sets.map((s) => s.weightKg));
  const reps = sets.map((s) => s.reps);
  const low = input.repMin;
  const high = input.repMax;
  const inc = Math.max(0.5, input.incrementKg);

  const allTop = reps.every((r) => r >= high);
  const allMin = reps.every((r) => r >= low);
  const anyWayBelow = reps.some((r) => r < low - 2);

  if (allTop) {
    const next = Math.round((weight + inc) * 100) / 100;
    return {
      weightKg: next,
      prescription: `${sets.length} × ${low}–${high} @ ${next} kg`,
      action: "increase",
      reason: `All sets hit ${high}+ reps — add ${inc} kg.`,
    };
  }

  if (anyWayBelow) {
    const next = Math.max(0, Math.round((weight - inc * 2) * 100) / 100);
    return {
      weightKg: next,
      prescription: `${sets.length} × ${low}–${high} @ ${next} kg`,
      action: "reduce",
      reason: `Reps fell below ${low} — drop ${inc * 2} kg and rebuild.`,
    };
  }

  if (allMin) {
    return {
      weightKg: weight,
      prescription: `${sets.length} × ${low}–${high} @ ${weight} kg`,
      action: "hold",
      reason: `Add a rep per set before adding weight.`,
    };
  }

  return {
    weightKg: weight,
    prescription: `${sets.length} × ${low}–${high} @ ${weight} kg`,
    action: "hold",
    reason: `Stay at ${weight} kg until every set reaches ${low}.`,
  };
}

/**
 * Suggest a deload when the best e1RM of the last two sessions falls below
 * 95% of the best of the preceding sessions. Two data points are not enough.
 */
export function shouldDeload(e1rms: number[]): boolean {
  if (e1rms.length < 4) return false;
  const priorBest = Math.max(...e1rms.slice(0, -2));
  const recentBest = Math.max(...e1rms.slice(-2));
  return recentBest < priorBest * 0.95;
}

export interface MuscleVolume {
  muscle: Muscle;
  sets: number;
}

/**
 * Weekly hard sets per muscle. Primary muscles count 1, secondary 0.5 —
 * the convention used in most volume-landmark literature. Warm-ups excluded.
 */
export function weeklySetsByMuscle(
  sets: { exerciseId: string; isWarmup?: boolean }[],
  exerciseMuscles: Map<string, { primary: Muscle[]; secondary: Muscle[] }>,
): MuscleVolume[] {
  const acc = new Map<Muscle, number>();
  for (const s of sets) {
    if (s.isWarmup) continue;
    const m = exerciseMuscles.get(s.exerciseId);
    if (!m) continue;
    for (const muscle of m.primary) acc.set(muscle, (acc.get(muscle) ?? 0) + 1);
    for (const muscle of m.secondary) acc.set(muscle, (acc.get(muscle) ?? 0) + 0.5);
  }
  return [...acc.entries()]
    .map(([muscle, count]) => ({ muscle, sets: Math.round(count * 10) / 10 }))
    .sort((a, b) => b.sets - a.sets);
}

/** Evidence-informed weekly volume band, in hard sets. */
export function volumeBand(muscle: Muscle): { min: number; max: number } {
  if (muscle === "forearms" || muscle === "core") return { min: 2, max: 12 };
  if (muscle === "calves") return { min: 6, max: 16 };
  return { min: 8, max: 20 };
}

/**
 * Strength maths: estimated 1RM, volume, PR detection, relative strength.
 * Epley is used because it is the least surprising formula for lifters and
 * matches what most gym apps show. Reps are capped at 12 for the estimate —
 * beyond that the formula over-predicts badly.
 */

export interface WorkingSet {
  weightKg: number;
  reps: number;
  isWarmup?: boolean;
}

export function epley1rm(weightKg: number, reps: number): number {
  if (weightKg <= 0 || reps <= 0) return 0;
  // A single is exactly the weight (the raw formula would add ~3%).
  if (reps === 1) return Math.round(weightKg * 10) / 10;
  const capped = Math.min(reps, 12);
  return Math.round(weightKg * (1 + capped / 30) * 10) / 10;
}

export function bestE1rm(sets: WorkingSet[]): number | null {
  let best: number | null = null;
  for (const s of sets) {
    if (s.isWarmup) continue;
    const value = epley1rm(s.weightKg, s.reps);
    if (value > 0 && (best == null || value > best)) best = value;
  }
  return best;
}

/** Tonnage: sum of weight × reps over working sets. */
export function totalVolume(sets: WorkingSet[]): number {
  return Math.round(
    sets.reduce((sum, s) => (s.isWarmup ? sum : sum + Math.max(0, s.weightKg) * Math.max(0, s.reps)), 0),
  );
}

export function relativeStrength(e1rmKg: number | null, bodyweightKg: number | null): number | null {
  if (e1rmKg == null || bodyweightKg == null || bodyweightKg <= 0) return null;
  return Math.round((e1rmKg / bodyweightKg) * 100) / 100;
}

/** A PR is any strictly better value than the best before it. */
export function isPr(previousBest: number | null, candidate: number): boolean {
  if (candidate <= 0) return false;
  return previousBest == null || candidate > previousBest + 0.01;
}

/** Percentage change between two values, null when the base is missing. */
export function pctChange(from: number | null, to: number | null): number | null {
  if (from == null || to == null || from === 0) return null;
  return Math.round(((to - from) / Math.abs(from)) * 1000) / 10;
}

/**
 * Smoothed percentage change between the medians of the first and second
 * halves of the e1RM series. A single noisy session (or a deload) can move one
 * endpoint, but not the median of a half. Requires at least three points.
 */
export function strengthTrendPct(e1rms: number[]): number | null {
  if (e1rms.length < 3) return null;
  const mid = Math.floor(e1rms.length / 2);
  const first = median(e1rms.slice(0, mid));
  const second = median(e1rms.slice(mid));
  if (first <= 0) return null;
  return Math.round(((second - first) / first) * 1000) / 10;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** A lift is "stalled" when its best of the last two sessions is below 98%
 *  of the best before them. Used by the progression and deload checks. */
export function isStalled(e1rms: number[]): boolean {
  if (e1rms.length < 4) return false;
  const priorBest = Math.max(...e1rms.slice(0, -2));
  const recentBest = Math.max(...e1rms.slice(-2));
  return recentBest < priorBest * 0.98;
}

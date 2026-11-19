/**
 * Plate maths for gyms whose plates are unlabelled.
 *
 * Two directions:
 *  - reverse: "I want 82.5 kg" → which plates go on each side
 *  - forward: "this is what's on the bar" → total weight
 *
 * Weights are converted to integer centi-units before the search so float
 * drift can never make 2.5 kg plates "not fit". The search is a bounded
 * knapsack over per-side sums (the state space is tiny: a few hundred sums).
 */

import { KG_PLATE_PRESET, LB_PLATE_PRESET, roundTo, type PlateDenom, type WeightUnit } from "./types";

export interface PlateStack {
  denom: PlateDenom;
  qty: number;
}

export interface PlateSolution {
  perSide: PlateStack[];
  perSideWeight: number;
  total: number;
  target: number;
  /** target − total. Positive means the bar is under the target. */
  diff: number;
  exact: boolean;
}

const toCenti = (n: number) => Math.round(n * 100);

/** Plates available for one side of the bar. A pair is one plate each side. */
function perSideCount(total: number): number {
  if (total <= 0) return 0;
  // A barbell needs a pair; an odd single plate cannot be balanced.
  return Math.floor(total / 2);
}

/**
 * Closest buildable weight to `targetTotal` using the available plates.
 * Prefers the closest weight; on a tie it prefers staying under the target
 * (you can always add a small plate, you cannot remove one you don't have).
 */
export function solvePlates(
  targetTotal: number,
  barWeight: number,
  denoms: PlateDenom[],
): PlateSolution | null {
  if (!Number.isFinite(targetTotal) || !Number.isFinite(barWeight)) return null;
  const targetC = toCenti(targetTotal);
  const barC = toCenti(barWeight);
  if (targetC < barC) return null;

  const perSideTarget = (targetC - barC) / 2;
  if (perSideTarget < 0) return null;

  const available = denoms
    .filter((d) => d.count > 0 && d.weight > 0)
    .map((d) => ({
      denom: d,
      weightC: toCenti(d.weight),
      max: perSideCount(d.count),
    }))
    .filter((d) => d.max > 0);

  if (available.length === 0) return null;

  // Bounded knapsack: sum (centi) -> fewest plates that reach it.
  let states = new Map<number, { count: number; picks: number[] }>();
  states.set(0, { count: 0, picks: new Array(available.length).fill(0) });

  // Prefer fewer plates; on a tie prefer the bigger plates (a lifter loads
  // 25 + 5 before 20 + 10, even though both weigh the same).
  const prefers = (a: { count: number; picks: number[] }, b: { count: number; picks: number[] }) => {
    if (a.count !== b.count) return a.count < b.count;
    for (let j = 0; j < a.picks.length; j++) {
      if (a.picks[j] !== b.picks[j]) return a.picks[j] > b.picks[j];
    }
    return false;
  };

  for (let i = 0; i < available.length; i++) {
    const { weightC, max } = available[i];
    const next = new Map(states);
    for (const [sum, st] of states) {
      for (let q = 1; q <= max; q++) {
        const nextSum = sum + weightC * q;
        const candidate = { count: st.count + q, picks: st.picks.slice() };
        candidate.picks[i] = q;
        const existing = next.get(nextSum);
        if (!existing || prefers(candidate, existing)) next.set(nextSum, candidate);
      }
    }
    states = next;
  }

  let bestSum = -1;
  let bestDiff = Number.POSITIVE_INFINITY;
  for (const sum of states.keys()) {
    const diff = Math.abs(sum - perSideTarget);
    const isOver = sum > perSideTarget;
    if (diff < bestDiff || (diff === bestDiff && !isOver && bestSum >= 0)) {
      bestDiff = diff;
      bestSum = sum;
    }
  }
  if (bestSum < 0) return null;

  const picked = states.get(bestSum)!;
  const perSide = available
    .map((a, i) => ({ denom: a.denom, qty: picked.picks[i] }))
    .filter((p) => p.qty > 0)
    .sort((a, b) => b.denom.weight - a.denom.weight);

  const perSideWeight = bestSum / 100;
  const total = (barC + bestSum * 2) / 100;

  return {
    perSide,
    perSideWeight,
    total: Math.round(total * 100) / 100,
    target: targetTotal,
    diff: Math.round((targetTotal - total) * 100) / 100,
    exact: Math.abs(targetTotal - total) < 0.005,
  };
}

/** Forward mode: what is the total when these plates are on the bar? */
export function totalFromPlates(
  perSide: { weight: number; qty: number }[],
  barWeight: number,
): number {
  return Math.round((barWeight + perSide.reduce((s, p) => s + p.weight * p.qty, 0) * 2) * 100) / 100;
}

/** "20 + 10 + 2.5 per side" */
export function formatPlates(solution: PlateSolution): string {
  if (solution.perSide.length === 0) return "bar only";
  return `${solution.perSide.map((p) => p.denom.label).join(" + ")} per side`;
}

/** Compact chips for the UI: [{label:"20", qty:1}, …] */
export function plateChips(solution: PlateSolution): { key: string; label: string; qty: number; color?: string }[] {
  return solution.perSide.map((p) => ({
    key: p.denom.id,
    label: p.denom.label,
    qty: p.qty,
    color: p.denom.color,
  }));
}

export function presetPlates(unit: WeightUnit): PlateDenom[] {
  return (unit === "lb" ? LB_PLATE_PRESET : KG_PLATE_PRESET).map((p) => ({ ...p }));
}

/**
 * A gym's unlabelled cable/machine stack: positions are pin holes, and the
 * user calibrates a few of them against a known weight. Linear interpolation
 * between the nearest calibration points; clamped at the ends.
 */
export interface StackCalibration {
  positionCount: number;
  points: { position: number; kg: number }[];
}

export function stackKg(position: number, stack: StackCalibration): number | null {
  const points = [...stack.points].sort((a, b) => a.position - b.position);
  if (points.length === 0) return null;
  if (points.length === 1) return points[0].kg;
  if (position <= points[0].position) return points[0].kg;
  const last = points[points.length - 1];
  if (position >= last.position) return last.kg;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (position <= b.position) {
      const t = (position - a.position) / Math.max(1, b.position - a.position);
      return Math.round((a.kg + (b.kg - a.kg) * t) * 10) / 10;
    }
  }
  return last.kg;
}

/** Round a working weight to the smallest plate pair the gym owns. */
export function roundToGymIncrement(weight: number, denoms: PlateDenom[]): number {
  const smallest = denoms
    .filter((d) => d.count >= 2 && d.weight > 0)
    .reduce((min, d) => Math.min(min, d.weight), Number.POSITIVE_INFINITY);
  if (!Number.isFinite(smallest)) return Math.round(weight * 10) / 10;
  return roundTo(weight, smallest);
}

/** Warm-up ramp: bar, then 40/60/80% of the working weight. */
export function warmupRamp(workingWeight: number, barWeight: number): { pct: number; weight: number; label: string }[] {
  const steps = [
    { pct: 0, weight: barWeight, label: "Bar" },
    { pct: 0.4, weight: Math.max(barWeight, workingWeight * 0.4), label: "40%" },
    { pct: 0.6, weight: Math.max(barWeight, workingWeight * 0.6), label: "60%" },
    { pct: 0.8, weight: Math.max(barWeight, workingWeight * 0.8), label: "80%" },
  ];
  const seen = new Set<number>();
  return steps.filter((s) => {
    const key = Math.round(s.weight * 100);
    if (seen.has(key) || s.weight >= workingWeight) return false;
    seen.add(key);
    return true;
  });
}

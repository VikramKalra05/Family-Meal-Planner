/**
 * Pure weight-tracking math: trend rate, target projection and progress.
 * All inputs are ascending (date asc) logs; no side effects, fully tested.
 */

export interface WeightPoint {
  /** ISO date (yyyy-mm-dd) */
  date: string;
  kg: number;
}

/**
 * Weekly trend in kg/week: mean of the second half of the recent window
 * minus mean of the first half (default 14 days → two 7-day halves).
 * Returns null when there aren't enough points on both sides.
 */
export function weightTrend(points: WeightPoint[], windowDays = 14): number | null {
  if (points.length < 4) return null;
  const recent = points.slice(-windowDays);
  const half = Math.floor(recent.length / 2);
  if (half < 2) return null;
  const first = recent.slice(0, half);
  const second = recent.slice(half);
  const mean = (arr: WeightPoint[]) => arr.reduce((s, p) => s + p.kg, 0) / arr.length;
  const perDay = (mean(second) - mean(first)) / Math.max(1, daysBetween(recent[0].date, recent[recent.length - 1].date) * (half / recent.length));
  return Math.round(perDay * 7 * 100) / 100;
}

/** Progress toward target: 0–100 (can exceed if overshot), null without a target. */
export function progressPct(points: WeightPoint[], targetKg: number | null): number | null {
  if (targetKg == null || points.length === 0) return null;
  const start = points[0].kg;
  const current = points[points.length - 1].kg;
  const total = targetKg - start;
  if (Math.abs(total) < 0.1) return 100;
  return Math.max(0, Math.min(100, Math.round(((current - start) / total) * 100)));
}

/**
 * Projected ISO date of hitting the target at the current trend.
 * "regressing" when the trend moves away from the target; null when
 * there's no meaningful trend or no target.
 */
export function projectTargetDate(
  points: WeightPoint[],
  targetKg: number | null,
  trendPerWeek: number | null,
): { eta: string; weeks: number } | "regressing" | null {
  if (targetKg == null || trendPerWeek == null || points.length === 0) return null;
  const current = points[points.length - 1].kg;
  const remaining = targetKg - current;
  if (Math.abs(remaining) < 0.1) return null;
  if (Math.abs(trendPerWeek) < 0.05) return null;
  if (Math.sign(trendPerWeek) !== Math.sign(remaining)) return "regressing";
  const weeks = Math.round((remaining / trendPerWeek) * 10) / 10;
  const eta = new Date(Date.now() + weeks * 7 * 24 * 3600 * 1000);
  return { eta: eta.toISOString().slice(0, 10), weeks };
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (24 * 3600 * 1000)));
}

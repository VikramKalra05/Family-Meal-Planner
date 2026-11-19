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

// ── Chart helpers ───────────────────────────────────────────────────────────

export type WeightRange = "7d" | "30d" | "90d" | "all";

export const WEIGHT_RANGES: { key: WeightRange; label: string; days: number | null }[] = [
  { key: "7d", label: "7D", days: 7 },
  { key: "30d", label: "30D", days: 30 },
  { key: "90d", label: "90D", days: 90 },
  { key: "all", label: "All", days: null },
];

/** Keeps points inside the trailing window ending on `todayISO` (inclusive). */
export function filterWeightRange(
  points: WeightPoint[],
  range: WeightRange,
  todayISO: string,
): WeightPoint[] {
  const days = WEIGHT_RANGES.find((r) => r.key === range)?.days ?? null;
  if (days == null) return points;
  const cutoff = Date.parse(todayISO) - (days - 1) * 86400000;
  return points.filter((p) => Date.parse(p.date) >= cutoff);
}

/**
 * Calendar trailing average (default 7 days), not a per-index window — so
 * missed weigh-ins don't shift the smoothing. Input must be ascending.
 */
export function movingAverage(points: WeightPoint[], windowDays = 7): WeightPoint[] {
  return points.map((point) => {
    const end = Date.parse(point.date);
    const start = end - (windowDays - 1) * 86400000;
    let sum = 0;
    let count = 0;
    for (const other of points) {
      const t = Date.parse(other.date);
      if (t < start) continue;
      if (t > end) break;
      sum += other.kg;
      count += 1;
    }
    return {
      date: point.date,
      kg: count > 0 ? Math.round((sum / count) * 100) / 100 : point.kg,
    };
  });
}

export interface WeightStats {
  /** Change from the first to the last visible log (kg). */
  delta: number;
  /** Change over the last 7 calendar days, null with a single point. */
  last7Delta: number | null;
  min: number;
  max: number;
}

export function weightStats(points: WeightPoint[]): WeightStats | null {
  if (points.length === 0) return null;
  const round1 = (n: number) => Math.round(n * 10) / 10;
  const first = points[0];
  const last = points[points.length - 1];
  const cutoff = Date.parse(last.date) - 7 * 86400000;
  const weekAgo = [...points].reverse().find((p) => Date.parse(p.date) <= cutoff) ?? first;
  const values = points.map((p) => p.kg);
  return {
    delta: round1(last.kg - first.kg),
    last7Delta: points.length > 1 ? round1(last.kg - weekAgo.kg) : null,
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

/** Human-friendly axis ticks (1/2/5 × 10^n steps). */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return [min];
  const raw = (max - min) / Math.max(1, count - 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(raw)));
  const normalized = raw / magnitude;
  const step =
    (normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10) * magnitude;
  const start = Math.ceil(min / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let value = start; value <= max + step * 1e-6; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

function daysBetween(a: string, b: string): number {
  return Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / (24 * 3600 * 1000)));
}

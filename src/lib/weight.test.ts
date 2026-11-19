import { describe, expect, it } from "vitest";
import {
  filterWeightRange,
  movingAverage,
  niceTicks,
  progressPct,
  projectTargetDate,
  weightStats,
  weightTrend,
  type WeightPoint,
} from "@/lib/weight";

const d = (offset: number) => {
  const date = new Date(Date.parse("2026-10-01") + offset * 24 * 3600 * 1000);
  return date.toISOString().slice(0, 10);
};

describe("weightTrend", () => {
  it("returns null with too few points", () => {
    expect(weightTrend([{ date: d(0), kg: 70 }])).toBeNull();
  });

  it("detects a steady loss rate", () => {
    // 70 → 68.6 over 14 days = −0.7 kg/week
    const points: WeightPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: d(i),
      kg: 70 - i * 0.1,
    }));
    const trend = weightTrend(points);
    expect(trend).toBeLessThan(0);
    expect(Math.abs(trend! + 0.7)).toBeLessThan(0.15);
  });

  it("detects a bulk gain", () => {
    const points: WeightPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: d(i),
      kg: 69 + i * 0.1,
    }));
    expect(weightTrend(points)).toBeGreaterThan(0);
  });

  it("returns ~0 for stable weight", () => {
    const points: WeightPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: d(i),
      kg: 70 + (i % 2 === 0 ? 0.2 : -0.2),
    }));
    expect(Math.abs(weightTrend(points)!)).toBeLessThan(0.2);
  });
});

describe("progressPct", () => {
  it("computes cut progress", () => {
    const points = [
      { date: d(0), kg: 80 },
      { date: d(10), kg: 75 },
    ];
    expect(progressPct(points, 70)).toBe(50);
  });

  it("computes bulk progress in the other direction", () => {
    const points = [
      { date: d(0), kg: 60 },
      { date: d(10), kg: 65 },
    ];
    expect(progressPct(points, 70)).toBe(50);
  });

  it("clamps overshoot and returns 100 at target", () => {
    const points = [
      { date: d(0), kg: 80 },
      { date: d(10), kg: 69 },
    ];
    expect(progressPct(points, 70)).toBe(100);
  });

  it("returns null without a target", () => {
    expect(progressPct([{ date: d(0), kg: 70 }], null)).toBeNull();
  });
});

describe("projectTargetDate", () => {
  const losing: WeightPoint[] = Array.from({ length: 14 }, (_, i) => ({
    date: d(i),
    kg: 70 - i * 0.1,
  }));

  it("projects an eta when moving toward the target", () => {
    const result = projectTargetDate(losing, 68, -0.7);
    expect(result).not.toBe("regressing");
    expect(result).not.toBeNull();
    if (result && result !== "regressing") {
      expect(result.weeks).toBeGreaterThan(0);
      expect(result.weeks).toBeLessThan(52);
      expect(result.eta).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("flags a trend moving away from the target", () => {
    const gaining: WeightPoint[] = Array.from({ length: 14 }, (_, i) => ({
      date: d(i),
      kg: 69 + i * 0.1,
    }));
    expect(projectTargetDate(gaining, 68, 0.7)).toBe("regressing");
  });

  it("returns null for a flat trend", () => {
    expect(projectTargetDate(losing, 68, 0)).toBeNull();
  });

  it("returns null when target already reached", () => {
    expect(projectTargetDate([{ date: d(0), kg: 68 }], 68, -0.5)).toBeNull();
  });
});

describe("filterWeightRange", () => {
  const points: WeightPoint[] = [
    { date: d(0), kg: 72 },
    { date: d(10), kg: 71 },
    { date: d(40), kg: 70 },
    { date: d(100), kg: 69 },
  ];

  it("keeps only the trailing window (inclusive of today)", () => {
    expect(filterWeightRange(points, "30d", d(100))).toEqual([{ date: d(100), kg: 69 }]);
    expect(filterWeightRange(points, "90d", d(100))).toEqual([{ date: d(40), kg: 70 }, { date: d(100), kg: 69 }]);
  });

  it("returns everything for All", () => {
    expect(filterWeightRange(points, "all", d(100))).toHaveLength(4);
  });
});

describe("movingAverage", () => {
  it("averages by calendar window, not by point index", () => {
    const points: WeightPoint[] = [
      { date: d(0), kg: 70 },
      { date: d(1), kg: 71 },
      { date: d(20), kg: 72 }, // far gap: this window holds only itself
    ];
    const avg = movingAverage(points, 7);
    expect(avg[0].kg).toBe(70);
    expect(avg[1].kg).toBe(70.5);
    expect(avg[2].kg).toBe(72);
  });

  it("keeps every input date", () => {
    const points: WeightPoint[] = [
      { date: d(0), kg: 70 },
      { date: d(3), kg: 69 },
    ];
    expect(movingAverage(points).map((p) => p.date)).toEqual(points.map((p) => p.date));
  });
});

describe("weightStats", () => {
  it("computes the range delta, 7-day delta and min/max", () => {
    const points: WeightPoint[] = Array.from({ length: 11 }, (_, i) => ({
      date: d(i * 3),
      kg: 72 - i * 0.2,
    }));
    const stats = weightStats(points);
    expect(stats).not.toBeNull();
    expect(stats!.delta).toBe(-2);
    expect(stats!.min).toBe(70);
    expect(stats!.max).toBe(72);
    expect(stats!.last7Delta).toBeLessThan(0);
  });

  it("returns null for an empty range", () => {
    expect(weightStats([])).toBeNull();
  });
});

describe("niceTicks", () => {
  it("produces clean ascending ticks inside the domain", () => {
    const ticks = niceTicks(68.2, 72.1, 5);
    expect(ticks).toEqual([69, 70, 71, 72]);
  });

  it("handles a flat or invalid domain", () => {
    expect(niceTicks(70, 70)).toEqual([70]);
    expect(niceTicks(Number.NaN, 3)).toEqual([Number.NaN]);
  });
});

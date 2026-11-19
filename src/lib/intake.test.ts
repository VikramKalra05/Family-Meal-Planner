import { describe, expect, it } from "vitest";
import {
  groupBySlot,
  macroContributions,
  pctOf,
  remaining,
  shiftISO,
  targetsToTotals,
  toIntakeItem,
  totals,
  type IntakeItem,
} from "@/lib/intake";

const item = (over: Partial<IntakeItem>): IntakeItem => ({
  id: Math.random().toString(36).slice(2),
  logged_on: "2026-11-19",
  slot: "breakfast",
  description: "Poha",
  kcal: 250,
  protein_g: 5,
  carbs_g: 45,
  fat_g: 8,
  fiber_g: 3,
  source: "manual",
  ...over,
});

describe("toIntakeItem", () => {
  it("coerces numeric strings from Supabase", () => {
    const row = toIntakeItem({
      id: "x",
      logged_on: "2026-11-19",
      slot: "lunch",
      description: "Dal",
      kcal: "180",
      protein_g: "9.4",
      carbs_g: "28",
      fat_g: "2.1",
      fiber_g: null,
      source: "ai_chat",
    });
    expect(row.kcal).toBe(180);
    expect(row.protein_g).toBe(9.4);
    expect(row.fiber_g).toBeNull();
  });

  it("treats a null slot as unslotted (grouped with snacks)", () => {
    const row = toIntakeItem({
      id: "x",
      logged_on: "2026-11-19",
      slot: null,
      description: "Chai",
      kcal: 60,
      protein_g: 2,
      carbs_g: 8,
      fat_g: 2,
      fiber_g: 0,
      source: "manual",
    });
    expect(row.slot).toBeNull();
    expect(groupBySlot([row]).find((g) => g.slot === "snack")?.items).toHaveLength(1);
  });
});

describe("totals", () => {
  it("sums every macro across items", () => {
    const sum = totals([
      item({ kcal: 250, protein_g: 5, carbs_g: 45, fat_g: 8, fiber_g: 3 }),
      item({ kcal: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, fiber_g: null }),
    ]);
    expect(sum).toEqual({ kcal: 370, protein: 29, carbs: 48, fat: 9.5, fiber: 3 });
  });

  it("returns zeroes for an empty day", () => {
    expect(totals([])).toEqual({ kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 });
  });
});

describe("targetsToTotals", () => {
  it("renames engine fields to diary fields", () => {
    expect(
      targetsToTotals({ kcal: 2000, proteinG: 120, carbsG: 200, fatG: 60, fiberG: 30 }),
    ).toEqual({ kcal: 2000, protein: 120, carbs: 200, fat: 60, fiber: 30 });
    expect(targetsToTotals(null)).toBeNull();
  });
});

describe("groupBySlot", () => {
  it("returns all four slots in meal order", () => {
    const groups = groupBySlot([
      item({ slot: "dinner", description: "Roti" }),
      item({ slot: "breakfast", description: "Poha" }),
      item({ slot: "breakfast", description: "Chai", kcal: 60 }),
    ]);
    expect(groups.map((g) => g.slot)).toEqual(["breakfast", "lunch", "snack", "dinner"]);
    expect(groups[0].items).toHaveLength(2);
    expect(groups[0].totals.kcal).toBe(310);
    expect(groups[1].items).toHaveLength(0);
  });
});

describe("macroContributions", () => {
  it("ranks foods by share of a macro and merges duplicates", () => {
    const contributions = macroContributions(
      [
        item({ description: "Roti", protein_g: 3 }),
        item({ description: "Roti", protein_g: 3 }),
        item({ description: "Paneer", protein_g: 18 }),
        item({ description: "Dal", protein_g: 9 }),
      ],
      "protein",
      2,
    );
    expect(contributions).toHaveLength(2);
    expect(contributions[0]).toEqual({ description: "Paneer", value: 18, pct: 55 });
    expect(contributions[1]).toEqual({ description: "Dal", value: 9, pct: 27 });
  });

  it("ignores zero contributors and handles an empty day", () => {
    expect(macroContributions([item({ protein_g: 0 })], "protein")).toEqual([]);
    expect(macroContributions([], "fiber")).toEqual([]);
  });

  it("reads the fiber column safely when null", () => {
    const result = macroContributions(
      [item({ description: "Salad", fiber_g: 6 }), item({ description: "Chai", fiber_g: null })],
      "fiber",
    );
    expect(result[0]).toEqual({ description: "Salad", value: 6, pct: 100 });
  });
});

describe("progress helpers", () => {
  it("clamps bar percentages", () => {
    expect(pctOf(100, 2000)).toBe(5);
    expect(pctOf(3000, 2000)).toBe(100);
    expect(pctOf(100, null)).toBe(0);
  });

  it("reports remaining kcal, negative when over", () => {
    expect(remaining(1200, 2000)).toBe(800);
    expect(remaining(2200, 2000)).toBe(-200);
    expect(remaining(100, null)).toBeNull();
  });

  it("shifts ISO dates across month boundaries", () => {
    expect(shiftISO("2026-11-19", -1)).toBe("2026-11-18");
    expect(shiftISO("2026-12-01", -1)).toBe("2026-11-30");
    expect(shiftISO("2026-02-28", 1)).toBe("2026-03-01");
  });
});

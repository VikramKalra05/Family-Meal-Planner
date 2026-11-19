/**
 * Pure helpers for the food diary. Rows arrive from Supabase with numeric
 * columns serialised as strings, so everything is normalised here once and
 * the UI/tests work with plain numbers.
 */

import type { MealSlot } from "@/lib/db-types";
import type { NutrientTargets } from "@/lib/nutrition/types";

export interface IntakeItem {
  id: string;
  logged_on: string;
  slot: MealSlot | null;
  description: string | null;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  source: string;
  created_at?: string;
}

/** Loose shape Supabase returns (numerics may be strings). */
export interface IntakeRow {
  id: string;
  logged_on: string;
  slot: string | null;
  description: string | null;
  kcal: number | string;
  protein_g: number | string;
  carbs_g: number | string;
  fat_g: number | string;
  fiber_g: number | string | null;
  source: string;
  created_at?: string;
}

export interface MacroTotals {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type MacroKey = Exclude<keyof MacroTotals, "kcal">;

export const SLOT_ORDER: MealSlot[] = ["breakfast", "lunch", "snack", "dinner"];

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snack: "Snacks",
  dinner: "Dinner",
};

const num = (v: number | string | null | undefined): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Normalises a Supabase row; rows with a null slot are bucketed as snacks. */
export function toIntakeItem(row: IntakeRow): IntakeItem {
  return {
    id: row.id,
    logged_on: row.logged_on,
    slot: (row.slot as MealSlot | null) ?? null,
    description: row.description,
    kcal: num(row.kcal),
    protein_g: num(row.protein_g),
    carbs_g: num(row.carbs_g),
    fat_g: num(row.fat_g),
    fiber_g: row.fiber_g == null ? null : num(row.fiber_g),
    source: row.source,
    created_at: row.created_at,
  };
}

export function totals(items: IntakeItem[]): MacroTotals {
  return items.reduce<MacroTotals>(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein: acc.protein + item.protein_g,
      carbs: acc.carbs + item.carbs_g,
      fat: acc.fat + item.fat_g,
      fiber: acc.fiber + (item.fiber_g ?? 0),
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
  );
}

/** Maps engine targets (…G names) to the diary's totals shape. */
export function targetsToTotals(targets: NutrientTargets | null | undefined): MacroTotals | null {
  if (!targets) return null;
  return {
    kcal: targets.kcal,
    protein: targets.proteinG,
    carbs: targets.carbsG,
    fat: targets.fatG,
    fiber: targets.fiberG,
  };
}

export interface SlotGroup {
  slot: MealSlot;
  items: IntakeItem[];
  totals: MacroTotals;
}

/** Groups items into the four meal slots, always in breakfast→dinner order. */
export function groupBySlot(items: IntakeItem[]): SlotGroup[] {
  return SLOT_ORDER.map((slot) => {
    const inSlot = items.filter((item) => (item.slot ?? "snack") === slot);
    return { slot, items: inSlot, totals: totals(inSlot) };
  });
}

export interface MacroContribution {
  description: string;
  value: number;
  /** Share of the day's total for that macro, 0–100. */
  pct: number;
}

/**
 * Top contributors to one macro (HealthifyMe's "analysis" view). Duplicate
 * descriptions are merged so "roti" logged twice reads as one line.
 */
export function macroContributions(
  items: IntakeItem[],
  macro: MacroKey,
  limit = 3,
): MacroContribution[] {
  const field = `${macro}_g` as const;
  const byName = new Map<string, number>();
  for (const item of items) {
    const raw = macro === "fiber" ? item.fiber_g ?? 0 : item[field] ?? 0;
    if (raw <= 0) continue;
    const name = item.description?.trim() || "Unnamed item";
    byName.set(name, (byName.get(name) ?? 0) + raw);
  }
  const dayTotal = [...byName.values()].reduce((s, v) => s + v, 0);
  return [...byName.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([description, value]) => ({
      description,
      value: Math.round(value * 10) / 10,
      pct: dayTotal > 0 ? Math.round((value / dayTotal) * 100) : 0,
    }));
}

/** Clamped percentage for progress bars. */
export function pctOf(value: number, target: number | null | undefined): number {
  if (target == null || target <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((value / target) * 100)));
}

/** Negative = over budget. Null when no target is known. */
export function remaining(value: number, target: number | null | undefined): number | null {
  if (target == null || target <= 0) return null;
  return Math.round(target - value);
}

/** ISO 'YYYY-MM-DD' shifted by whole days, UTC-safe for date-only strings. */
export function shiftISO(date: string, days: number): string {
  return new Date(Date.parse(date) + days * 86400000).toISOString().slice(0, 10);
}

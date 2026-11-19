/**
 * Gym domain vocabulary. Pure types and labels — no database or React
 * imports, so the same code runs in the browser (offline logging), on the
 * server (actions + assistant), and in vitest.
 */

export const MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "core",
  "full_body",
] as const;
export type Muscle = (typeof MUSCLES)[number];

export const MUSCLE_LABELS: Record<Muscle, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  biceps: "Biceps",
  triceps: "Triceps",
  forearms: "Forearms",
  quads: "Quads",
  hamstrings: "Hamstrings",
  glutes: "Glutes",
  calves: "Calves",
  core: "Core",
  full_body: "Full body",
};

export const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "smith",
  "bodyweight",
  "kettlebell",
  "band",
  "cardio",
  "other",
] as const;
export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  smith: "Smith machine",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell",
  band: "Band",
  cardio: "Cardio",
  other: "Other",
};

export const PATTERNS = [
  "horizontal_push",
  "vertical_push",
  "horizontal_pull",
  "vertical_pull",
  "squat",
  "hinge",
  "lunge",
  "isolation",
  "carry",
  "core",
  "cardio",
] as const;
export type Pattern = (typeof PATTERNS)[number];

export const PATTERN_LABELS: Record<Pattern, string> = {
  horizontal_push: "Horizontal push",
  vertical_push: "Vertical push",
  horizontal_pull: "Horizontal pull",
  vertical_pull: "Vertical pull",
  squat: "Squat",
  hinge: "Hinge",
  lunge: "Lunge",
  isolation: "Isolation",
  carry: "Carry",
  core: "Core",
  cardio: "Cardio",
};

export const WEIGHT_UNITS = ["kg", "lb"] as const;
export type WeightUnit = (typeof WEIGHT_UNITS)[number];

/** 0 = Monday … 6 = Sunday, matching `mondayOf()` in the planner. */
export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function weekdayIndex(dateISO: string): number {
  const d = new Date(`${dateISO}T00:00:00Z`);
  return (d.getUTCDay() + 6) % 7;
}

export function addDays(dateISO: string, days: number): string {
  return new Date(Date.parse(`${dateISO}T00:00:00Z`) + days * 86_400_000)
    .toISOString()
    .slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000,
  );
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

export function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step;
}

/** A plate denomination as the user's gym actually stocks it. */
export interface PlateDenom {
  id: string;
  /** Short label shown in the picker, e.g. "25" or "big red". */
  label: string;
  /** Weight of one plate in the gym's unit. */
  weight: number;
  /** How many of these the gym has (total, both sides). */
  count: number;
  color?: string;
}

export interface GymConfig {
  unit: WeightUnit;
  barWeight: number;
  plates: PlateDenom[];
  /** e.g. Olympic bar, EZ bar, trap bar. */
  bars: { id: string; label: string; weight: number }[];
  trainingDays: number[];
}

/**
 * A machine's weight stack is often unlabelled too. Positions are the pin
 * holes; `calibration` maps a few known positions to kg so the app can
 * interpolate the rest.
 */
export interface MachineStack {
  /** Stable id from the equipment catalogue. */
  equipmentId: string;
  label: string;
  positionCount: number;
  calibration: { position: number; kg: number }[];
}

export const KG_PLATE_PRESET: PlateDenom[] = [
  { id: "kg-25", label: "25", weight: 25, count: 2, color: "red" },
  { id: "kg-20", label: "20", weight: 20, count: 2, color: "blue" },
  { id: "kg-15", label: "15", weight: 15, count: 2, color: "yellow" },
  { id: "kg-10", label: "10", weight: 10, count: 4, color: "green" },
  { id: "kg-5", label: "5", weight: 5, count: 4, color: "white" },
  { id: "kg-2.5", label: "2.5", weight: 2.5, count: 2, color: "red" },
  { id: "kg-1.25", label: "1.25", weight: 1.25, count: 2, color: "chrome" },
];

export const LB_PLATE_PRESET: PlateDenom[] = [
  { id: "lb-45", label: "45", weight: 45, count: 2, color: "red" },
  { id: "lb-35", label: "35", weight: 35, count: 2, color: "blue" },
  { id: "lb-25", label: "25", weight: 25, count: 2, color: "yellow" },
  { id: "lb-10", label: "10", weight: 10, count: 4, color: "green" },
  { id: "lb-5", label: "5", weight: 5, count: 4, color: "white" },
  { id: "lb-2.5", label: "2.5", weight: 2.5, count: 2, color: "chrome" },
];

export const KG_BARS = [
  { id: "olympic", label: "Olympic bar", weight: 20 },
  { id: "womens", label: "Women's bar", weight: 15 },
  { id: "ez", label: "EZ bar", weight: 10 },
  { id: "trap", label: "Trap bar", weight: 25 },
  { id: "short", label: "Short bar", weight: 7.5 },
];

export const LB_BARS = [
  { id: "olympic", label: "Olympic bar", weight: 45 },
  { id: "womens", label: "Women's bar", weight: 35 },
  { id: "ez", label: "EZ bar", weight: 25 },
  { id: "trap", label: "Trap bar", weight: 55 },
];

export type Goal = "weight_loss" | "maintenance" | "muscle_gain";

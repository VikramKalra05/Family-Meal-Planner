/**
 * Program templates and the equipment-aware builder.
 *
 * A template is a list of days; each exercise carries a stable seed key and
 * a prescription. When the user's gym lacks the equipment, the exercise is
 * dropped rather than replaced with something unsafe or impossible. If a
 * day loses too many movements, the builder falls back to bodyweight picks.
 */

import { SEED_EXERCISES, type ExerciseView, type SeedExercise } from "@/data/seed-exercises";
import type { Muscle } from "./types";

export interface TemplateExercise {
  exerciseKey: string;
  sets: number;
  repMin: number;
  repMax: number;
  incrementKg: number;
}

export interface TemplateDay {
  name: string;
  focus: Muscle[];
  exercises: TemplateExercise[];
}

export interface ProgramTemplate {
  id: string;
  name: string;
  description: string;
  daysPerWeek: number;
  days: TemplateDay[];
}

const ex = (key: string, sets = 3, repMin = 8, repMax = 12, incrementKg = 2.5): TemplateExercise => ({
  exerciseKey: key,
  sets,
  repMin,
  repMax,
  incrementKg,
});

export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: "full_body_3",
    name: "Full body · 3 days",
    description: "Three full-body sessions a week. The best starting point if you can train 3 days.",
    daysPerWeek: 3,
    days: [
      {
        name: "Full body A",
        focus: ["quads", "chest", "back"],
        exercises: [
          ex("seed:back-squat", 3, 5, 8, 5),
          ex("seed:bench-press", 3, 6, 10),
          ex("seed:barbell-row", 3, 6, 10),
          ex("seed:lateral-raise", 2, 12, 15, 1.25),
          ex("seed:dead-bug", 3, 10, 15, 0),
        ],
      },
      {
        name: "Full body B",
        focus: ["hamstrings", "shoulders", "back"],
        exercises: [
          ex("seed:deadlift", 3, 3, 5, 5),
          ex("seed:overhead-press", 3, 5, 8),
          ex("seed:lat-pulldown", 3, 8, 12, 5),
          ex("seed:leg-extension", 2, 12, 15, 5),
          ex("seed:face-pull", 2, 12, 15, 1.25),
        ],
      },
      {
        name: "Full body C",
        focus: ["quads", "chest", "back"],
        exercises: [
          ex("seed:leg-press", 3, 10, 15, 10),
          ex("seed:dumbbell-bench-press", 3, 8, 12, 2),
          ex("seed:seated-cable-row", 3, 8, 12, 5),
          ex("seed:dumbbell-curl", 2, 10, 15, 1),
          ex("seed:cable-pushdown", 2, 10, 15, 2.5),
        ],
      },
    ],
  },
  {
    id: "upper_lower_4",
    name: "Upper / lower · 4 days",
    description: "Two upper and two lower sessions. The classic strength-and-size split.",
    daysPerWeek: 4,
    days: [
      {
        name: "Upper A",
        focus: ["chest", "back", "shoulders"],
        exercises: [
          ex("seed:bench-press", 4, 5, 8, 2.5),
          ex("seed:barbell-row", 4, 6, 10, 2.5),
          ex("seed:overhead-press", 3, 6, 10, 2.5),
          ex("seed:lat-pulldown", 3, 8, 12, 5),
          ex("seed:lateral-raise", 3, 12, 15, 1.25),
          ex("seed:cable-pushdown", 2, 10, 15, 2.5),
        ],
      },
      {
        name: "Lower A",
        focus: ["quads", "hamstrings", "glutes"],
        exercises: [
          ex("seed:back-squat", 4, 5, 8, 5),
          ex("seed:romanian-deadlift", 3, 8, 10, 5),
          ex("seed:leg-press", 3, 10, 15, 10),
          ex("seed:lying-leg-curl", 3, 10, 15, 5),
          ex("seed:standing-calf-raise", 3, 12, 15, 5),
          ex("seed:dead-bug", 3, 10, 15, 0),
        ],
      },
      {
        name: "Upper B",
        focus: ["chest", "back", "shoulders"],
        exercises: [
          ex("seed:incline-dumbbell-press", 4, 8, 12, 2),
          ex("seed:pull-up", 4, 6, 10, 2.5),
          ex("seed:dumbbell-shoulder-press", 3, 8, 12, 2),
          ex("seed:seated-cable-row", 3, 8, 12, 5),
          ex("seed:cable-fly", 2, 12, 15, 2.5),
          ex("seed:barbell-curl", 2, 10, 15, 2.5),
        ],
      },
      {
        name: "Lower B",
        focus: ["hamstrings", "glutes", "quads"],
        exercises: [
          ex("seed:deadlift", 3, 3, 5, 5),
          ex("seed:front-squat", 3, 5, 8, 5),
          ex("seed:bulgarian-split-squat", 3, 8, 12, 2),
          ex("seed:seated-leg-curl", 3, 10, 15, 5),
          ex("seed:seated-calf-raise", 3, 12, 15, 5),
          ex("seed:hanging-leg-raise", 3, 8, 15, 0),
        ],
      },
    ],
  },
  {
    id: "ppl_3",
    name: "Push / pull / legs · 3 days",
    description: "One push, one pull and one leg day each week. Easy to run 3 or 6 days.",
    daysPerWeek: 3,
    days: [
      {
        name: "Push",
        focus: ["chest", "shoulders", "triceps"],
        exercises: [
          ex("seed:bench-press", 4, 5, 8, 2.5),
          ex("seed:overhead-press", 3, 6, 10, 2.5),
          ex("seed:incline-dumbbell-press", 3, 8, 12, 2),
          ex("seed:lateral-raise", 3, 12, 15, 1.25),
          ex("seed:cable-pushdown", 3, 10, 15, 2.5),
          ex("seed:overhead-triceps-extension", 2, 10, 15, 2),
        ],
      },
      {
        name: "Pull",
        focus: ["back", "biceps"],
        exercises: [
          ex("seed:deadlift", 3, 3, 5, 5),
          ex("seed:barbell-row", 4, 6, 10, 2.5),
          ex("seed:lat-pulldown", 3, 8, 12, 5),
          ex("seed:seated-cable-row", 3, 8, 12, 5),
          ex("seed:face-pull", 3, 12, 15, 1.25),
          ex("seed:barbell-curl", 3, 8, 12, 2.5),
        ],
      },
      {
        name: "Legs",
        focus: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          ex("seed:back-squat", 4, 5, 8, 5),
          ex("seed:romanian-deadlift", 3, 8, 10, 5),
          ex("seed:leg-press", 3, 10, 15, 10),
          ex("seed:leg-extension", 3, 12, 15, 5),
          ex("seed:lying-leg-curl", 3, 10, 15, 5),
          ex("seed:standing-calf-raise", 4, 12, 15, 5),
        ],
      },
    ],
  },
  {
    id: "bro_split_5",
    name: "Body-part split · 5 days",
    description: "One body part per day. More volume per muscle, more days in the gym.",
    daysPerWeek: 5,
    days: [
      {
        name: "Chest",
        focus: ["chest", "triceps"],
        exercises: [
          ex("seed:bench-press", 4, 6, 10, 2.5),
          ex("seed:incline-dumbbell-press", 3, 8, 12, 2),
          ex("seed:cable-fly", 3, 12, 15, 2.5),
          ex("seed:pec-deck-fly", 3, 12, 15, 5),
          ex("seed:push-up", 2, 15, 25, 0),
        ],
      },
      {
        name: "Back",
        focus: ["back", "biceps"],
        exercises: [
          ex("seed:deadlift", 3, 3, 5, 5),
          ex("seed:barbell-row", 4, 6, 10, 2.5),
          ex("seed:lat-pulldown", 3, 8, 12, 5),
          ex("seed:seated-cable-row", 3, 8, 12, 5),
          ex("seed:straight-arm-pulldown", 3, 12, 15, 2.5),
          ex("seed:barbell-shrug", 3, 10, 15, 5),
        ],
      },
      {
        name: "Shoulders",
        focus: ["shoulders", "triceps"],
        exercises: [
          ex("seed:overhead-press", 4, 5, 8, 2.5),
          ex("seed:dumbbell-shoulder-press", 3, 8, 12, 2),
          ex("seed:lateral-raise", 4, 12, 15, 1.25),
          ex("seed:reverse-pec-deck", 3, 12, 15, 5),
          ex("seed:upright-row", 2, 10, 15, 2.5),
        ],
      },
      {
        name: "Arms",
        focus: ["biceps", "triceps"],
        exercises: [
          ex("seed:barbell-curl", 3, 8, 12, 2.5),
          ex("seed:hammer-curl", 3, 10, 15, 2),
          ex("seed:preacher-curl", 2, 10, 15, 2.5),
          ex("seed:close-grip-bench", 3, 6, 10, 2.5),
          ex("seed:skull-crusher", 3, 10, 15, 2.5),
          ex("seed:cable-pushdown", 2, 10, 15, 2.5),
        ],
      },
      {
        name: "Legs",
        focus: ["quads", "hamstrings", "glutes", "calves"],
        exercises: [
          ex("seed:back-squat", 4, 5, 8, 5),
          ex("seed:romanian-deadlift", 3, 8, 10, 5),
          ex("seed:leg-press", 3, 10, 15, 10),
          ex("seed:leg-extension", 3, 12, 15, 5),
          ex("seed:lying-leg-curl", 3, 10, 15, 5),
          ex("seed:standing-calf-raise", 4, 12, 15, 5),
        ],
      },
    ],
  },
  {
    id: "home_dumbbell_3",
    name: "Home dumbbell · 3 days",
    description: "Dumbbells, a bench and a pull-up bar. Built for a home setup.",
    daysPerWeek: 3,
    days: [
      {
        name: "Home A",
        focus: ["quads", "chest", "back"],
        exercises: [
          ex("seed:goblet-squat", 3, 10, 15, 2),
          ex("seed:dumbbell-bench-press", 3, 8, 12, 2),
          ex("seed:one-arm-dumbbell-row", 3, 8, 12, 2),
          ex("seed:lateral-raise", 3, 12, 15, 1.25),
          ex("seed:dead-bug", 3, 10, 15, 0),
        ],
      },
      {
        name: "Home B",
        focus: ["hamstrings", "shoulders", "back"],
        exercises: [
          ex("seed:dumbbell-romanian-deadlift", 3, 8, 12, 2),
          ex("seed:dumbbell-shoulder-press", 3, 8, 12, 2),
          ex("seed:chin-up", 3, 5, 10, 2.5),
          ex("seed:dumbbell-curl", 2, 10, 15, 1),
          ex("seed:plank", 3, 30, 45, 0),
        ],
      },
      {
        name: "Home C",
        focus: ["quads", "chest", "core"],
        exercises: [
          ex("seed:walking-lunge", 3, 10, 12, 2),
          ex("seed:push-up", 3, 10, 20, 0),
          ex("seed:one-arm-dumbbell-row", 3, 8, 12, 2),
          ex("seed:lateral-raise", 3, 12, 15, 1.25),
          ex("seed:russian-twist", 3, 10, 15, 0),
        ],
      },
    ],
  },
];

export function templateById(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find((t) => t.id === id);
}

/** Alias rules: a cable crossover satisfies "cable"; an adjustable bench can
 *  be set flat. Everything else must be present by id. */
export function hasEquipment(available: Set<string>, required: string): boolean {
  if (available.has(required)) return true;
  if (required === "cable") return available.has("crossover") || available.has("cable");
  if (required === "bench-flat") return available.has("bench-flat") || available.has("bench-adjustable");
  return false;
}

export function exerciseAvailable(exercise: SeedExercise, available: string[]): boolean {
  if (available.length === 0) return true;
  const set = new Set(available);
  return exercise.equipmentIds.every((id) => hasEquipment(set, id));
}

export function availableExercises(available: string[]): ExerciseView[] {
  return SEED_EXERCISES.filter((e) => exerciseAvailable(e, available)).map((e) => ({
    key: e.key,
    name: e.name,
    aliases: e.aliases,
    primary: e.primary,
    secondary: e.secondary,
    equipment: e.equipment,
    pattern: e.pattern,
    unilateral: e.unilateral ?? false,
    equipmentIds: e.equipmentIds,
    instructions: e.instructions,
    tip: e.tip,
    custom: false,
  }));
}

export interface BuiltDay {
  name: string;
  focus: Muscle[];
  exercises: TemplateExercise[];
}

export interface BuiltProgram {
  templateId: string;
  name: string;
  days: BuiltDay[];
}

/**
 * Filter a template to the user's equipment. If a day would become empty,
 * keep the day with bodyweight movements so the plan still has a shape.
 */
export function buildProgram(template: ProgramTemplate, equipmentIds: string[]): BuiltProgram {
  const available = new Set(equipmentIds);
  const byKey = new Map(SEED_EXERCISES.map((e) => [e.key, e]));
  const bodyweightFallback = SEED_EXERCISES.filter((e) => e.equipmentIds.length === 0).map((e) => e.key);

  const days = template.days.map((day) => {
    const kept = day.exercises.filter((t) => {
      const seed = byKey.get(t.exerciseKey);
      if (!seed) return false;
      if (equipmentIds.length === 0) return true;
      return seed.equipmentIds.every((id) => hasEquipment(available, id));
    });
    if (kept.length >= 3) {
      return { name: day.name, focus: day.focus, exercises: kept };
    }
    const fallback = bodyweightFallback
      .filter((key) => !kept.some((k) => k.exerciseKey === key))
      .slice(0, 5 - kept.length)
      .map((key) => ex(key, 3, 10, 15, 0));
    return { name: day.name, focus: day.focus, exercises: [...kept, ...fallback] };
  });

  return { templateId: template.id, name: template.name, days };
}

/**
 * Which program day belongs to a calendar date. Training days are weekdays
 * (0 = Monday); the program's days map onto them in order. A date that is
 * not a training day returns null — rest is part of the plan.
 */
export function programDayForDate<T>(
  programDays: T[],
  trainingDays: number[],
  weekday: number,
): T | null {
  if (programDays.length === 0) return null;
  const sorted = [...trainingDays].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b);
  const index = sorted.indexOf(weekday);
  if (index === -1) return null;
  return programDays[index % programDays.length];
}

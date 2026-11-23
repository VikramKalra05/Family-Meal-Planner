/**
 * Request-scoped gym reads. Pages call these instead of repeating Supabase
 * queries; React's `cache` dedupes them within one render (the gym page and
 * the Today card both ask for the same program).
 *
 * All functions are read-only. Writes live in `src/app/(app)/gym/actions.ts`
 * and the batch sync route.
 */

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";
import type {
  BodyMeasurement,
  CustomExercise,
  Gym,
  Program,
  ProgramDay,
  ProgramExercise,
  ProgressPhoto,
  SetLog,
  StreakFreeze,
  WorkoutSession,
} from "@/lib/db-types";
import type { NutrientTargets } from "@/lib/nutrition/types";
import type { Profile } from "@/lib/db-types";
import { applyCalorieAdjustment, calorieFloorFor, dayFuel, type DayFuel } from "./fuel";
import { availableExercises, programDayForDate } from "./program";
import { computeStreak, type StreakResult } from "./streak";
import { weekdayIndex } from "./types";
import { SEED_EXERCISES, type ExerciseView } from "@/data/seed-exercises";

export interface ProgramWithDays extends Program {
  days: (ProgramDay & { exercises: ProgramExercise[] })[];
}

export const getGym = cache(async (memberId: string): Promise<Gym | null> => {
  const supabase = await createClient();
  const { data } = await supabase.from("gyms").select("*").eq("member_id", memberId).maybeSingle();
  return (data as Gym | null) ?? null;
});

export const getActiveProgram = cache(async (memberId: string): Promise<ProgramWithDays | null> => {
  const supabase = await createClient();
  const { data: program } = await supabase
    .from("programs")
    .select("*")
    .eq("member_id", memberId)
    .eq("is_active", true)
    .maybeSingle();
  if (!program) return null;

  const { data: days } = await supabase
    .from("program_days")
    .select("*")
    .eq("program_id", program.id)
    .order("day_index");
  const dayRows = (days ?? []) as ProgramDay[];
  if (dayRows.length === 0) return { ...(program as Program), days: [] };

  const { data: exercises } = await supabase
    .from("program_exercises")
    .select("*")
    .in("program_day_id", dayRows.map((d) => d.id))
    .order("position");
  const exerciseRows = (exercises ?? []) as ProgramExercise[];

  return {
    ...(program as Program),
    days: dayRows.map((d) => ({
      ...d,
      exercises: exerciseRows.filter((e) => e.program_day_id === d.id),
    })),
  };
});

/** Names of every program day the member owns — active or archived. */
export const getProgramDayNames = cache(async (memberId: string): Promise<Map<string, string>> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("program_days")
    .select("id, name, programs!inner(member_id)")
    .eq("programs.member_id", memberId);
  const rows = (data ?? []) as unknown as { id: string; name: string }[];
  return new Map(rows.map((d) => [d.id, d.name]));
});

/**
 * One program day with its exercises, regardless of whether the program is
 * still active. Past sessions must keep their plan after a rebuild.
 */
export const getProgramDayDetail = cache(
  async (
    dayId: string,
    memberId: string,
  ): Promise<(ProgramDay & { exercises: ProgramExercise[] }) | null> => {
    const supabase = await createClient();
    const { data: day } = await supabase
      .from("program_days")
      .select("*")
      .eq("id", dayId)
      .maybeSingle();
    if (!day) return null;

    const { data: program } = await supabase
      .from("programs")
      .select("id")
      .eq("id", day.program_id)
      .eq("member_id", memberId)
      .maybeSingle();
    if (!program) return null;

    const { data: exercises } = await supabase
      .from("program_exercises")
      .select("*")
      .eq("program_day_id", dayId)
      .order("position");
    return {
      ...(day as ProgramDay),
      exercises: (exercises ?? []) as ProgramExercise[],
    };
  },
);

export const getCustomExercises = cache(async (memberId: string): Promise<CustomExercise[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("custom_exercises")
    .select("*")
    .eq("member_id", memberId)
    .order("name");
  return (data ?? []) as CustomExercise[];
});

/** Seed + custom, with custom exercises always considered available. */
export async function getExerciseLibrary(
  memberId: string,
  equipmentIds: string[],
): Promise<ExerciseView[]> {
  const custom = await getCustomExercises(memberId);
  const seed = availableExercises(equipmentIds);
  const customViews: ExerciseView[] = custom.map((e) => ({
    key: `custom:${e.id}`,
    name: e.name,
    aliases: e.aliases ?? [],
    primary: e.primary_muscle as ExerciseView["primary"],
    secondary: (e.secondary_muscles ?? []) as ExerciseView["secondary"],
    equipment: e.equipment as ExerciseView["equipment"],
    pattern: e.pattern as ExerciseView["pattern"],
    unilateral: e.is_unilateral,
    equipmentIds: [],
    instructions: e.instructions ?? "",
    tip: e.tips ?? "",
    custom: true,
  }));
  return [...seed, ...customViews];
}

export async function getExerciseMap(memberId: string): Promise<Map<string, ExerciseView>> {
  const custom = await getCustomExercises(memberId);
  const all: ExerciseView[] = [
    ...SEED_EXERCISES.map((e) => ({
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
    })),
    ...custom.map((e) => ({
      key: `custom:${e.id}`,
      name: e.name,
      aliases: e.aliases ?? [],
      primary: e.primary_muscle as ExerciseView["primary"],
      secondary: (e.secondary_muscles ?? []) as ExerciseView["secondary"],
      equipment: e.equipment as ExerciseView["equipment"],
      pattern: e.pattern as ExerciseView["pattern"],
      unilateral: e.is_unilateral,
      equipmentIds: [],
      instructions: e.instructions ?? "",
      tip: e.tips ?? "",
      custom: true,
    })),
  ];
  return new Map(all.map((e) => [e.key, e]));
}

export const getRecentSessions = cache(async (memberId: string, limit = 40): Promise<WorkoutSession[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("member_id", memberId)
    .order("session_date", { ascending: false })
    .limit(limit);
  return (data ?? []) as WorkoutSession[];
});

export const getSetsForSessions = cache(
  async (memberId: string, sessionIds: string[]): Promise<SetLog[]> => {
    if (sessionIds.length === 0) return [];
    const supabase = await createClient();
    const { data } = await supabase
      .from("set_logs")
      .select("*")
      .eq("member_id", memberId)
      .in("session_id", sessionIds)
      .is("deleted_at", null)
      .order("created_at");
    return (data ?? []) as SetLog[];
  },
);

export const getSession = cache(async (sessionId: string, memberId: string): Promise<WorkoutSession | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workout_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("member_id", memberId)
    .maybeSingle();
  return (data as WorkoutSession | null) ?? null;
});

export const getSessionSets = cache(async (sessionId: string, memberId: string): Promise<SetLog[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("set_logs")
    .select("*")
    .eq("session_id", sessionId)
    .eq("member_id", memberId)
    .is("deleted_at", null)
    .order("created_at");
  return (data ?? []) as SetLog[];
});

export const getStreakFreezes = cache(async (memberId: string): Promise<StreakFreeze[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("streak_freezes")
    .select("*")
    .eq("member_id", memberId)
    .order("used_on", { ascending: false })
    .limit(24);
  return (data ?? []) as StreakFreeze[];
});

export const getMeasurements = cache(async (memberId: string, limit = 60): Promise<BodyMeasurement[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("member_id", memberId)
    .order("measured_on", { ascending: false })
    .limit(limit);
  return (data ?? []) as BodyMeasurement[];
});

export const getProgressPhotos = cache(async (memberId: string): Promise<ProgressPhoto[]> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("progress_photos")
    .select("*")
    .eq("member_id", memberId)
    .order("taken_on", { ascending: false })
    .limit(40);
  return (data ?? []) as ProgressPhoto[];
});

/**
 * Most recent sets for a list of exercises, grouped by exercise key. The
 * query is capped; a normal session is 15–25 sets, so 200 covers several
 * weeks of history for the handful of lifts on today's card.
 */
export async function getLastSets(
  memberId: string,
  exerciseKeys: string[],
  excludeSessionId?: string,
): Promise<Record<string, SetLog[]>> {
  if (exerciseKeys.length === 0) return {};
  const supabase = await createClient();
  let query = supabase
    .from("set_logs")
    .select("*")
    .eq("member_id", memberId)
    .in("exercise_key", exerciseKeys)
    .is("deleted_at", null);
  if (excludeSessionId) query = query.neq("session_id", excludeSessionId);
  const { data } = await query.order("created_at", { ascending: false }).limit(200);
  const rows = (data ?? []) as SetLog[];

  // Keep only the most recent session per exercise.
  const byExercise = new Map<string, SetLog[]>();
  const keptSession = new Map<string, string>();
  for (const row of rows) {
    const existing = byExercise.get(row.exercise_key);
    if (!existing) {
      byExercise.set(row.exercise_key, [row]);
      keptSession.set(row.exercise_key, row.session_id);
    } else if (keptSession.get(row.exercise_key) === row.session_id) {
      existing.push(row);
    }
  }
  // Rows arrived newest-first; present them oldest-first inside the session.
  for (const [key, sets] of byExercise) byExercise.set(key, sets.reverse());
  return Object.fromEntries(byExercise);
}

export interface GymToday {
  gym: Gym | null;
  program: ProgramWithDays | null;
  programDay: (ProgramDay & { exercises: ProgramExercise[] }) | null;
  session: WorkoutSession | null;
  streak: StreakResult;
  fuel: DayFuel | null;
  lastSets: Record<string, SetLog[]>;
  isTrainingDay: boolean;
}

/**
 * Everything the gym dashboard / Today card needs. `profile` supplies the
 * base targets; the training calendar supplies the carb cycling.
 */
export async function getGymToday(profile: Profile, today = istDateISO()): Promise<GymToday> {
  const [gym, program, sessions, freezes] = await Promise.all([
    getGym(profile.id),
    getActiveProgram(profile.id),
    getRecentSessions(profile.id, 60),
    getStreakFreezes(profile.id),
  ]);

  const weekday = weekdayIndex(today);
  const isTrainingDay = (gym?.training_days ?? []).includes(weekday);
  const programDay = program ? programDayForDate(program.days, gym?.training_days ?? [], weekday) : null;
  const session = sessions.find((s) => s.session_date === today) ?? null;

  const streak = computeStreak({
    sessionDates: sessions.filter((s) => s.status !== "skipped").map((s) => s.session_date),
    scheduledDays: gym?.training_days ?? [],
    today,
    freezes: freezes.map((f) => f.used_on),
  });

  const floor = calorieFloorFor(profile.sex);
  const base: NutrientTargets | null = profile.targets_cache
    ? applyCalorieAdjustment(
        profile.targets_cache.targets,
        profile.calorie_adjustment_kcal ?? 0,
        floor,
      )
    : null;
  const fuel = base
    ? dayFuel(base, {
        isTrainingDay,
        trainingDaysPerWeek: (gym?.training_days ?? []).length,
        floorKcal: floor,
      })
    : null;

  const keys = programDay?.exercises.map((e) => e.exercise_key) ?? [];
  const lastSets = await getLastSets(profile.id, keys, session?.id);

  return { gym, program, programDay, session, streak, fuel, lastSets, isTrainingDay };
}

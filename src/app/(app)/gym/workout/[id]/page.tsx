import { notFound } from "next/navigation";
import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import {
  getActiveProgram,
  getBestE1rms,
  getExerciseMap,
  getGym,
  getLastSets,
  getProgramDayDetail,
  getSession,
  getSessionSets,
} from "@/lib/gym/data";
import type { SetLog } from "@/lib/db-types";
import type { WeightUnit } from "@/lib/gym/types";
import { WorkoutClient, type WorkoutExercise, type WorkoutSet } from "./workout-client";

export const instant = false;

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function displayWeight(set: SetLog, unit: WeightUnit): number {
  if (set.display_weight != null && set.display_unit === unit) return round(Number(set.display_weight));
  return unit === "lb" ? round(Number(set.weight_kg) * 2.20462) : round(Number(set.weight_kg));
}

function toView(set: SetLog, unit: WeightUnit): WorkoutSet {
  return {
    id: set.id,
    exerciseKey: set.exercise_key,
    setIndex: set.set_index,
    weight: displayWeight(set, unit),
    reps: set.reps,
    plates: (set.plates as { label: string; qty: number }[] | null) ?? null,
    isWarmup: set.is_warmup,
    isPr: set.is_pr,
    stackPosition: set.stack_position,
  };
}

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await requireFullProfile();
  const session = await getSession(id, profile.id);
  if (!session) notFound();

  const [gym, program, sets, exerciseMap] = await Promise.all([
    getGym(profile.id),
    getActiveProgram(profile.id),
    getSessionSets(id, profile.id),
    getExerciseMap(profile.id),
  ]);

  if (!gym) {
    return (
      <div className="mx-auto max-w-xl border-2 border-neutral-900 bg-white p-6 shadow-[4px_4px_0_#111]">
        <h1 className="text-lg font-extrabold">Set up your gym first</h1>
        <p className="mt-1 text-sm text-neutral-500">
          The plate calculator and program need your equipment and plate inventory.
        </p>
        <Link href="/gym/setup" className="mt-3 inline-block underline">
          Open gym setup →
        </Link>
      </div>
    );
  }

  const unit = gym.unit as WeightUnit;
  // Prefer the active program, but a session from an older program must keep
  // its planned exercises after a rebuild/setup change.
  const programDay =
    program?.days.find((d) => d.id === session.program_day_id) ??
    (session.program_day_id
      ? await getProgramDayDetail(session.program_day_id, profile.id)
      : null);
  const exercises: WorkoutExercise[] = (programDay?.exercises ?? []).map((e) => ({
    key: e.exercise_key,
    name: exerciseMap.get(e.exercise_key)?.name ?? "Custom exercise",
    targetSets: e.target_sets,
    repMin: e.rep_min,
    repMax: e.rep_max,
    incrementKg: Number(e.increment_kg),
    note: e.notes,
    equipmentIds: exerciseMap.get(e.exercise_key)?.equipmentIds ?? [],
  }));

  const keys = exercises.map((e) => e.key);
  const [lastRaw, bestByExercise] = await Promise.all([
    getLastSets(profile.id, keys, id),
    getBestE1rms(profile.id, keys),
  ]);
  const lastSets: Record<string, WorkoutSet[]> = Object.fromEntries(
    Object.entries(lastRaw).map(([key, rows]) => [key, rows.map((r) => toView(r, unit))]),
  );

  return (
    <WorkoutClient
      sessionId={session.id}
      sessionDate={session.session_date}
      dayName={programDay?.name ?? "Workout"}
      status={session.status}
      unit={unit}
      barWeight={Number(gym.bar_weight)}
      plates={gym.plate_inventory}
      machineStacks={gym.machine_stacks ?? []}
      exercises={exercises}
      existingSets={sets.map((s) => toView(s, unit))}
      lastSets={lastSets}
      bestByExercise={bestByExercise}
      library={[...exerciseMap.values()].map((e) => ({ key: e.key, name: e.name }))}
    />
  );
}

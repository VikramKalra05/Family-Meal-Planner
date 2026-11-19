import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { getExerciseMap, getGym } from "@/lib/gym/data";
import { ExerciseBrowser } from "./exercise-browser";

export const instant = false;

export default async function ExercisesPage() {
  const profile = await requireFullProfile();
  const [map, gym] = await Promise.all([getExerciseMap(profile.id), getGym(profile.id)]);
  const exercises = [...map.values()];

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            ← Gym
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Exercise library</h1>
          <p className="text-sm text-neutral-500">
            {exercises.length} movements with instructions, tips and a YouTube / Instagram search on every page.
          </p>
        </div>
        {gym && (
          <p className="border-2 border-neutral-900 bg-lime-200 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide">
            {gym.equipment_ids.length} equipment selected
          </p>
        )}
      </div>

      <ExerciseBrowser exercises={exercises} availableEquipment={gym?.equipment_ids ?? []} />

      <p className="text-[10px] leading-relaxed text-neutral-400">
        Demo photos:{" "}
        <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noreferrer" className="underline">
          free-exercise-db
        </a>{" "}
        (public domain). Exercise instructions are a starting point — verify form with a coach or a
        reliable video, especially for barbell lifts.
      </p>
    </div>
  );
}

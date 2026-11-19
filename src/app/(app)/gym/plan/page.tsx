import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { getActiveProgram, getExerciseMap, getGym } from "@/lib/gym/data";
import { WEEKDAY_LABELS } from "@/lib/gym/types";
import { equipmentNames } from "@/data/gym-equipment";
import { rebuildProgram } from "../actions";
import { SubmitButton } from "@/components/submit-button";

export const instant = false;

export default async function ProgramPage() {
  const profile = await requireFullProfile();
  const [program, gym, exerciseMap] = await Promise.all([
    getActiveProgram(profile.id),
    getGym(profile.id),
    getExerciseMap(profile.id),
  ]);

  const trainingDays = [...(gym?.training_days ?? [])].sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            ← Gym
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Program</h1>
          <p className="text-sm text-neutral-500">
            {program ? program.name : "No active program yet."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/gym/setup"
            className="rounded-none border-2 border-neutral-900 bg-yellow-300 px-3 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
          >
            Change split / equipment
          </Link>
          {program && (
            <form action={rebuildProgram}>
              <input type="hidden" name="templateId" value={program.template} />
              <SubmitButton
                pendingText="Rebuilding…"
                className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
              >
                Rebuild for my equipment
              </SubmitButton>
            </form>
          )}
        </div>
      </div>

      {!program ? (
        <div className="border-2 border-neutral-900 bg-yellow-200 p-6 shadow-[4px_4px_0_#111]">
          <p className="text-sm font-bold">Set up your gym to get a program.</p>
          <Link href="/gym/setup" className="mt-2 inline-block underline">
            Open setup →
          </Link>
        </div>
      ) : (
        <>
          <section className="flex flex-wrap gap-2 border-2 border-neutral-900 bg-white p-3 shadow-[3px_3px_0_#111] text-[11px]">
            <span className="font-extrabold uppercase tracking-wide text-neutral-500">Training days:</span>
            {WEEKDAY_LABELS.map((label, index) => {
              const on = trainingDays.includes(index);
              return (
                <span
                  key={label}
                  className={`border-2 border-neutral-900 px-2 py-0.5 font-extrabold uppercase ${
                    on ? "bg-emerald-300" : "bg-white text-neutral-300"
                  }`}
                >
                  {label}
                </span>
              );
            })}
            {gym && (
              <span className="ml-auto text-neutral-400">
                Equipment: {equipmentNames(gym.equipment_ids).length} selected
              </span>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            {program.days.map((day, index) => {
              const weekday = trainingDays[index];
              return (
                <section key={day.id} className="rounded-none border-2 border-neutral-900 bg-white p-4 shadow-[4px_4px_0_#111]">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                        Day {index + 1}
                      </p>
                      <h2 className="text-base font-extrabold">{day.name}</h2>
                    </div>
                    <span className="border-2 border-neutral-900 bg-yellow-300 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                      {weekday != null ? WEEKDAY_LABELS[weekday] : "Unscheduled"}
                    </span>
                  </div>
                  <ul className="mt-3 divide-y-2 divide-neutral-100 border-y-2 border-neutral-900">
                    {day.exercises.map((e) => (
                      <li key={e.id} className="py-1.5">
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <span className="font-medium">{exerciseMap.get(e.exercise_key)?.name ?? "Custom exercise"}</span>
                          <span className="shrink-0 text-xs font-bold text-neutral-500">
                            {e.target_sets} × {e.rep_min}–{e.rep_max}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {day.focus.length > 0 && (
                    <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-neutral-400">
                      {day.focus.join(" · ")}
                    </p>
                  )}
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

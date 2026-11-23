import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";
import { addDays, weekdayIndex, WEEKDAY_LABELS } from "@/lib/gym/types";
import { getGymToday, getRecentSessions, getExerciseMap, getProgramDayNames } from "@/lib/gym/data";
import { markTodayDone, startSession, useStreakFreeze } from "./actions";
import { SubmitButton } from "@/components/submit-button";

export const instant = false;

function nextTrainingDay(today: string, days: number[]): string | null {
  if (days.length === 0) return null;
  for (let i = 1; i <= 7; i++) {
    const date = addDays(today, i);
    if (days.includes(weekdayIndex(date))) return date;
  }
  return null;
}

const MUSCLE_SHORT: Record<string, string> = {
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

export default async function GymPage() {
  const profile = await requireFullProfile();
  const today = istDateISO();
  const supabase = await createClient();

  const [gymToday, recent, intakeRes, exerciseMap, dayNames] = await Promise.all([
    getGymToday(profile, today),
    getRecentSessions(profile.id, 5),
    supabase
      .from("intake_logs")
      .select("kcal, protein_g, carbs_g, fat_g")
      .eq("member_id", profile.id)
      .eq("logged_on", today),
    getExerciseMap(profile.id),
    getProgramDayNames(profile.id),
  ]);

  const { gym, programDay, session, streak, fuel, isTrainingDay } = gymToday;
  const eaten = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.kcal), 0);
  const eatenProtein = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.protein_g), 0);
  const eatenCarbs = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.carbs_g), 0);
  const eatenFat = (intakeRes.data ?? []).reduce((s, l) => s + Number(l.fat_g), 0);
  const nextDay = nextTrainingDay(today, gym?.training_days ?? []);
  const lastSession = recent.find((s) => s.status === "completed");
  const lastDayName = lastSession?.program_day_id
    ? (dayNames.get(lastSession.program_day_id) ?? "Workout")
    : "Workout";
  const missed = streak.recentMisses[0];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Gym</h1>
          <p className="text-sm text-neutral-500">
            Plan the work, log the weight, and let the kitchen keep up.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-bold">
          <Link href="/gym/plan" className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 shadow-[2px_2px_0_#111] nb-press">
            Program
          </Link>
          <Link href="/gym/exercises" className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 shadow-[2px_2px_0_#111] nb-press">
            Exercises
          </Link>
          <Link href="/gym/history" className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 shadow-[2px_2px_0_#111] nb-press">
            History
          </Link>
          <Link href="/gym/progress" className="rounded-none border-2 border-neutral-900 bg-white px-3 py-2 shadow-[2px_2px_0_#111] nb-press">
            Progress
          </Link>
        </div>
      </div>

      {!gym ? (
        <section className="rounded-none border-2 border-neutral-900 bg-yellow-200 p-6 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">One-time setup</p>
          <h2 className="mt-1 text-lg font-extrabold">Tell me what your gym has.</h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-700">
            Pick the machines and equipment you actually use, set your plate colours and training days,
            and I&apos;ll build a program you can run — no exercises you can&apos;t do.
          </p>
          <Link
            href="/gym/setup"
            className="mt-4 inline-block rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
          >
            Set up my gym →
          </Link>
        </section>
      ) : (
        <>
          {/* Today */}
          <section className="grid gap-4 lg:grid-cols-3">
            <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111] lg:col-span-2">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                    {isTrainingDay ? "Today · training day" : "Today · rest day"}
                  </p>
                  <h2 className="mt-1 text-2xl font-extrabold tracking-tight">
                    {programDay ? programDay.name : isTrainingDay ? "Freestyle day" : "Rest and recover"}
                  </h2>
                  {programDay && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {programDay.focus.map((m) => (
                        <span key={m} className="border-2 border-neutral-900 bg-lime-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
                          {MUSCLE_SHORT[m] ?? m}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {session?.status === "completed" ? (
                  <span className="border-2 border-neutral-900 bg-emerald-400 px-3 py-1 text-[10px] font-extrabold uppercase tracking-wide">
                    Done today
                  </span>
                ) : null}
              </div>

              {programDay ? (
                <>
                  <ul className="mt-4 divide-y-2 divide-neutral-100 border-y-2 border-neutral-900">
                    {programDay.exercises.map((e) => {
                      const view = exerciseMap.get(e.exercise_key);
                      return (
                        <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                          <span className="font-medium text-neutral-800">{view?.name ?? "Custom exercise"}</span>
                          <span className="shrink-0 text-xs text-neutral-500">
                            {e.target_sets} × {e.rep_min}–{e.rep_max}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {session?.status === "in_progress" ? (
                      <Link
                        href={`/gym/workout/${session.id}`}
                        className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
                      >
                        Resume workout →
                      </Link>
                    ) : session?.status === "completed" ? (
                      <Link
                        href={`/gym/workout/${session.id}`}
                        className="rounded-none border-2 border-neutral-900 bg-white px-5 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
                      >
                        View today&apos;s session
                      </Link>
                    ) : (
                      <form action={startSession}>
                        <input type="hidden" name="programDayId" value={programDay.id} />
                        <input type="hidden" name="date" value={today} />
                        <SubmitButton
                          pendingText="Starting…"
                          className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
                        >
                          Start workout →
                        </SubmitButton>
                      </form>
                    )}
                    {session?.status !== "completed" && (
                      <form action={markTodayDone}>
                        <input type="hidden" name="date" value={today} />
                        <input type="hidden" name="programDayId" value={programDay.id} />
                        <SubmitButton
                          pendingText="Marking…"
                          className="rounded-none border-2 border-neutral-900 bg-white px-4 py-3 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
                        >
                          ✓ Mark done
                        </SubmitButton>
                      </form>
                    )}
                    <span className="text-xs text-neutral-500">
                      {programDay.exercises.length} exercises · {gym.equipment_ids.length} equipment selected
                    </span>
                  </div>
                </>
              ) : (
                <div className="mt-4">
                  <p className="text-sm text-neutral-600">
                    {isTrainingDay
                      ? "It's a training day but no program day is mapped. Open your program to fix the split."
                      : `Next session: ${nextDay ? new Date(`${nextDay}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }) : "add training days"}.`}
                  </p>
                  <Link href="/gym/plan" className="mt-3 inline-block text-xs font-extrabold uppercase tracking-wide underline">
                    Open program →
                  </Link>
                </div>
              )}
            </div>

            {/* Streak */}
            <div className="rounded-none border-2 border-neutral-900 bg-violet-200 p-5 shadow-[4px_4px_0_#111]">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">Gym streak</p>
              <p className="mt-1 text-4xl font-extrabold">{streak.current}</p>
              <p className="text-xs font-medium text-neutral-600">
                {streak.current === 1 ? "session in a row" : "sessions in a row"}
              </p>
              <dl className="mt-3 space-y-1 text-xs">
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Best</dt>
                  <dd className="font-bold">{streak.longest}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Consistency</dt>
                  <dd className="font-bold">{streak.consistencyPct == null ? "—" : `${streak.consistencyPct}%`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-neutral-600">Freezes left</dt>
                  <dd className="font-bold">{streak.freezesAvailable}</dd>
                </div>
              </dl>
              {missed && streak.freezesAvailable > 0 && (
                <form action={useStreakFreeze} className="mt-3">
                  <input type="hidden" name="date" value={missed} />
                  <SubmitButton
                    pendingText="Using…"
                    className="w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
                  >
                    Freeze {new Date(`${missed}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}
                  </SubmitButton>
                </form>
              )}
            </div>
          </section>

          {/* Fuel + last session */}
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Today&apos;s fuel</h2>
                <Link href="/week" className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
                  Week plan →
                </Link>
              </div>
              {fuel ? (
                <>
                  <p className="mt-2 text-3xl font-extrabold">
                    {fuel.kcal.toLocaleString("en-IN")} <span className="text-sm font-medium text-neutral-400">kcal</span>
                  </p>
                  <p className="text-xs text-neutral-500">
                    {fuel.note}
                    {profile.calorie_adjustment_kcal !== 0 && (
                      <> · engine offset {profile.calorie_adjustment_kcal > 0 ? "+" : ""}{profile.calorie_adjustment_kcal} kcal</>
                    )}
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                    {[
                      { label: "Protein", have: eatenProtein, target: fuel.proteinG, cls: "bg-lime-200" },
                      { label: "Carbs", have: eatenCarbs, target: fuel.carbsG, cls: "bg-amber-200" },
                      { label: "Fat", have: eatenFat, target: fuel.fatG, cls: "bg-red-200" },
                    ].map((m) => {
                      const pct = m.target > 0 ? Math.min(100, Math.round((m.have / m.target) * 100)) : 0;
                      return (
                        <div key={m.label} className={`border-2 border-neutral-900 p-2 ${m.cls}`}>
                          <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-600">{m.label}</p>
                          <p className="font-extrabold">
                            {Math.round(m.have)}<span className="text-[10px] font-medium text-neutral-500"> / {m.target} g</span>
                          </p>
                          <div className="mt-1 h-1.5 w-full bg-white/60">
                            <div className="h-full bg-neutral-900" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-xs text-neutral-500">
                    Eaten so far: <span className="font-bold text-neutral-800">{Math.round(eaten)} kcal</span>
                    {fuel.kcal > 0 && ` · ${Math.min(100, Math.round((eaten / fuel.kcal) * 100))}% of target`}
                  </p>
                </>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">Complete your profile to see fuel targets.</p>
              )}
            </div>

            <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
              <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Last session</h2>
              {lastSession ? (
                <>
                  <p className="mt-2 text-lg font-extrabold">
                    {lastDayName} ·{" "}
                    <span className="text-sm font-medium text-neutral-500">
                      {new Date(`${lastSession.session_date}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" })}
                    </span>
                  </p>
                  <Link
                    href={`/gym/workout/${lastSession.id}`}
                    className="mt-2 inline-block text-xs font-extrabold uppercase tracking-wide underline"
                  >
                    Open session →
                  </Link>
                </>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">
                  No completed sessions yet. Your first one is the hardest — start it above.
                </p>
              )}
              <div className="mt-4 border-t-2 border-neutral-100 pt-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Training days</p>
                <div className="mt-1 flex gap-1">
                  {WEEKDAY_LABELS.map((label, index) => {
                    const on = (gym.training_days ?? []).includes(index);
                    return (
                      <span
                        key={label}
                        className={`flex h-7 w-9 items-center justify-center border-2 border-neutral-900 text-[10px] font-extrabold ${
                          on ? "bg-emerald-400" : "bg-white text-neutral-400"
                        }`}
                      >
                        {label.slice(0, 2)}
                      </span>
                    );
                  })}
                </div>
                <Link href="/gym/setup" className="mt-2 inline-block text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
                  Edit equipment & days →
                </Link>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

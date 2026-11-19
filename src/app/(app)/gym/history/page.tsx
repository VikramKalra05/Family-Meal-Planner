import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { getActiveProgram, getGym, getRecentSessions, getSetsForSessions, getStreakFreezes } from "@/lib/gym/data";
import { addDays, weekdayIndex } from "@/lib/gym/types";
import { istDateISO } from "@/lib/date";
import { computeStreak } from "@/lib/gym/streak";
import type { SetLog } from "@/lib/db-types";

export const instant = false;

export default async function GymHistoryPage() {
  const profile = await requireFullProfile();
  const today = istDateISO();
  const [sessions, program, gym, freezes] = await Promise.all([
    getRecentSessions(profile.id, 80),
    getActiveProgram(profile.id),
    getGym(profile.id),
    getStreakFreezes(profile.id),
  ]);
  const sets = await getSetsForSessions(profile.id, sessions.map((s) => s.id));
  const setsBySession = new Map<string, SetLog[]>();
  for (const set of sets) {
    const list = setsBySession.get(set.session_id) ?? [];
    list.push(set);
    setsBySession.set(set.session_id, list);
  }

  const streak = computeStreak({
    sessionDates: sessions.filter((s) => s.status !== "skipped").map((s) => s.session_date),
    scheduledDays: gym?.training_days ?? [],
    today,
    freezes: freezes.map((f) => f.used_on),
  });

  // 12-week grid, Monday-aligned.
  const gridStart = addDays(today, -weekdayIndex(today) - 77);
  const completedDays = new Set(sessions.filter((s) => s.status === "completed").map((s) => s.session_date));
  const startedDays = new Set(sessions.filter((s) => s.status === "in_progress").map((s) => s.session_date));
  const frozenDays = new Set(freezes.map((f) => f.used_on));
  const days = Array.from({ length: 84 }, (_, i) => addDays(gridStart, i));

  const volume = (sessionId: string) =>
    Math.round(
      (setsBySession.get(sessionId) ?? [])
        .filter((s) => !s.is_warmup)
        .reduce((sum, s) => sum + Number(s.weight_kg) * s.reps, 0),
    );

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            ← Gym
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">History & streak</h1>
          <p className="text-sm text-neutral-500">
            Every logged session, and the honest version of the streak.
          </p>
        </div>
        <div className="flex gap-2">
          <div className="border-2 border-neutral-900 bg-violet-200 px-3 py-2 text-center shadow-[2px_2px_0_#111]">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-600">Current</p>
            <p className="text-xl font-extrabold">{streak.current}</p>
          </div>
          <div className="border-2 border-neutral-900 bg-white px-3 py-2 text-center shadow-[2px_2px_0_#111]">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Best</p>
            <p className="text-xl font-extrabold">{streak.longest}</p>
          </div>
          <div className="border-2 border-neutral-900 bg-white px-3 py-2 text-center shadow-[2px_2px_0_#111]">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">Consistency</p>
            <p className="text-xl font-extrabold">{streak.consistencyPct == null ? "—" : `${streak.consistencyPct}%`}</p>
          </div>
        </div>
      </div>

      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Last 12 weeks</h2>
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase text-neutral-400">
            <span className="h-3 w-3 border border-neutral-900 bg-emerald-400" /> done
            <span className="h-3 w-3 border border-neutral-900 bg-red-200" /> missed
            <span className="h-3 w-3 border border-neutral-900 bg-neutral-100" /> rest
          </div>
        </div>
        <div className="mt-3 overflow-x-auto">
          <div className="grid w-max grid-flow-col grid-rows-7 gap-1">
            {days.map((date) => {
              const scheduled = (gym?.training_days ?? []).includes(weekdayIndex(date));
              const future = date > today;
              const done = completedDays.has(date);
              const started = startedDays.has(date);
              const frozen = frozenDays.has(date);
              const cls = future
                ? "bg-transparent border-neutral-200"
                : done || started
                  ? "bg-emerald-400 border-neutral-900"
                  : frozen
                    ? "bg-amber-300 border-neutral-900"
                    : scheduled
                      ? date === today
                        ? "bg-yellow-200 border-neutral-900"
                        : "bg-red-200 border-neutral-900"
                      : "bg-neutral-100 border-neutral-200";
              return (
                <span
                  key={date}
                  title={`${date}${scheduled ? " · training day" : " · rest"}${done ? " · done" : ""}`}
                  className={`h-4 w-4 border ${cls}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        {sessions.length === 0 && (
          <p className="border-2 border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
            No sessions yet. Start one from the gym dashboard.
          </p>
        )}
        {sessions.map((s) => {
          const day = program?.days.find((d) => d.id === s.program_day_id);
          const sessionSets = setsBySession.get(s.id) ?? [];
          const isOpen = s.status === "in_progress";
          return (
            <Link
              key={s.id}
              href={`/gym/workout/${s.id}`}
              className="flex flex-wrap items-center justify-between gap-3 border-2 border-neutral-900 bg-white px-4 py-3 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              <div>
                <p className="text-sm font-extrabold">
                  {day?.name ?? "Workout"}{" "}
                  <span className="font-medium text-neutral-400">
                    ·{" "}
                    {new Date(`${s.session_date}T00:00:00Z`).toLocaleDateString("en-IN", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                      timeZone: "UTC",
                    })}
                  </span>
                </p>
                <p className="text-[11px] text-neutral-500">
                  {sessionSets.filter((x) => !x.is_warmup).length} sets · {volume(s.id).toLocaleString("en-IN")} kg volume
                </p>
              </div>
              <span
                className={`border-2 border-neutral-900 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${
                  s.status === "completed"
                    ? "bg-emerald-300"
                    : isOpen
                      ? "bg-amber-200"
                      : "bg-neutral-200 text-neutral-500"
                }`}
              >
                {s.status === "completed" ? "Completed" : isOpen ? "In progress" : "Skipped"}
              </span>
            </Link>
          );
        })}
      </section>
    </div>
  );
}

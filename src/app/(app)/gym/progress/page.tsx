import Link from "next/link";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { istDateISO } from "@/lib/date";
import {
  getExerciseMap,
  getMeasurements,
  getProgressPhotos,
  getRecentSessions,
  getSetsForSessions,
} from "@/lib/gym/data";
import { addDays, daysBetween, type Goal, type Muscle } from "@/lib/gym/types";
import { epley1rm, strengthTrendPct } from "@/lib/gym/e1rm";
import { volumeBand, weeklySetsByMuscle } from "@/lib/gym/progression";
import { suggestAdaptation } from "@/lib/gym/adapt";
import { weightTrend, type WeightPoint } from "@/lib/weight";
import type { AdaptiveAdjustment } from "@/lib/db-types";
import { applyAdaptation, deleteMeasurement, deleteProgressPhoto, resetAdaptation } from "../actions";
import { MeasurementForm } from "./measurement-form";
import { PhotoUpload } from "./photo-upload";
import { SubmitButton } from "@/components/submit-button";

export const instant = false;

interface SeriesPoint {
  date: string;
  value: number;
}

function Sparkline({ points, unit }: { points: SeriesPoint[]; unit: string }) {
  if (points.length < 2) {
    return (
      <p className="mt-3 border-2 border-dashed border-neutral-200 px-3 py-6 text-center text-[11px] text-neutral-400">
        Two sessions unlock the trend.
      </p>
    );
  }
  const W = 220;
  const H = 64;
  const PAD = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values) - 1;
  const max = Math.max(...values) + 1;
  const span = Math.max(1, max - min);
  const x = (i: number) => PAD + (i / (points.length - 1)) * (W - PAD * 2);
  const y = (v: number) => PAD + (1 - (v - min) / span) * (H - PAD * 2);
  const line = points.map((p, i) => `${x(i)},${y(p.value)}`).join(" ");
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full" role="img" aria-label="Strength trend">
      <polyline points={line} fill="none" stroke="#111" strokeWidth="2.5" />
      <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="#34d399" stroke="#111" strokeWidth="2" />
      <text x={W - PAD} y={H - 2} textAnchor="end" fontSize="9" fontWeight="700" fill="#737373">
        {Math.round(last.value)} {unit}
      </text>
    </svg>
  );
}

export default async function GymProgressPage() {
  const profile = await requireFullProfile();
  const today = istDateISO();
  const supabase = await createClient();

  const [sessions, measurements, photos, exerciseMap, weightRes, adaptationRes] = await Promise.all([
    getRecentSessions(profile.id, 120),
    getMeasurements(profile.id, 80),
    getProgressPhotos(profile.id),
    getExerciseMap(profile.id),
    supabase
      .from("weight_logs")
      .select("logged_on, weight_kg")
      .eq("member_id", profile.id)
      .gte("logged_on", addDays(today, -90))
      .order("logged_on", { ascending: true }),
    supabase
      .from("adaptive_adjustments")
      .select("*")
      .eq("member_id", profile.id)
      .order("effective_on", { ascending: false })
      .limit(8),
  ]);

  const sets = await getSetsForSessions(profile.id, sessions.map((s) => s.id));
  const sessionById = new Map(sessions.map((s) => [s.id, s]));

  // ── Strength series ─────────────────────────────────────────────────────
  const byExercise = new Map<string, Map<string, number>>();
  for (const set of sets) {
    if (set.is_warmup || set.reps <= 0) continue;
    const session = sessionById.get(set.session_id);
    if (!session) continue;
    const map = byExercise.get(set.exercise_key) ?? new Map<string, number>();
    const value = epley1rm(Number(set.weight_kg), set.reps);
    map.set(session.session_date, Math.max(map.get(session.session_date) ?? 0, value));
    byExercise.set(set.exercise_key, map);
  }
  const series = [...byExercise.entries()]
    .map(([key, map]) => ({
      key,
      name: exerciseMap.get(key)?.name ?? "Exercise",
      points: [...map.entries()]
        .map(([date, value]) => ({ date, value }))
        .sort((a, b) => a.date.localeCompare(b.date)),
    }))
    .filter((s) => s.points.length >= 2)
    .sort((a, b) => b.points.length - a.points.length)
    .slice(0, 4);

  const strengthTrends = series
    .map((s) => strengthTrendPct(s.points.map((p) => p.value)))
    .filter((v): v is number => v != null)
    .sort((a, b) => a - b);
  const medianStrength =
    strengthTrends.length === 0
      ? null
      : strengthTrends.length % 2 === 1
        ? strengthTrends[Math.floor(strengthTrends.length / 2)]
        : (strengthTrends[strengthTrends.length / 2 - 1] + strengthTrends[strengthTrends.length / 2]) / 2;

  // ── Weekly volume by muscle ─────────────────────────────────────────────
  const weekSets = sets.filter((s) => {
    const session = sessionById.get(s.session_id);
    return session != null && session.session_date >= addDays(today, -6);
  });
  const muscleMap = new Map<string, { primary: Muscle[]; secondary: Muscle[] }>();
  for (const [key, view] of exerciseMap) {
    muscleMap.set(key, { primary: [view.primary], secondary: view.secondary });
  }
  const volume = weeklySetsByMuscle(
    weekSets.map((s) => ({ exerciseId: s.exercise_key, isWarmup: s.is_warmup })),
    muscleMap,
  ).slice(0, 8);

  // ── Measurements ────────────────────────────────────────────────────────
  const waistPoints = [...measurements]
    .reverse()
    .filter((m) => m.waist_cm != null)
    .map((m) => ({ date: m.measured_on, value: Number(m.waist_cm) }));
  const latest = measurements[0];
  const oldestWaist = waistPoints.find((p) => daysBetween(p.date, today) >= 14);
  const latestWaist = waistPoints.at(-1);
  const waistDelta =
    oldestWaist && latestWaist ? Math.round((latestWaist.value - oldestWaist.value) * 10) / 10 : null;

  // ── Adaptive loop ───────────────────────────────────────────────────────
  const weightPoints: WeightPoint[] = (weightRes.data ?? []).map((w) => ({
    date: w.logged_on,
    kg: Number(w.weight_kg),
  }));
  const latestWeight = weightPoints.at(-1)?.kg ?? (profile.weight_kg == null ? null : Number(profile.weight_kg));
  const trend = weightTrend(weightPoints);
  const completedLast21 = sessions.filter(
    (s) => s.status === "completed" && s.session_date >= addDays(today, -21),
  ).length;
  const suggestion = suggestAdaptation({
    goal: (profile.goal ?? "maintenance") as Goal,
    weightKg: latestWeight ?? 0,
    weightTrendPerWeek: trend,
    strengthTrendPct: medianStrength,
    waistDeltaCm: waistDelta,
    weightLogs: weightPoints.length,
    sessions: completedLast21,
    currentAdjustmentKcal: profile.calorie_adjustment_kcal ?? 0,
  });
  const adaptationHistory = (adaptationRes.data ?? []) as AdaptiveAdjustment[];

  // ── Photos ──────────────────────────────────────────────────────────────
  const photoUrls = await Promise.all(
    photos.slice(0, 12).map(async (p) => {
      const { data } = await supabase.storage.from("progress-photos").createSignedUrl(p.storage_path, 3600);
      return { ...p, url: data?.signedUrl ?? null };
    }),
  );

  return (
    <div className="space-y-5">
      <div>
        <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
          ← Gym
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-neutral-500">
          Strength, volume, measurements and photos — the full picture, not just the scale.
        </p>
      </div>

      {/* Adaptive loop */}
      <section
        className={`rounded-none border-2 border-neutral-900 p-5 shadow-[4px_4px_0_#111] ${
          suggestion.action === "increase"
            ? "bg-lime-200"
            : suggestion.action === "decrease"
              ? "bg-amber-200"
              : "bg-white"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">
              Weekly check-in · suggest only
            </p>
            <h2 className="mt-1 text-lg font-extrabold">
              {suggestion.action === "increase"
                ? `Add ${suggestion.deltaKcal} kcal`
                : suggestion.action === "decrease"
                  ? `Reduce ${Math.abs(suggestion.deltaKcal)} kcal`
                  : suggestion.action === "collect"
                    ? "Collecting data"
                    : "Hold the course"}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-neutral-700">{suggestion.reason}</p>
            <p className="mt-2 text-[11px] text-neutral-500">
              Current engine offset:{" "}
              <span className="font-extrabold">
                {profile.calorie_adjustment_kcal > 0 ? "+" : ""}
                {profile.calorie_adjustment_kcal ?? 0} kcal
              </span>
              {" · "}confidence {suggestion.confidence}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {(suggestion.action === "increase" || suggestion.action === "decrease") && (
              <form action={applyAdaptation}>
                <input type="hidden" name="deltaKcal" value={suggestion.deltaKcal} />
                <input type="hidden" name="reason" value={suggestion.reason} />
                <SubmitButton
                  pendingText="Applying…"
                  className="w-full rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
                >
                  Apply {suggestion.deltaKcal > 0 ? "+" : ""}
                  {suggestion.deltaKcal} kcal
                </SubmitButton>
              </form>
            )}
            {(profile.calorie_adjustment_kcal ?? 0) !== 0 && (
              <form action={resetAdaptation}>
                <SubmitButton
                  pendingText="Resetting…"
                  className="w-full rounded-none border-2 border-neutral-900 bg-white px-4 py-2 text-[10px] font-extrabold uppercase tracking-wide"
                >
                  Reset to baseline
                </SubmitButton>
              </form>
            )}
          </div>
        </div>
        {adaptationHistory.length > 0 && (
          <ul className="mt-3 space-y-1 border-t-2 border-neutral-900/10 pt-2 text-[11px] text-neutral-600">
            {adaptationHistory.slice(0, 4).map((a) => (
              <li key={a.id} className="flex justify-between gap-3">
                <span className="truncate">{a.reason}</span>
                <span className="shrink-0 font-extrabold">
                  {a.delta_kcal > 0 ? "+" : ""}
                  {a.delta_kcal} → {a.total_kcal}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Strength */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Estimated 1RM</h2>
        {series.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">Log two sessions of the same lift to see a trend.</p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {series.map((s) => {
              const first = s.points[0].value;
              const lastValue = s.points[s.points.length - 1].value;
              const pct = first > 0 ? Math.round(((lastValue - first) / first) * 1000) / 10 : null;
              return (
                <div key={s.key} className="border-2 border-neutral-900 bg-amber-50 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-extrabold">{s.name}</p>
                    {pct != null && (
                      <span
                        className={`border-2 border-neutral-900 px-1.5 py-0.5 text-[9px] font-extrabold ${
                          pct >= 0 ? "bg-emerald-300" : "bg-red-200"
                        }`}
                      >
                        {pct > 0 ? "+" : ""}
                        {pct}%
                      </span>
                    )}
                  </div>
                  <Sparkline points={s.points} unit="kg" />
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Volume */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Hard sets this week</h2>
          <span className="text-[9px] font-extrabold uppercase tracking-wide text-neutral-400">band = 8–20</span>
        </div>
        {volume.length === 0 ? (
          <p className="mt-2 text-sm text-neutral-500">No sets in the last seven days.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {volume.map((v) => {
              const band = volumeBand(v.muscle);
              const pct = Math.min(100, Math.round((v.sets / 24) * 100));
              const under = v.sets < band.min;
              return (
                <div key={v.muscle}>
                  <div className="flex justify-between text-[11px] font-bold">
                    <span className="capitalize">{v.muscle.replace("_", " ")}</span>
                    <span className={under ? "text-amber-700" : "text-neutral-500"}>
                      {v.sets} sets{under ? " · under" : ""}
                    </span>
                  </div>
                  <div className="relative mt-0.5 h-3 w-full border border-neutral-900 bg-neutral-100">
                    <div
                      className={`h-full ${under ? "bg-amber-300" : "bg-emerald-400"}`}
                      style={{ width: `${pct}%` }}
                    />
                    <span
                      className="absolute top-0 h-full border-l border-dashed border-neutral-500"
                      style={{ left: `${(band.min / 24) * 100}%` }}
                    />
                    <span
                      className="absolute top-0 h-full border-l border-dashed border-neutral-500"
                      style={{ left: `${(band.max / 24) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Measurements */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Measurements</h2>
          {latest ? (
            <div className="mt-2 grid grid-cols-3 gap-2 text-center">
              {[
                ["Waist", latest.waist_cm],
                ["Chest", latest.chest_cm],
                ["Arm", latest.arm_cm],
                ["Thigh", latest.thigh_cm],
                ["Hip", latest.hip_cm],
                ["Neck", latest.neck_cm],
              ].map(([label, value]) => (
                <div key={String(label)} className="border-2 border-neutral-900 bg-amber-50 p-1.5">
                  <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">{label}</p>
                  <p className="text-sm font-extrabold">{value == null ? "—" : `${value} cm`}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-neutral-500">No measurements yet. Waist is the one that matters most.</p>
          )}
          {waistPoints.length >= 2 && (
            <div className="mt-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">Waist trend</p>
              <Sparkline points={waistPoints.slice(-12)} unit="cm" />
            </div>
          )}
          <MeasurementForm today={today} />
        </div>

        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Progress photos</h2>
          <PhotoUpload memberId={profile.id} today={today} />
          {photoUrls.length > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2">
              {photoUrls.map((p) => (
                <div key={p.id} className="border-2 border-neutral-900 bg-neutral-100">
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={`${p.pose} progress ${p.taken_on}`} className="aspect-[3/4] w-full object-cover" />
                  ) : (
                    <div className="flex aspect-[3/4] items-center justify-center text-[10px] text-neutral-400">
                      link expired
                    </div>
                  )}
                  <div className="flex items-center justify-between border-t-2 border-neutral-900 px-1 py-0.5">
                    <span className="text-[9px] font-extrabold uppercase">
                      {new Date(`${p.taken_on}T00:00:00Z`).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        timeZone: "UTC",
                      })}
                    </span>
                    <form action={deleteProgressPhoto}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="text-[9px] font-extrabold uppercase text-neutral-400 hover:text-red-600">
                        ×
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-neutral-400">
            Private bucket · signed URLs expire. Same light, same pose, same time of day is the honest comparison.
          </p>
        </div>
      </section>

      {/* Measurement history */}
      {measurements.length > 0 && (
        <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Measurement log</h2>
          <ul className="mt-2 divide-y-2 divide-neutral-100 border-y-2 border-neutral-900">
            {measurements.slice(0, 12).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 py-1.5 text-xs">
                <span className="font-bold">
                  {new Date(`${m.measured_on}T00:00:00Z`).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    timeZone: "UTC",
                  })}
                </span>
                <span className="flex-1 truncate text-neutral-500">
                  {[
                    m.waist_cm != null ? `waist ${m.waist_cm}` : null,
                    m.chest_cm != null ? `chest ${m.chest_cm}` : null,
                    m.arm_cm != null ? `arm ${m.arm_cm}` : null,
                    m.thigh_cm != null ? `thigh ${m.thigh_cm}` : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "—"}
                </span>
                <form action={deleteMeasurement}>
                  <input type="hidden" name="id" value={m.id} />
                  <button type="submit" className="text-[9px] font-extrabold uppercase text-neutral-400 hover:text-red-600">
                    Delete
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

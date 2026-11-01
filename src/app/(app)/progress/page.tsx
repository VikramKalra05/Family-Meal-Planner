import { WeightChart } from "./weight-chart";
import { GoalForm, QuickLogForm } from "./weight-forms";
import { progressPct, projectTargetDate, weightTrend, type WeightPoint } from "@/lib/weight";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { WeightLog } from "@/lib/db-types";

export const instant = false;

export default async function ProgressPage() {
  const profile = await requireFullProfile();
  const supabase = await createClient();

  const { data: logs } = await supabase
    .from("weight_logs")
    .select("id, member_id, logged_on, weight_kg, source, created_at")
    .eq("member_id", profile.id)
    .order("logged_on", { ascending: true })
    .limit(90);

  const points: WeightPoint[] = (logs ?? [] as WeightLog[]).map((l) => ({
    date: l.logged_on,
    kg: Number(l.weight_kg),
  }));

  const targetKg = profile.target_weight_kg == null ? null : Number(profile.target_weight_kg);
  const current = points.at(-1)?.kg ?? (profile.weight_kg == null ? null : Number(profile.weight_kg));
  const trend = weightTrend(points);
  const pct = progressPct(points, targetKg);
  const projection = projectTargetDate(points, targetKg, trend);
  const loggedToday = points.at(-1)?.date === new Date().toISOString().slice(0, 10);

  const trendLabel =
    trend == null
      ? "Log a few days to see your trend"
      : trend < -0.05
        ? `Losing ≈ ${Math.abs(trend)} kg/week`
        : trend > 0.05
          ? `Gaining ≈ ${trend} kg/week`
          : "Holding steady";

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Progress</h1>
        <p className="text-sm text-neutral-500">
          Daily weigh-ins keep your targets honest — the engine follows your body, not a stale number.
        </p>
      </div>

      {/* Stat cards */}
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Current</p>
          <p className="mt-1 text-3xl font-bold text-neutral-900">
            {current ?? "—"} <span className="text-base font-medium text-neutral-400">kg</span>
          </p>
          <p className="mt-1 text-xs text-neutral-500">{trendLabel}</p>
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-yellow-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">Target</p>
          <p className="mt-1 text-3xl font-bold text-amber-600">
            {targetKg ?? "—"} <span className="text-base font-medium text-neutral-400">kg</span>
          </p>
          {pct != null && (
            <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-neutral-100">
              <div className="h-full rounded-full border-2 border-neutral-900 bg-lime-400" style={{ width: `${pct}%` }} />
            </div>
          )}
          <p className="mt-1 text-xs text-neutral-500">
            {pct != null ? `${pct}% of the way there` : "Set a target below"}
          </p>
        </div>
        <div className="rounded-none border-2 border-neutral-900 bg-pink-200 p-5 shadow-[4px_4px_0_#111]">
          <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">Projection</p>
          <p className="mt-1 text-sm font-semibold text-neutral-900">
            {projection === null && (trend == null ? "— needs more logs" : "On track to hold")}
            {projection === "regressing" && <span className="text-amber-600">Trend is moving away from your target</span>}
            {projection && projection !== "regressing" && (
              <>
                ~{projection.weeks} weeks
                <span className="block text-xs font-normal text-neutral-500">
                  ETA {new Date(projection.eta).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </>
            )}
          </p>
          {loggedToday && (
            <p className="mt-1 text-xs font-medium text-emerald-600">✓ Logged today</p>
          )}
        </div>
      </section>

      {/* Chart */}
      <section className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-500">
          Weight trend · last {points.length} logs
        </h2>
        <WeightChart points={points} targetKg={targetKg} />
      </section>

      {/* Actions */}
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Weigh in</h2>
          <QuickLogForm />
          {profile.weigh_in_time && (
            <p className="mt-2 text-[11px] text-neutral-400">
              🔔 Daily reminder set for {profile.weigh_in_time} — you&apos;ll get a browser notification if today
              isn&apos;t logged yet.
            </p>
          )}
        </div>
        <div className="rounded-none bg-white p-5 border-2 border-neutral-900 shadow-[4px_4px_0_#111]">
          <h2 className="mb-3 text-sm font-semibold text-neutral-900">Goal & reminder</h2>
          <GoalForm targetKg={targetKg} weighInTime={profile.weigh_in_time} />
        </div>
      </section>
    </div>
  );
}

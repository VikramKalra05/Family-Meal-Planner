import Link from "next/link";
import { notFound } from "next/navigation";
import { requireFullProfile } from "@/lib/profile";
import { getExerciseMap, getGym } from "@/lib/gym/data";
import { createClient } from "@/lib/supabase/server";
import { EQUIPMENT_LABELS, MUSCLE_LABELS } from "@/lib/gym/types";
import { equipmentNames } from "@/data/gym-equipment";
import { exerciseImageFallback, exerciseImageUrl } from "@/data/exercise-media";
import { ExerciseImage } from "@/components/exercise-image";
import type { SetLog } from "@/lib/db-types";
import { bestE1rm, epley1rm } from "@/lib/gym/e1rm";

export const instant = false;

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export default async function ExerciseDetailPage({ params }: { params: Promise<{ key: string }> }) {
  const { key: rawKey } = await params;
  const key = safeDecode(rawKey);
  const profile = await requireFullProfile();
  const [map, gym] = await Promise.all([getExerciseMap(profile.id), getGym(profile.id)]);
  const exercise = map.get(key);
  if (!exercise) notFound();

  const unit = gym?.unit ?? "kg";
  const supabase = await createClient();
  const { data } = await supabase
    .from("set_logs")
    .select("*")
    .eq("member_id", profile.id)
    .eq("exercise_key", key)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(80);
  const sets = (data ?? []) as SetLog[];
  const best = bestE1rm(sets.map((s) => ({ weightKg: Number(s.weight_kg), reps: s.reps, isWarmup: s.is_warmup })));
  const last = sets[0];
  const display = (s: SetLog) =>
    s.display_unit === unit && s.display_weight != null
      ? Number(s.display_weight)
      : unit === "lb"
        ? Math.round(Number(s.weight_kg) * 2.20462 * 100) / 100
        : Number(s.weight_kg);

  const image = exerciseImageUrl(key);
  const query = encodeURIComponent(exercise.name);
  const yt = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${exercise.name} form`)}`;
  const igSearch = `https://www.google.com/search?q=${encodeURIComponent(`site:instagram.com ${exercise.name} form`)}`;
  const tag = exercise.name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const igTag = `https://www.instagram.com/explore/tags/${tag}/`;
  const web = `https://www.google.com/search?q=${query}+exercise+form`;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link href="/gym/exercises" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
          ← Exercise library
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-extrabold tracking-tight">{exercise.name}</h1>
          {exercise.custom && (
            <span className="border-2 border-neutral-900 bg-violet-200 px-2 py-0.5 text-[10px] font-extrabold uppercase">
              Custom
            </span>
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="border-2 border-neutral-900 bg-lime-200 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
            {MUSCLE_LABELS[exercise.primary]}
          </span>
          {exercise.secondary.map((m) => (
            <span key={m} className="border-2 border-neutral-900 bg-white px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
              {MUSCLE_LABELS[m]}
            </span>
          ))}
          <span className="border-2 border-neutral-900 bg-amber-100 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide">
            {EQUIPMENT_LABELS[exercise.equipment]}
          </span>
        </div>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">How to do it</h2>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">{exercise.instructions || "No instructions yet."}</p>
          {exercise.tip && (
            <div className="mt-3 border-2 border-neutral-900 bg-yellow-100 p-3">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Coach&apos;s tip</p>
              <p className="mt-1 text-xs leading-relaxed text-neutral-700">{exercise.tip}</p>
            </div>
          )}
        </div>

        <div className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Watch a demo</h2>
          <p className="mt-2 text-xs text-neutral-500">
            Search always works, even when an API doesn&apos;t. Pick the angle that matches your gym.
          </p>
          {image && (
            <div className="mt-3 overflow-hidden border-2 border-neutral-900 bg-white">
              <ExerciseImage
                src={image}
                fallback={exerciseImageFallback(key)}
                alt={`${exercise.name} demonstration`}
                className="aspect-[4/3] w-full bg-white object-contain"
              />
              <p className="border-t-2 border-neutral-900 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-neutral-400">
                Demo photo · free-exercise-db (public domain)
              </p>
            </div>
          )}
          <div className="mt-3 space-y-2">
            <a
              href={yt}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between border-2 border-neutral-900 bg-red-200 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
            >
              ▶ YouTube · {exercise.name}
              <span aria-hidden>↗</span>
            </a>
            <a
              href={igSearch}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between border-2 border-neutral-900 bg-pink-200 px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
            >
              ◎ Instagram search
              <span aria-hidden>↗</span>
            </a>
            <a
              href={igTag}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between border-2 border-neutral-900 bg-white px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
            >
              # {tag || "exercise"}
              <span aria-hidden>↗</span>
            </a>
            <a
              href={web}
              target="_blank"
              rel="noreferrer"
              className="flex items-center justify-between border-2 border-neutral-900 bg-white px-3 py-2.5 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
            >
              Web search
              <span aria-hidden>↗</span>
            </a>
          </div>
          {exercise.equipmentIds.length > 0 && gym && (
            <p className="mt-3 text-[10px] font-bold uppercase tracking-wide text-neutral-400">
              Needs: {equipmentNames(exercise.equipmentIds).join(", ")}
            </p>
          )}
        </div>
      </section>

      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">Your history</h2>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="border-2 border-neutral-900 bg-emerald-200 p-2">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-600">Best e1RM</p>
            <p className="text-lg font-extrabold">{best == null ? "—" : `${Math.round(best)} kg`}</p>
          </div>
          <div className="border-2 border-neutral-900 bg-amber-200 p-2">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-600">Last set</p>
            <p className="text-lg font-extrabold">
              {last ? `${Math.round(display(last))} × ${last.reps}` : "—"}
            </p>
          </div>
          <div className="border-2 border-neutral-900 bg-violet-200 p-2">
            <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-600">Sets logged</p>
            <p className="text-lg font-extrabold">{sets.length}</p>
          </div>
        </div>
        {sets.length > 0 ? (
          <ul className="mt-3 max-h-64 divide-y-2 divide-neutral-100 overflow-y-auto border-y-2 border-neutral-900">
            {sets.slice(0, 20).map((s) => (
              <li key={s.id} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-neutral-500">
                  {new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
                <span className="font-bold">
                  {Math.round(display(s))} {unit} × {s.reps}
                </span>
                <span className="text-[10px] font-bold uppercase text-neutral-400">
                  e1RM {Math.round(epley1rm(Number(s.weight_kg), s.reps))} kg
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-sm text-neutral-500">No sets logged yet. It will show up here after your first session.</p>
        )}
      </section>
    </div>
  );
}

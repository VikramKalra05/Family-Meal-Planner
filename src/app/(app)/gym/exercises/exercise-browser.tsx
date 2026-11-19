"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { EQUIPMENT_LABELS, MUSCLE_LABELS, MUSCLES, type Muscle } from "@/lib/gym/types";
import { hasEquipment } from "@/lib/gym/program";
import type { ExerciseView } from "@/data/seed-exercises";
import { exerciseImageFallback, exerciseImageUrl } from "@/data/exercise-media";
import { ExerciseImage } from "@/components/exercise-image";

const input =
  "rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";

export function ExerciseBrowser({
  exercises,
  availableEquipment,
}: {
  exercises: ExerciseView[];
  availableEquipment: string[];
}) {
  const [query, setQuery] = useState("");
  const [muscle, setMuscle] = useState<"all" | Muscle>("all");
  const [onlyAvailable, setOnlyAvailable] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const available = new Set(availableEquipment);
    return exercises
      .filter((e) => (muscle === "all" ? true : e.primary === muscle || e.secondary.includes(muscle)))
      .filter((e) =>
        q
          ? `${e.name} ${e.aliases.join(" ")} ${MUSCLE_LABELS[e.primary]} ${EQUIPMENT_LABELS[e.equipment]}`
              .toLowerCase()
              .includes(q)
          : true,
      )
      .filter((e) =>
        onlyAvailable && availableEquipment.length > 0
          ? e.equipmentIds.every((id) => hasEquipment(available, id))
          : true,
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [exercises, muscle, query, onlyAvailable, availableEquipment]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-2 border-neutral-900 bg-white p-3 shadow-[3px_3px_0_#111]">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search bench, lat pulldown, RDL…"
          className={`${input} min-w-56 flex-1`}
          aria-label="Search exercises"
        />
        <select
          value={muscle}
          onChange={(e) => setMuscle(e.target.value as "all" | Muscle)}
          className={input}
          aria-label="Muscle group"
        >
          <option value="all">All muscles</option>
          {MUSCLES.map((m) => (
            <option key={m} value={m}>
              {MUSCLE_LABELS[m]}
            </option>
          ))}
        </select>
        {availableEquipment.length > 0 && (
          <label className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-wide text-neutral-600">
            <input
              type="checkbox"
              checked={onlyAvailable}
              onChange={(e) => setOnlyAvailable(e.target.checked)}
              className="h-4 w-4 accent-emerald-500"
            />
            My equipment only
          </label>
        )}
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
          {filtered.length} results
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
        {filtered.map((e) => {
          const image = exerciseImageUrl(e.key);
          const needed = e.equipmentIds.filter(
            (id) => !hasEquipment(new Set(availableEquipment), id),
          );
          return (
            <Link
              key={e.key}
              href={`/gym/exercises/${encodeURIComponent(e.key)}`}
              className="group flex flex-col border-2 border-neutral-900 bg-white p-3 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
            >
              {image && (
                <div className="-mx-3 -mt-3 mb-2 overflow-hidden border-b-2 border-neutral-900 bg-neutral-50">
                  <ExerciseImage
                    src={image}
                    fallback={exerciseImageFallback(e.key)}
                    alt={`${e.name} demonstration`}
                    className="aspect-[4/3] w-full object-cover"
                  />
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-extrabold leading-tight group-hover:underline">{e.name}</p>
                {e.custom && (
                  <span className="shrink-0 border-2 border-neutral-900 bg-violet-200 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                    Custom
                  </span>
                )}
              </div>
              <p className="mt-1 text-[11px] text-neutral-500">
                {MUSCLE_LABELS[e.primary]}
                {e.secondary.length > 0 && ` · ${e.secondary.map((m) => MUSCLE_LABELS[m]).join(", ")}`}
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="border-2 border-neutral-900 bg-amber-100 px-1.5 py-0.5 text-[9px] font-extrabold uppercase">
                  {EQUIPMENT_LABELS[e.equipment]}
                </span>
                {needed.length > 0 && availableEquipment.length > 0 && (
                  <span className="border-2 border-neutral-300 px-1.5 py-0.5 text-[9px] font-extrabold uppercase text-neutral-400">
                    Needs gear
                  </span>
                )}
              </div>
              <p className="mt-2 line-clamp-2 text-[11px] leading-snug text-neutral-500">{e.instructions}</p>
            </Link>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <p className="border-2 border-dashed border-neutral-300 p-8 text-center text-sm text-neutral-400">
          Nothing matches that search. Try a different muscle or clear the filter.
        </p>
      )}
    </div>
  );
}

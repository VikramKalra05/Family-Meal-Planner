"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PlatePicker, type PickedPlate } from "./plate-picker";
import {
  enqueue,
  flushQueue,
  installAutoFlush,
  pendingCount,
  subscribeQueue,
} from "@/lib/gym/local-queue";
import type { PlateDenom, WeightUnit } from "@/lib/gym/types";

export interface WorkoutExercise {
  key: string;
  name: string;
  targetSets: number;
  repMin: number;
  repMax: number;
  incrementKg: number;
  note: string | null;
}

export interface WorkoutSet {
  id: string;
  exerciseKey: string;
  setIndex: number;
  weight: number;
  reps: number;
  plates: { label: string; qty: number }[] | null;
  isWarmup: boolean;
}

interface Draft {
  weight: string;
  reps: string;
}

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function toKg(weight: number, unit: WeightUnit): number {
  return unit === "lb" ? round(weight * 0.45359237) : weight;
}

function summary(sets: WorkoutSet[] | undefined): string {
  if (!sets || sets.length === 0) return "first time";
  return `last: ${sets
    .filter((s) => !s.isWarmup)
    .map((s) => `${round(s.weight)}×${s.reps}`)
    .join(", ")}`;
}

export function WorkoutClient({
  sessionId,
  sessionDate,
  dayName,
  status,
  unit,
  barWeight,
  plates,
  exercises,
  existingSets,
  lastSets,
  library,
}: {
  sessionId: string;
  sessionDate: string;
  dayName: string;
  status: "in_progress" | "completed" | "skipped";
  unit: WeightUnit;
  barWeight: number;
  plates: PlateDenom[];
  exercises: WorkoutExercise[];
  existingSets: WorkoutSet[];
  lastSets: Record<string, WorkoutSet[]>;
  library: { key: string; name: string }[];
}) {
  const router = useRouter();
  const readOnly = status === "completed" || status === "skipped";

  const initialOrder = useMemo(() => {
    const keys = exercises.map((e) => e.key);
    for (const set of existingSets) if (!keys.includes(set.exerciseKey)) keys.push(set.exerciseKey);
    return keys;
  }, [exercises, existingSets]);

  const [order, setOrder] = useState<string[]>(initialOrder);
  const [logged, setLogged] = useState<WorkoutSet[]>(existingSets);
  const [drafts, setDrafts] = useState<Record<string, Draft>>(() => {
    const next: Record<string, Draft> = {};
    for (const exercise of exercises) {
      const last = lastSets[exercise.key] ?? [];
      for (let i = 0; i < exercise.targetSets; i++) {
        const source = last[i] ?? last[last.length - 1];
        next[`${exercise.key}:${i}`] = {
          weight: String(source?.weight ?? 0),
          reps: String(source?.reps ?? exercise.repMin),
        };
      }
    }
    return next;
  });
  const [rows, setRows] = useState<Record<string, number>>(() => {
    const next: Record<string, number> = {};
    for (const exercise of exercises) {
      const done = existingSets.filter((s) => s.exerciseKey === exercise.key).length;
      next[exercise.key] = Math.max(exercise.targetSets, done + 1);
    }
    return next;
  });
  const [picker, setPicker] = useState<{ key: string; index: number } | null>(null);
  const [chipsByRow, setChipsByRow] = useState<Record<string, PickedPlate[]>>({});
  const [pending, setPending] = useState(0);
  const [banner, setBanner] = useState<string | null>(null);
  const [added, setAdded] = useState("");

  useEffect(() => {
    const unsubscribe = subscribeQueue(setPending);
    const stop = installAutoFlush();
    void flushQueue();
    return () => {
      unsubscribe();
      stop();
    };
  }, []);

  const exerciseByKey = useMemo(() => new Map(exercises.map((e) => [e.key, e])), [exercises]);
  const libraryByKey = useMemo(() => new Map(library.map((e) => [e.key, e.name])), [library]);

  const setsByExercise = useMemo(() => {
    const map = new Map<string, WorkoutSet[]>();
    for (const set of logged) {
      const list = map.get(set.exerciseKey) ?? [];
      list.push(set);
      map.set(set.exerciseKey, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.setIndex - b.setIndex);
    return map;
  }, [logged]);

  function setDraft(key: string, index: number, field: keyof Draft, value: string) {
    setDrafts((prev) => ({
      ...prev,
      [`${key}:${index}`]: { ...(prev[`${key}:${index}`] ?? { weight: "0", reps: "0" }), [field]: value },
    }));
  }

  async function logSet(
    key: string,
    index: number,
    opts?: { weight?: number; chips?: PickedPlate[] },
  ) {
    const draft = drafts[`${key}:${index}`] ?? { weight: "0", reps: "0" };
    const weight = opts?.weight ?? (Number(draft.weight) || 0);
    const reps = Number(draft.reps) || 0;
    const chips = opts?.chips ?? chipsByRow[`${key}:${index}`] ?? null;
    if (reps <= 0) {
      setBanner("Add reps before logging the set.");
      return;
    }
    const id = newId();
    const local: WorkoutSet = {
      id,
      exerciseKey: key,
      setIndex: index,
      weight,
      reps,
      plates: chips,
      isWarmup: false,
    };
    setLogged((prev) => [...prev, local]);
    setChipsByRow((prev) => {
      const next = { ...prev };
      delete next[`${key}:${index}`];
      return next;
    });
    setBanner(null);

    // Prefill the next row from this one so the next set is one tap away.
    const nextIndex = index + 1;
    if ((rows[key] ?? 0) <= nextIndex) setRows((prev) => ({ ...prev, [key]: nextIndex + 1 }));
    setDrafts((prev) => ({
      ...prev,
      [`${key}:${nextIndex}`]: { weight: String(weight), reps: String(reps) },
    }));

    await enqueue({
      id,
      kind: "set_upsert",
      data: {
        session_id: sessionId,
        exercise_key: key,
        set_index: index,
        weight_kg: toKg(weight, unit),
        display_weight: weight,
        display_unit: unit,
        plates: chips,
        reps,
        is_warmup: false,
        is_pr: false,
        client_updated_at: new Date().toISOString(),
      },
    });

    const result = await flushQueue();
    if (result.errors.length > 0) {
      setBanner(`Set saved on this device, but the server rejected it: ${result.errors[0].error}`);
    }
  }

  async function removeSet(set: WorkoutSet) {
    setLogged((prev) => prev.filter((s) => s.id !== set.id));
    await enqueue({ id: set.id, kind: "set_delete" });
    await flushQueue();
  }

  async function finish() {
    await enqueue({
      id: sessionId,
      kind: "session_complete",
      data: { ended_at: new Date().toISOString() },
    });
    const result = await flushQueue();
    const left = await pendingCount();
    if (result.failed > 0 || left > 0) {
      setBanner(
        left > 0
          ? `Saved on this device — ${left} item${left === 1 ? "" : "s"} will sync when the connection is back.`
          : "The server rejected the last change. Retry from the sync banner.",
      );
      return;
    }
    router.push("/gym");
    router.refresh();
  }

  function addExercise(key: string) {
    if (!key || order.includes(key)) return;
    setOrder((prev) => [...prev, key]);
    setRows((prev) => ({ ...prev, [key]: 3 }));
    setDrafts((prev) => {
      const next = { ...prev };
      for (let i = 0; i < 3; i++) next[`${key}:${i}`] = { weight: "0", reps: "8" };
      return next;
    });
    setAdded("");
  }

  const totalSets = logged.filter((s) => !s.isWarmup).length;
  const totalVolume = Math.round(
    logged.filter((s) => !s.isWarmup).reduce((sum, s) => sum + toKg(s.weight, unit) * s.reps, 0),
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link href="/gym" className="text-xs font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900">
            ← Gym
          </Link>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">{dayName}</h1>
          <p className="text-xs text-neutral-500">
            {new Date(`${sessionDate}T00:00:00Z`).toLocaleDateString("en-IN", {
              weekday: "long",
              day: "numeric",
              month: "short",
              timeZone: "UTC",
            })}{" "}
            · {totalSets} sets · {totalVolume.toLocaleString("en-IN")} kg volume
          </p>
        </div>
        <div className="text-right">
          <p
            className={`inline-block border-2 border-neutral-900 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide ${
              pending === 0 ? "bg-emerald-300" : "bg-amber-200 nb-blink"
            }`}
          >
            {pending === 0 ? "All sets synced" : `${pending} pending`}
          </p>
          {readOnly ? (
            <p className="mt-1 text-[10px] font-bold uppercase text-neutral-400">Completed</p>
          ) : (
            <button
              type="button"
              onClick={() => void finish()}
              className="mt-1 block w-full border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
            >
              Finish workout
            </button>
          )}
        </div>
      </div>

      {banner && (
        <p className="border-2 border-neutral-900 bg-amber-200 px-3 py-2 text-xs font-bold shadow-[2px_2px_0_#111]">
          {banner}
        </p>
      )}

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-2 border-2 border-neutral-900 bg-white p-2 shadow-[2px_2px_0_#111]">
          <select
            value={added}
            onChange={(e) => setAdded(e.target.value)}
            className="min-w-48 flex-1 border-2 border-neutral-900 px-2 py-2 text-xs font-bold"
            aria-label="Add an exercise"
          >
            <option value="">Add an exercise…</option>
            {library.map((e) => (
              <option key={e.key} value={e.key}>
                {e.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => addExercise(added)}
            className="border-2 border-neutral-900 bg-yellow-300 px-3 py-2 text-xs font-extrabold uppercase"
          >
            Add
          </button>
        </div>
      )}

      {order.map((key) => {
        const exercise = exerciseByKey.get(key) ?? {
          key,
          name: libraryByKey.get(key) ?? "Exercise",
          targetSets: 3,
          repMin: 8,
          repMax: 12,
          incrementKg: 2.5,
          note: null,
        };
        const done = setsByExercise.get(key) ?? [];
        const maxIndex = done.reduce((max, s) => Math.max(max, s.setIndex), -1);
        const rowCount = readOnly
          ? maxIndex + 1
          : Math.max(rows[key] ?? exercise.targetSets, maxIndex + 2, 1);
        const last = lastSets[key];

        return (
          <section key={key} className="rounded-none border-2 border-neutral-900 bg-white p-4 shadow-[4px_4px_0_#111]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-base font-extrabold">{exercise.name}</h2>
                <p className="text-[11px] text-neutral-500">
                  Target {exercise.targetSets} × {exercise.repMin}–{exercise.repMax} · {summary(last)}
                </p>
                {exercise.note && <p className="mt-1 text-[11px] italic text-neutral-400">{exercise.note}</p>}
              </div>
              {!readOnly && last && last.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const lastWorking = last.filter((s) => !s.isWarmup);
                    setDrafts((prev) => {
                      const next = { ...prev };
                      const count = Math.max(rowCount, lastWorking.length);
                      for (let i = 0; i < count; i++) {
                        const source = lastWorking[i] ?? lastWorking[lastWorking.length - 1];
                        next[`${key}:${i}`] = {
                          weight: String(source?.weight ?? 0),
                          reps: String(source?.reps ?? exercise.repMin),
                        };
                      }
                      return next;
                    });
                  }}
                  className="border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide"
                >
                  Copy last
                </button>
              )}
            </div>

            <div className="mt-3 space-y-1.5">
              {Array.from({ length: rowCount }).map((_, index) => {
                const doneSet = done.find((s) => s.setIndex === index);
                if (doneSet) {
                  return (
                    <div
                      key={index}
                      className="flex items-center gap-2 border-2 border-neutral-900 bg-emerald-100 px-2 py-1.5"
                    >
                      <span className="w-10 text-[10px] font-extrabold uppercase text-neutral-500">Set {index + 1}</span>
                      <span className="text-sm font-extrabold">
                        {round(doneSet.weight)} {unit} × {doneSet.reps}
                      </span>
                      {doneSet.plates && doneSet.plates.length > 0 && (
                        <span className="text-[10px] font-bold text-neutral-500">
                          {doneSet.plates.map((p) => `${p.label}×${p.qty}`).join(" + ")} /side
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-extrabold uppercase text-emerald-700">✓</span>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => void removeSet(doneSet)}
                          className="text-[10px] font-extrabold uppercase text-neutral-400 hover:text-red-600"
                          aria-label={`Remove set ${index + 1}`}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  );
                }

                const draft = drafts[`${key}:${index}`] ?? { weight: "0", reps: String(exercise.repMin) };
                return (
                  <div key={index} className="flex flex-wrap items-center gap-2 border-2 border-neutral-200 px-2 py-1.5">
                    <span className="w-10 text-[10px] font-extrabold uppercase text-neutral-400">Set {index + 1}</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      step="0.5"
                      min="0"
                      value={draft.weight}
                      onChange={(e) => setDraft(key, index, "weight", e.target.value)}
                      className="w-20 border-2 border-neutral-900 px-2 py-1.5 text-center text-base font-extrabold focus:shadow-[2px_2px_0_#111] focus:outline-none"
                      aria-label={`${exercise.name} set ${index + 1} weight`}
                    />
                    <span className="text-[10px] font-extrabold uppercase text-neutral-400">{unit}</span>
                    <button
                      type="button"
                      onClick={() => setPicker({ key, index })}
                      className="border-2 border-neutral-900 bg-amber-100 px-2 py-1 text-[10px] font-extrabold uppercase"
                      aria-label="Open plate calculator"
                    >
                      🍽 plates
                    </button>
                    {chipsByRow[`${key}:${index}`]?.length ? (
                      <span className="text-[9px] font-bold text-neutral-500">
                        {chipsByRow[`${key}:${index}`].map((c) => `${c.label}×${c.qty}`).join(" + ")} /side
                      </span>
                    ) : null}
                    <span className="text-xs font-bold text-neutral-400">×</span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      max="100"
                      value={draft.reps}
                      onChange={(e) => setDraft(key, index, "reps", e.target.value)}
                      className="w-14 border-2 border-neutral-900 px-2 py-1.5 text-center text-base font-extrabold focus:shadow-[2px_2px_0_#111] focus:outline-none"
                      aria-label={`${exercise.name} set ${index + 1} reps`}
                    />
                    <span className="text-[10px] font-extrabold uppercase text-neutral-400">reps</span>
                    <button
                      type="button"
                      onClick={() => void logSet(key, index)}
                      className="ml-auto border-2 border-neutral-900 bg-emerald-400 px-3 py-1.5 text-xs font-extrabold uppercase shadow-[2px_2px_0_#111] nb-press"
                    >
                      ✓ Log
                    </button>
                    <p className="w-full text-[10px] text-neutral-400">
                      {unit === "kg"
                        ? `≈ ${round(Number(draft.weight) * 2.20462)} lb`
                        : `≈ ${round(Number(draft.weight) * 0.453592)} kg`}
                    </p>
                  </div>
                );
              })}
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => setRows((prev) => ({ ...prev, [key]: (prev[key] ?? exercise.targetSets) + 1 }))}
                className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900"
              >
                + Add a set
              </button>
            )}
          </section>
        );
      })}

      {order.length === 0 && (
        <p className="border-2 border-dashed border-neutral-300 p-6 text-center text-sm text-neutral-400">
          No exercises on this session. Add one above, or start from a program.
        </p>
      )}

      {picker && (
        <PlatePicker
          unit={unit}
          barWeight={barWeight}
          plates={plates}
          initialWeight={Number(drafts[`${picker.key}:${picker.index}`]?.weight) || barWeight}
          onClose={() => setPicker(null)}
          onPick={(weight, chips) => {
            const rowKey = `${picker.key}:${picker.index}`;
            setDraft(picker.key, picker.index, "weight", String(weight));
            setChipsByRow((prev) => ({ ...prev, [rowKey]: chips }));
            setPicker(null);
          }}
        />
      )}
    </div>
  );
}

"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  EQUIPMENT_CATEGORY_LABELS,
  FULL_GYM_IDS,
  GYM_EQUIPMENT,
  HOME_GYM_IDS,
  equipmentPhotos,
  type EquipmentCategory,
  type GymEquipment,
} from "@/data/gym-equipment";
import { PROGRAM_TEMPLATES } from "@/lib/gym/program";
import {
  KG_BARS,
  KG_PLATE_PRESET,
  LB_BARS,
  LB_PLATE_PRESET,
  WEEKDAY_LABELS,
  type PlateDenom,
  type WeightUnit,
} from "@/lib/gym/types";
import { presetPlates } from "@/lib/gym/plates";
import { saveGymSetup } from "../actions";
import { SubmitButton } from "@/components/submit-button";

const PLATE_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#fde047",
  green: "#22c55e",
  white: "#ffffff",
  chrome: "#d4d4d4",
};

const input =
  "rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";
const chip =
  "rounded-none border-2 border-neutral-900 px-3 py-1.5 text-[11px] font-extrabold uppercase tracking-wide transition-all";

export interface SetupInitial {
  unit: WeightUnit;
  barWeight: number;
  equipmentIds: string[];
  trainingDays: number[];
  plates: PlateDenom[];
  templateId: string;
}

export function SetupForm({ initial }: { initial: SetupInitial }) {
  const [state, action] = useActionState(saveGymSetup, { error: null, ok: null });
  const [unit, setUnit] = useState<WeightUnit>(initial.unit);
  const [barWeight, setBarWeight] = useState(initial.barWeight);
  const [equipmentIds, setEquipmentIds] = useState<string[]>(initial.equipmentIds);
  const [trainingDays, setTrainingDays] = useState<number[]>(initial.trainingDays);
  const [plates, setPlates] = useState<PlateDenom[]>(
    initial.plates.length > 0 ? initial.plates : presetPlates(initial.unit),
  );
  const [templateId, setTemplateId] = useState(initial.templateId);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | EquipmentCategory>("all");

  const equipment = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...GYM_EQUIPMENT]
      .filter((e) => (category === "all" ? true : e.category === category))
      .filter((e) => (q ? `${e.name} ${e.hint ?? ""}`.toLowerCase().includes(q) : true))
      .sort((a, b) => a.popularity - b.popularity);
  }, [category, query]);

  // Canonical category order, only non-empty rails (search narrows these).
  const groups = useMemo(() => {
    const order = Object.keys(EQUIPMENT_CATEGORY_LABELS) as EquipmentCategory[];
    return order
      .map((cat) => [cat, equipment.filter((e) => e.category === cat)] as const)
      .filter(([, list]) => list.length > 0);
  }, [equipment]);

  const selected = new Set(equipmentIds);
  const toggle = (id: string) =>
    setEquipmentIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  const toggleDay = (day: number) =>
    setTrainingDays((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort()));  function changeUnit(next: WeightUnit) {
    setUnit(next);
    setBarWeight(next === "lb" ? 45 : 20);
    setPlates(presetPlates(next));
  }

  function setCount(id: string, delta: number) {
    setPlates((prev) =>
      prev.map((p) => (p.id === id ? { ...p, count: Math.max(0, Math.min(40, p.count + delta)) } : p)),
    );
  }

  function addPlate() {
    setPlates((prev) => [
      ...prev,
      { id: `custom-${Date.now()}`, label: "Plate", weight: 1.25, count: 2, color: "chrome" },
    ]);
  }

  const bars = unit === "lb" ? LB_BARS : KG_BARS;

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="unit" value={unit} />
      <input type="hidden" name="barWeight" value={barWeight} />
      <input type="hidden" name="equipmentIds" value={JSON.stringify(equipmentIds)} />
      <input type="hidden" name="trainingDays" value={JSON.stringify(trainingDays)} />
      <input type="hidden" name="plates" value={JSON.stringify(plates)} />
      <input type="hidden" name="templateId" value={templateId} />

      {/* ── Equipment ─────────────────────────────────────────────────── */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">
              1. What does your gym have?
            </h2>
            <p className="mt-1 text-xs text-neutral-500">
              {equipmentIds.length} selected. Tick the machines you recognise — the photos are a guide,
              names vary by gym.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            <button type="button" onClick={() => setEquipmentIds(FULL_GYM_IDS)} className={`${chip} bg-white nb-press`}>
              Full gym
            </button>
            <button type="button" onClick={() => setEquipmentIds(HOME_GYM_IDS)} className={`${chip} bg-white nb-press`}>
              Home
            </button>
            <button type="button" onClick={() => setEquipmentIds([])} className={`${chip} bg-white nb-press`}>
              Clear
            </button>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chest press, cables, leg curl…"
            className={`${input} min-w-56 flex-1`}
            aria-label="Search equipment"
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "all" | EquipmentCategory)}
            className={input}
            aria-label="Equipment category"
          >
            <option value="all">All categories</option>
            {Object.entries(EQUIPMENT_CATEGORY_LABELS).map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-4 space-y-5">
          {groups.map(([cat, list]) => (
            <div key={cat}>
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <h3 className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {EQUIPMENT_CATEGORY_LABELS[cat]}
                  <span className="ml-1.5 font-bold tabular-nums text-neutral-400">{list.length}</span>
                </h3>
                <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">
                  scroll sideways →
                </span>
              </div>
              <div
                className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:border [&::-webkit-scrollbar-thumb]:border-neutral-400 [&::-webkit-scrollbar-thumb]:bg-neutral-300 [&::-webkit-scrollbar-track]:bg-neutral-100"
                role="group"
                aria-label={`${EQUIPMENT_CATEGORY_LABELS[cat]} equipment`}
              >
                {list.map((e) => (
                  <EquipmentCard
                    key={e.id}
                    e={e}
                    on={selected.has(e.id)}
                    onToggle={() => toggle(e.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        {equipment.length === 0 && (
          <p className="mt-4 border-2 border-dashed border-neutral-300 p-4 text-center text-xs text-neutral-400">
            No equipment matches that search. Clear the search or add a custom exercise later.
          </p>
        )}
      </section>

      {/* ── Training days ─────────────────────────────────────────────── */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">2. Training days</h2>
        <p className="mt-1 text-xs text-neutral-500">
          Rest days are part of the plan. Your calories shift carbs toward these days and away from the rest.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {WEEKDAY_LABELS.map((label, index) => {
            const on = trainingDays.includes(index);
            return (
              <button
                key={label}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDay(index)}
                className={`h-12 w-14 border-2 border-neutral-900 text-xs font-extrabold uppercase transition-all ${
                  on ? "bg-emerald-400 shadow-[2px_2px_0_#111]" : "bg-white text-neutral-400"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-neutral-400">
          {trainingDays.length === 0
            ? "Pick at least one day."
            : `${trainingDays.length} training days · ${7 - trainingDays.length} rest days`}
        </p>
      </section>

      {/* ── Bar & plates ──────────────────────────────────────────────── */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">3. Bar & plates</h2>
            <p className="mt-1 text-xs text-neutral-500">
              Set the plate colours once. The calculator will tell you what to load — and what the bar weighs.
            </p>
          </div>
          <div className="flex gap-1">
            {(["kg", "lb"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => changeUnit(u)}
                className={`${chip} ${unit === u ? "bg-yellow-300" : "bg-white"}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-xs font-bold text-neutral-600">
            Bar weight ({unit})
            <input
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={barWeight}
              onChange={(e) => setBarWeight(Number(e.target.value))}
              className={`${input} mt-1 w-full`}
            />
            <span className="mt-1 block text-[10px] font-normal text-neutral-400">
              {bars.map((b) => b.label).join(" · ")}
            </span>
          </label>
          <div className="flex items-end gap-1.5">
            {bars.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setBarWeight(b.weight)}
                className={`${chip} ${barWeight === b.weight ? "bg-lime-200" : "bg-white"}`}
              >
                {b.weight}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4 space-y-2">
          {plates.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 border-2 border-neutral-900 bg-amber-50 p-2">
              <span
                className="h-7 w-7 shrink-0 border-2 border-neutral-900"
                style={{ background: PLATE_COLORS[p.color ?? "chrome"] ?? "#d4d4d4" }}
                aria-hidden
              />
              <input
                value={p.label}
                onChange={(e) =>
                  setPlates((prev) => prev.map((x) => (x.id === p.id ? { ...x, label: e.target.value } : x)))
                }
                className={`${input} w-20`}
                aria-label="Plate label"
              />
              <input
                type="number"
                min="0"
                step="0.25"
                value={p.weight}
                onChange={(e) =>
                  setPlates((prev) =>
                    prev.map((x) => (x.id === p.id ? { ...x, weight: Number(e.target.value) } : x)),
                  )
                }
                className={`${input} w-24`}
                aria-label="Plate weight"
              />
              <span className="text-[10px] font-extrabold uppercase text-neutral-400">×</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCount(p.id, -1)}
                  className="h-8 w-8 border-2 border-neutral-900 bg-white text-sm font-extrabold"
                  aria-label={`Remove one ${p.label}`}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-extrabold">{p.count}</span>
                <button
                  type="button"
                  onClick={() => setCount(p.id, 1)}
                  className="h-8 w-8 border-2 border-neutral-900 bg-white text-sm font-extrabold"
                  aria-label={`Add one ${p.label}`}
                >
                  +
                </button>
              </div>
              <button
                type="button"
                onClick={() => setPlates((prev) => prev.filter((x) => x.id !== p.id))}
                className="ml-auto text-[10px] font-extrabold uppercase text-neutral-400 hover:text-red-600"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[10px] text-neutral-400">
          Count is the total number of that plate in the gym, both sides. The calculator puts half on each side.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={addPlate} className={`${chip} bg-white nb-press`}>
            + Add a plate
          </button>
          <button
            type="button"
            onClick={() => setPlates(presetPlates(unit))}
            className={`${chip} bg-white nb-press`}
          >
            Reset to standard {(unit === "lb" ? LB_PLATE_PRESET : KG_PLATE_PRESET).length} plates
          </button>
        </div>
      </section>

      {/* ── Program ───────────────────────────────────────────────────── */}
      <section className="rounded-none border-2 border-neutral-900 bg-white p-5 shadow-[4px_4px_0_#111]">
        <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-500">4. Pick a split</h2>
        <p className="mt-1 text-xs text-neutral-500">
          You can change this later. Exercises your equipment can&apos;t support are dropped automatically.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {PROGRAM_TEMPLATES.map((t) => {
            const on = templateId === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTemplateId(t.id)}
                aria-pressed={on}
                className={`border-2 border-neutral-900 p-3 text-left transition-all ${
                  on ? "bg-yellow-300 shadow-none" : "bg-white shadow-[2px_2px_0_#111] hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none"
                }`}
              >
                <p className="text-sm font-extrabold">{t.name}</p>
                <p className="mt-0.5 text-[11px] text-neutral-600">{t.description}</p>
                <p className="mt-1 text-[10px] font-extrabold uppercase tracking-wide text-neutral-400">
                  {t.days.map((d) => d.name).join(" · ")}
                </p>
              </button>
            );
          })}
        </div>
      </section>

      {state.error && (
        <p className="border-2 border-neutral-900 bg-red-200 px-4 py-3 text-sm font-bold shadow-[2px_2px_0_#111]">
          {state.error}
        </p>
      )}
      {state.ok && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-2 border-neutral-900 bg-emerald-300 px-4 py-3 text-sm font-bold shadow-[2px_2px_0_#111]">
          <span>{state.ok}</span>
          <Link href="/gym" className="underline">
            Go to Gym →
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton
          pendingText="Building your program…"
          className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-6 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
        >
          Save & build my program
        </SubmitButton>
        <span className="text-[11px] text-neutral-400">
          {equipmentIds.length} equipment · {trainingDays.length} days · {plates.length} plate types
        </span>
      </div>
    </form>
  );
}

/**
 * Equipment card with a swipeable photo gallery. The images are a scroll
 * container (not a button), so a horizontal swipe never toggles selection —
 * the badge and the caption are the explicit select controls.
 */
function EquipmentCard({
  e,
  on,
  onToggle,
}: {
  e: GymEquipment;
  on: boolean;
  onToggle: () => void;
}) {
  const photos = equipmentPhotos(e);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  function handleScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const next = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
    setActive((cur) => (cur === next ? cur : next));
  }

  function page(dir: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div
      className={`group relative flex w-[210px] shrink-0 snap-start flex-col overflow-hidden border-2 border-neutral-900 text-left transition-all sm:w-[230px] ${
        on ? "bg-emerald-300 shadow-none" : "bg-white shadow-[2px_2px_0_#111]"
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden border-b-2 border-neutral-900 bg-neutral-100">
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          role="group"
          aria-label={`${e.name} photos`}
          className="flex h-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {(photos.length > 0 ? photos : ["/gym-equipment/placeholder.svg"]).map((src, index) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={`${src}-${index}`}
              src={src}
              alt={`${e.name} — photo ${index + 1}`}
              loading="lazy"
              draggable={false}
              onError={(event) => {
                event.currentTarget.src = "/gym-equipment/placeholder.svg";
              }}
              className="h-full w-full shrink-0 select-none snap-center object-cover"
            />
          ))}
        </div>

        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => page(-1)}
              aria-label="Previous photo"
              className="absolute left-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center border-2 border-neutral-900 bg-white/90 text-xs font-extrabold shadow-[2px_2px_0_#111] transition hover:bg-yellow-200"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => page(1)}
              aria-label="Next photo"
              className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center border-2 border-neutral-900 bg-white/90 text-xs font-extrabold shadow-[2px_2px_0_#111] transition hover:bg-yellow-200"
            >
              ›
            </button>
            <div className="absolute inset-x-0 bottom-1.5 flex justify-center gap-1">
              {photos.map((src, index) => (
                <span
                  key={src}
                  className={`h-1.5 w-1.5 border border-neutral-900 ${
                    index === active ? "bg-neutral-900" : "bg-white/80"
                  }`}
                />
              ))}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={onToggle}
          aria-pressed={on}
          className={`absolute right-1.5 top-1.5 flex items-center gap-1 border-2 border-neutral-900 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] ${
            on ? "bg-yellow-300" : "bg-white"
          }`}
        >
          {on ? "✓ Selected" : "+ Select"}
        </button>
      </div>

      <button type="button" onClick={onToggle} aria-pressed={on} className="flex-1 p-2.5 text-left">
        <p className="text-sm font-extrabold leading-snug">{e.name}</p>
        {e.hint && <p className="mt-1 line-clamp-2 text-xs leading-snug text-neutral-500">{e.hint}</p>}
      </button>
    </div>
  );
}

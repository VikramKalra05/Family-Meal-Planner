"use client";

import { useEffect, useRef, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import {
  addIntakeItem,
  clearIntakeDay,
  deleteIntakeItem,
  updateIntakeItem,
  type IntakeEditState,
} from "./intake-actions";
import { SubmitButton } from "@/components/submit-button";
import {
  SLOT_LABEL,
  SLOT_ORDER,
  groupBySlot,
  macroContributions,
  pctOf,
  remaining,
  shiftISO,
  targetsToTotals,
  totals,
  type IntakeItem,
  type MacroKey,
} from "@/lib/intake";
import type { NutrientTargets } from "@/lib/nutrition/types";
import { formatIstDate } from "@/lib/date";
import type { MealSlot } from "@/lib/db-types";

const init: IntakeEditState = { error: null, ok: null, ts: 0 };

const field =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-1.5 text-xs focus:shadow-[2px_2px_0_#111] focus:outline-none disabled:bg-neutral-100";
const microLabel = "mb-0.5 block text-[9px] font-extrabold uppercase tracking-widest text-neutral-400";
const smallBtn =
  "rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-40 disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-[2px_2px_0_#111]";

const MACROS: { key: MacroKey; label: string; short: string; chip: string; bar: string; text: string }[] = [
  { key: "protein", label: "Protein", short: "P", chip: "bg-lime-200", bar: "bg-lime-500", text: "text-lime-800" },
  { key: "carbs", label: "Carbs", short: "C", chip: "bg-amber-200", bar: "bg-amber-500", text: "text-amber-800" },
  { key: "fat", label: "Fat", short: "F", chip: "bg-red-200", bar: "bg-red-500", text: "text-red-800" },
  { key: "fiber", label: "Fiber", short: "Fb", chip: "bg-violet-200", bar: "bg-violet-500", text: "text-violet-800" },
];

const SOURCE_LABEL: Record<string, string> = {
  ai_chat: "AI",
  plan: "plan",
  manual: "manual",
  form: "manual",
};

const r1 = (n: number) => Math.round(n * 10) / 10;

interface DiaryProps {
  /** Day being viewed (IST, YYYY-MM-DD). */
  date: string;
  /** Today in IST — the newest day the diary can show. */
  today: string;
  items: IntakeItem[];
  targets: NutrientTargets | null;
}

/**
 * HealthifyMe-style food diary: per-item macros, meal sections, a macro
 * "analysis" view, and edits that actually fix a mis-logged day.
 */
export function IntakeDiary({ date, today, items, targets }: DiaryProps) {
  const router = useRouter();
  const day = totals(items);
  const t = targetsToTotals(targets);
  const left = remaining(day.kcal, t?.kcal);
  const [view, setView] = useState<"meal" | "macro">("meal");
  const [adding, setAdding] = useState<MealSlot | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  const isToday = date === today;
  const groups = groupBySlot(items);

  function go(next: string) {
    router.push(next === today ? "/" : `/?d=${next}`);
  }

  return (
    <section className="rounded-none border-2 border-neutral-900 bg-white shadow-[4px_4px_0_#111]">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-neutral-900 bg-yellow-100 px-5 py-3">
        <div>
          <h2 className="text-sm font-extrabold uppercase tracking-widest text-neutral-700">Meals &amp; intake</h2>
          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
            {isToday ? "Today" : formatIstDate(date, { weekday: "short", day: "numeric", month: "short" })}
            {items.length > 0 ? ` · ${items.length} item${items.length === 1 ? "" : "s"}` : " · nothing logged"}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => go(shiftISO(date, -1))} aria-label="Previous day" className={smallBtn}>
            ‹
          </button>
          <input
            type="date"
            value={date}
            max={today}
            onChange={(e) => {
              const v = e.target.value;
              if (v && v <= today) go(v);
            }}
            aria-label="Diary date"
            className="rounded-none border-2 border-neutral-900 bg-white px-2 py-1 text-[11px] font-bold focus:shadow-[2px_2px_0_#111] focus:outline-none"
          />
          <button
            type="button"
            onClick={() => go(shiftISO(date, 1))}
            disabled={date >= today}
            aria-label="Next day"
            className={smallBtn}
          >
            ›
          </button>
          {!isToday && (
            <button type="button" onClick={() => go(today)} className={`${smallBtn} bg-lime-300`}>
              Today
            </button>
          )}
        </div>
      </header>

      {/* Day totals */}
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p className="text-2xl font-extrabold leading-none tabular-nums text-neutral-900">
            {Math.round(day.kcal)}
            <span className="text-sm font-bold text-neutral-400"> / {t ? Math.round(t.kcal) : "—"} kcal</span>
          </p>
          {left != null && (
            <p className={`text-xs font-extrabold uppercase tracking-wide tabular-nums ${left < 0 ? "text-red-600" : "text-emerald-700"}`}>
              {left >= 0 ? `${left} kcal left` : `${Math.abs(left)} kcal over`}
            </p>
          )}
        </div>
        <div className="h-4 w-full border-2 border-neutral-900 bg-white" role="presentation">
          <div
            className={`h-full transition-[width] duration-300 ${left != null && left < 0 ? "bg-red-400" : "bg-lime-400"}`}
            style={{ width: `${pctOf(day.kcal, t?.kcal)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {MACROS.map((m) => {
            const value = day[m.key];
            const target = t?.[m.key] ?? null;
            return (
              <div key={m.key} className={`border-2 border-neutral-900 px-2.5 py-1.5 shadow-[2px_2px_0_#111] ${m.chip}`}>
                <p className={`text-[10px] font-extrabold uppercase tracking-widest ${m.text}`}>{m.label}</p>
                <p className="text-base font-extrabold tabular-nums text-neutral-900">
                  {r1(value)}
                  <span className="text-[10px] font-bold text-neutral-600"> / {target == null ? "—" : r1(target)} g</span>
                </p>
                <div className="mt-1 h-1.5 w-full bg-white/70">
                  <div className="h-full bg-neutral-900" style={{ width: `${pctOf(value, target)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* View switch + clear */}
      <div className="flex items-center border-y-2 border-neutral-900">
        <button
          type="button"
          onClick={() => setView("meal")}
          aria-pressed={view === "meal"}
          className={`flex-1 px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest transition-colors sm:flex-none sm:px-5 ${
            view === "meal" ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:bg-amber-50"
          }`}
        >
          By meal
        </button>
        <button
          type="button"
          onClick={() => setView("macro")}
          aria-pressed={view === "macro"}
          className={`flex-1 px-3 py-2 text-[11px] font-extrabold uppercase tracking-widest transition-colors sm:flex-none sm:px-5 ${
            view === "macro" ? "bg-neutral-900 text-white" : "bg-white text-neutral-500 hover:bg-amber-50"
          }`}
        >
          By macro
        </button>
        {items.length > 0 && <ClearDay date={date} className="ml-auto" />}
      </div>

      {view === "meal" ? (
        <div>
          {groups.map((group) => (
            <div key={group.slot} className="border-b-2 border-neutral-900 last:border-b-0">
              <div className="flex items-center justify-between gap-2 bg-neutral-50 px-5 py-1.5">
                <p className="text-[11px] font-extrabold uppercase tracking-widest text-neutral-500">
                  {SLOT_LABEL[group.slot]}
                  {group.items.length > 0 && (
                    <span className="ml-1.5 font-bold tabular-nums text-neutral-400">· {Math.round(group.totals.kcal)} kcal</span>
                  )}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setEditing(null);
                    setAdding(adding === group.slot ? null : group.slot);
                  }}
                  aria-expanded={adding === group.slot}
                  className={smallBtn}
                >
                  {adding === group.slot ? "× Close" : "+ Add"}
                </button>
              </div>

              {adding === group.slot && (
                <ItemForm
                  mode="add"
                  date={date}
                  today={today}
                  slot={group.slot}
                  onSaved={() => setAdding(null)}
                />
              )}

              {group.items.length === 0 && adding !== group.slot && (
                <p className="px-5 py-2.5 text-xs font-medium text-neutral-400">Nothing logged in this meal.</p>
              )}

              {group.items.map((item) =>
                editing === item.id ? (
                  <ItemForm
                    key={item.id}
                    mode="edit"
                    date={date}
                    today={today}
                    slot={item.slot ?? group.slot}
                    item={item}
                    onSaved={() => setEditing(null)}
                  />
                ) : (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-5 py-2.5">
                    <div className="min-w-0">
                      <p className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-neutral-900">
                        <span className="truncate">{item.description ?? "Unnamed item"}</span>
                        <span className="shrink-0 border border-neutral-900 bg-lime-200 px-1 text-[8px] font-extrabold uppercase tracking-wide text-neutral-700">
                          {SOURCE_LABEL[item.source] ?? item.source}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[12px] font-semibold tabular-nums text-neutral-500">
                        <span className="text-emerald-700">P</span> {r1(item.protein_g)}g
                        <span className="text-neutral-300"> · </span>
                        <span className="text-amber-700">C</span> {r1(item.carbs_g)}g
                        <span className="text-neutral-300"> · </span>
                        <span className="text-red-700">F</span> {r1(item.fat_g)}g
                        {item.fiber_g != null && (
                          <>
                            <span className="text-neutral-300"> · </span>
                            <span className="text-violet-700">Fb</span> {r1(item.fiber_g)}g
                          </>
                        )}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <span className="text-sm font-extrabold tabular-nums text-neutral-900">
                        {Math.round(item.kcal)}
                        <span className="ml-0.5 text-[9px] font-bold uppercase text-neutral-400">kcal</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setAdding(null);
                          setEditing(item.id);
                        }}
                        aria-label={`Edit ${item.description ?? "item"}`}
                        title="Edit"
                        className={smallBtn}
                      >
                        ✎
                      </button>
                      <form action={deleteIntakeItem}>
                        <input type="hidden" name="itemId" value={item.id} />
                        <SubmitButton
                          pendingText="…"
                          ariaLabel={`Delete ${item.description ?? "item"}`}
                          title="Delete"
                          className={`${smallBtn} hover:bg-red-200`}
                        >
                          🗑
                        </SubmitButton>
                      </form>
                    </div>
                  </div>
                ),
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid gap-3 bg-white p-4 lg:grid-cols-2">
          <p className="col-span-full text-[11px] font-semibold text-neutral-500">
            Where each macro came from — the small bar is that food&apos;s share of the macro you&apos;ve logged.
          </p>
          {MACROS.map((m) => {
            const value = day[m.key];
            const target = t?.[m.key] ?? null;
            const targetPct = target != null && target > 0 ? Math.round((value / target) * 100) : 0;
            const barPct = Math.min(100, targetPct);
            const contributions = macroContributions(items, m.key, 3);
            return (
              <div
                key={m.key}
                className="flex flex-col border-2 border-neutral-900 bg-white shadow-[3px_3px_0_#111]"
              >
                <div
                  className={`flex items-center justify-between gap-2 border-b-2 border-neutral-900 px-3.5 py-2 ${m.chip}`}
                >
                  <p className={`text-[11px] font-extrabold uppercase tracking-widest ${m.text}`}>{m.label}</p>
                  <p className="text-base font-extrabold tabular-nums text-neutral-900">
                    {r1(value)}
                    <span className="text-[11px] font-bold text-neutral-600">
                      {" "}
                      / {target == null ? "—" : r1(target)} g
                    </span>
                  </p>
                </div>

                <div className="flex flex-1 flex-col gap-3 px-3.5 py-3">
                  <div>
                    <div className="h-3 w-full border-2 border-neutral-900 bg-white">
                      <div className={`h-full ${m.bar}`} style={{ width: `${barPct}%` }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                      <span>{targetPct}% of daily target</span>
                      {target != null && (
                        <span className={`tabular-nums ${value > target ? "text-red-600" : ""}`}>
                          {value > target
                            ? `${r1(value - target)} g over`
                            : `${r1(target - value)} g left`}
                        </span>
                      )}
                    </div>
                  </div>

                  {contributions.length === 0 ? (
                    <p className="text-xs text-neutral-400">Nothing logged for this macro.</p>
                  ) : (
                    <ul className="space-y-2.5">
                      {contributions.map((c) => (
                        <li key={c.description}>
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold text-neutral-800">
                              {c.description}
                            </span>
                            <span className="shrink-0 text-[12px] font-bold tabular-nums text-neutral-700">
                              {c.value} g
                              <span className="ml-1 font-semibold text-neutral-400">· {c.pct}%</span>
                            </span>
                          </div>
                          <div className="mt-1 h-1.5 w-full bg-neutral-100">
                            <div className={`h-full ${m.bar}`} style={{ width: `${c.pct}%` }} />
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

/** Add / edit form. Keeps its own state so each row can close independently. */
function ItemForm({
  mode,
  date,
  today,
  slot,
  item,
  onSaved,
}: {
  mode: "add" | "edit";
  date: string;
  today: string;
  slot: MealSlot;
  item?: IntakeItem;
  onSaved: () => void;
}) {
  const [state, action, pending] = useActionState(
    mode === "add" ? addIntakeItem : updateIntakeItem,
    init,
  );
  const savedTs = useRef(0);
  useEffect(() => {
    if (state.ts && state.ts !== savedTs.current) {
      savedTs.current = state.ts;
      onSaved();
    }
  }, [state.ts, onSaved]);

  return (
    <form action={action} aria-busy={pending} className="space-y-2 border-y-2 border-dashed border-neutral-900 bg-amber-50 px-5 py-3">
      {item && <input type="hidden" name="itemId" value={item.id} />}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <div className="col-span-2">
          <label className={microLabel} htmlFor={`desc-${item?.id ?? `new-${slot}`}`}>Food</label>
          <input
            id={`desc-${item?.id ?? `new-${slot}`}`}
            name="description"
            required
            maxLength={120}
            defaultValue={item?.description ?? ""}
            placeholder="e.g. Poha, 1 plate"
            disabled={pending}
            className={field}
          />
        </div>
        <div>
          <label className={microLabel} htmlFor={`kcal-${item?.id ?? `new-${slot}`}`}>Kcal</label>
          <input id={`kcal-${item?.id ?? `new-${slot}`}`} name="kcal" type="number" min="0" max="5000" step="1" required defaultValue={item ? Math.round(item.kcal) : ""} disabled={pending} className={field} />
        </div>
        <div>
          <label className={`${microLabel} text-emerald-700`} htmlFor={`p-${item?.id ?? `new-${slot}`}`}>Protein g</label>
          <input id={`p-${item?.id ?? `new-${slot}`}`} name="proteinG" type="number" min="0" max="400" step="0.1" defaultValue={item ? r1(item.protein_g) : 0} disabled={pending} className={field} />
        </div>
        <div>
          <label className={`${microLabel} text-amber-700`} htmlFor={`c-${item?.id ?? `new-${slot}`}`}>Carbs g</label>
          <input id={`c-${item?.id ?? `new-${slot}`}`} name="carbsG" type="number" min="0" max="600" step="0.1" defaultValue={item ? r1(item.carbs_g) : 0} disabled={pending} className={field} />
        </div>
        <div>
          <label className={`${microLabel} text-red-700`} htmlFor={`f-${item?.id ?? `new-${slot}`}`}>Fat g</label>
          <input id={`f-${item?.id ?? `new-${slot}`}`} name="fatG" type="number" min="0" max="400" step="0.1" defaultValue={item ? r1(item.fat_g) : 0} disabled={pending} className={field} />
        </div>
        <div>
          <label className={`${microLabel} text-violet-700`} htmlFor={`fb-${item?.id ?? `new-${slot}`}`}>Fiber g</label>
          <input id={`fb-${item?.id ?? `new-${slot}`}`} name="fiberG" type="number" min="0" max="200" step="0.1" defaultValue={item?.fiber_g == null ? 0 : r1(item.fiber_g)} disabled={pending} className={field} />
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <label className={microLabel} htmlFor={`slot-${item?.id ?? `new-${slot}`}`}>Meal</label>
          <select id={`slot-${item?.id ?? `new-${slot}`}`} name="slot" defaultValue={slot} disabled={pending} className={field}>
            {SLOT_ORDER.map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </div>
        <div className="w-36">
          <label className={microLabel} htmlFor={`date-${item?.id ?? `new-${slot}`}`}>Day</label>
          <input id={`date-${item?.id ?? `new-${slot}`}`} name="date" type="date" required defaultValue={item?.logged_on ?? date} max={today} disabled={pending} className={field} />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-[10px] font-extrabold uppercase tracking-wide text-neutral-900 shadow-[2px_2px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-60 ${pending ? "nb-loading cursor-wait" : ""}`}
        >
          {pending ? "◌ Saving…" : mode === "add" ? "+ Add item" : "Save changes"}
        </button>
        <button type="button" onClick={onSaved} disabled={pending} className={smallBtn}>
          Cancel
        </button>
        {state.error && <p className="nb-shake text-[11px] font-bold text-red-700">{state.error}</p>}
      </div>
    </form>
  );
}

/** Two-step clear so a single tap can't wipe a day. */
function ClearDay({ date, className = "" }: { date: string; className?: string }) {
  const [state, action, pending] = useActionState(clearIntakeDay, init);
  const [armed, setArmed] = useState(false);

  return (
    <form action={action} className={`flex items-center gap-2 px-3 py-1 ${className}`}>
      <input type="hidden" name="date" value={date} />
      {state.error && <p className="text-[10px] font-bold text-red-700">{state.error}</p>}
      {state.ok && <p className="text-[10px] font-bold text-emerald-700">{state.ok}</p>}
      {armed ? (
        <>
          <button
            type="submit"
            disabled={pending}
            className="rounded-none border-2 border-neutral-900 bg-red-300 px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] hover:bg-red-400 disabled:opacity-50"
          >
            {pending ? "◌ Clearing…" : "Yes, clear day"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900"
          >
            Cancel
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="text-[10px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-red-600"
        >
          Clear day
        </button>
      )}
    </form>
  );
}

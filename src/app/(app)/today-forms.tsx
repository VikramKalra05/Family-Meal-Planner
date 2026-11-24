"use client";

import { useActionState, useState } from "react";
import {
  cravingAction,
  aiLogIntakeAction,
  type AiLogDraft,
  type IntakeActionState,
} from "./today-actions";
import { AiWorking, WorkingBar } from "@/components/ai-working";
import { DatePicker } from "@/components/date-picker";
import { SLOT_LABEL, shiftISO } from "@/lib/intake";
import { intakeDescription } from "@/lib/ai/meal-parse";
import type { MealSlot } from "@/lib/db-types";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400";
const label = "mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500";
const primary =
  "rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-60";

const init: IntakeActionState = { error: null, ok: null };
const round1 = (n: number) => Math.round(n * 10) / 10;

/** One-tap day targets for the log/move cards. */
function DayChips({
  value,
  onChange,
  today,
}: {
  value: string;
  onChange: (date: string) => void;
  today: string;
}) {
  return (
    <div className="flex gap-1.5">
      {[
        { label: "Yesterday", value: shiftISO(today, -1) },
        { label: "Today", value: today },
        { label: "Tomorrow", value: shiftISO(today, 1) },
      ].map((q) => (
        <button
          key={q.label}
          type="button"
          onClick={() => onChange(q.value)}
          className={`rounded-none border-2 border-neutral-900 px-2 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all ${
            value === q.value ? "bg-yellow-300" : "bg-white hover:bg-amber-50"
          }`}
        >
          {q.label}
        </button>
      ))}
    </div>
  );
}

export function CravingForm() {
  const [state, action, pending] = useActionState(cravingAction, init);

  return (
    <form action={action} aria-busy={pending} className="space-y-2">
      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-48 flex-1">
          <label className={label} htmlFor="craving">Craving something?</label>
          <input
            id="craving"
            name="description"
            required
            disabled={pending}
            placeholder="e.g. samosa from the canteen"
            className={input}
          />
        </div>
        <div className="w-28">
          <label className={label} htmlFor="craving-kcal">Kcal</label>
          <input
            id="craving-kcal"
            name="kcal"
            type="number"
            min="10"
            max="3000"
            required
            disabled={pending}
            placeholder="250"
            className={input}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`${primary} ${pending ? "nb-loading cursor-wait" : ""}`}
        >
          {pending ? "◌ Re-fitting…" : "Log it"}
        </button>
      </div>
      {pending && <WorkingBar label="Logging and re-fitting the rest of your day…" />}
      {state.error && <p className="text-xs font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs font-bold text-emerald-700">{state.ok}</p>}
    </form>
  );
}

export function AiLogForm({ today, initialDate }: { today: string; initialDate: string }) {
  const [state, action, pending] = useActionState(aiLogIntakeAction, init);
  const [day, setDay] = useState(initialDate);
  const draft = state.draft ?? null;
  const logDraft = draft?.kind === "log" ? draft : null;
  const moveDraft = draft?.kind === "move" ? draft : null;

  return (
    <div className="space-y-2">
      <form action={action} aria-busy={pending} className="space-y-2">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div className="min-w-44 flex-1">
            <span className={label}>Day</span>
            <DatePicker
              value={day}
              onChange={setDay}
              today={today}
              label="Meal day"
              className="w-full"
              buttonClassName="flex w-full items-center justify-between border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-bold focus:shadow-[3px_3px_0_#111] focus:outline-none"
            />
          </div>
          <DayChips value={day} onChange={setDay} today={today} />
        </div>
        <input type="hidden" name="date" value={day} />

        <label className={label} htmlFor="ai-text">Or just tell me what you ate</label>
        <textarea
          id="ai-text"
          name="text"
          rows={2}
          required
          disabled={pending}
          placeholder="2 roti and dal — or 'log yesterday's dinner' / 'move the soya tikki to yesterday'"
          className={`${input} resize-none`}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing) return;
            event.preventDefault();
            if (!pending) event.currentTarget.form?.requestSubmit();
          }}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className={`${primary} ${pending && !draft ? "nb-loading cursor-wait" : ""}`}
          >
            {pending && !draft ? "◌ Reading…" : "✨ Parse & review"}
          </button>
          <p className="text-[10px] text-neutral-400">
            Say the day or pick it above — for moves, pick the day the item is on now · Enter to review · Hinglish is fine
          </p>
        </div>
        {pending && !draft && (
          <AiWorking
            label="Reading your meal…"
            hint="The AI is splitting the message into items and estimating Indian home portions. Usually 5–20 seconds; up to a minute on a cold provider."
          />
        )}
      </form>

      {logDraft && (
        <LogDraftCard
          key={JSON.stringify(logDraft)}
          draft={logDraft}
          action={action}
          pending={pending}
          today={today}
        />
      )}
      {moveDraft && (
        <MoveDraftCard
          key={JSON.stringify(moveDraft)}
          draft={moveDraft}
          action={action}
          pending={pending}
          today={today}
        />
      )}

      {state.error && <p className="nb-shake text-xs font-bold text-red-700">{state.error}</p>}
      {state.ok && <p className="nb-stamp text-xs font-extrabold text-emerald-700">{state.ok}</p>}
    </div>
  );
}

function LogDraftCard({
  draft,
  action,
  pending,
  today,
}: {
  draft: Extract<AiLogDraft, { kind: "log" }>;
  action: (payload: FormData) => void;
  pending: boolean;
  today: string;
}) {
  const [date, setDate] = useState(draft.date);
  const [slot, setSlot] = useState<MealSlot>(draft.slot);
  const totals = draft.items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + item.kcal,
      protein: acc.protein + item.proteinG,
      carbs: acc.carbs + item.carbsG,
      fat: acc.fat + item.fatG,
    }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="border-2 border-neutral-900 bg-amber-100 p-3 shadow-[3px_3px_0_#111]">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        Confirm before logging
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <span className={label}>Log to day</span>
          <DatePicker
            value={date}
            onChange={setDate}
            today={today}
            label="Log day"
            className="w-full"
            buttonClassName="flex w-full items-center justify-between border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-bold focus:shadow-[3px_3px_0_#111] focus:outline-none"
          />
          <div className="mt-1.5">
            <DayChips value={date} onChange={setDate} today={today} />
          </div>
        </div>
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Meal
          <select value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)} className={input}>
            {(Object.keys(SLOT_LABEL) as MealSlot[]).map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
        {date === today ? "today" : date} · {SLOT_LABEL[slot]} · {draft.items.length} item
        {draft.items.length === 1 ? "" : "s"}
      </p>
      <ul className="mt-2 divide-y-2 divide-neutral-900/10 border-y-2 border-neutral-900/10">
        {draft.items.map((item, index) => (
          <li key={`${item.name}-${index}`} className="flex items-start justify-between gap-3 py-1.5">
            <span className="text-xs font-semibold text-neutral-800">{intakeDescription(item)}</span>
            <span className="shrink-0 text-xs font-bold tabular-nums text-neutral-600">
              {Math.round(item.kcal)} kcal
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-extrabold uppercase tracking-wide">
        <span className="text-emerald-700">P {round1(totals.protein)}g</span>
        <span className="text-amber-700">C {round1(totals.carbs)}g</span>
        <span className="text-red-700">F {round1(totals.fat)}g</span>
        <span className="ml-auto text-neutral-800">{Math.round(totals.kcal)} kcal</span>
      </div>
      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="draft" value={JSON.stringify({ ...draft, date, slot })} />
        <button
          type="submit"
          name="mode"
          value="confirm"
          disabled={pending}
          className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press disabled:opacity-50"
        >
          {pending ? "◌ Logging…" : "Confirm & log"}
        </button>
        <button
          type="submit"
          name="mode"
          value="cancel"
          disabled={pending}
          className="rounded-none border-2 border-neutral-900 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

function MoveDraftCard({
  draft,
  action,
  pending,
  today,
}: {
  draft: Extract<AiLogDraft, { kind: "move" }>;
  action: (payload: FormData) => void;
  pending: boolean;
  today: string;
}) {
  const [toDate, setToDate] = useState(draft.toDate);
  const [toSlot, setToSlot] = useState<MealSlot>(draft.toSlot);

  return (
    <div className="border-2 border-neutral-900 bg-lime-100 p-3 shadow-[3px_3px_0_#111]">
      <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
        Confirm before moving
      </p>
      <p className="mt-1 text-sm font-extrabold text-neutral-900">{draft.description}</p>
      <p className="mt-1 text-xs font-bold">
        From {draft.date === today ? "today" : draft.date} · {SLOT_LABEL[draft.fromSlot]}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <div>
          <span className={label}>Move to day</span>
          <DatePicker
            value={toDate}
            onChange={setToDate}
            today={today}
            label="Move day"
            className="w-full"
            buttonClassName="flex w-full items-center justify-between border-2 border-neutral-900 bg-white px-3 py-2 text-sm font-bold focus:shadow-[3px_3px_0_#111] focus:outline-none"
          />
          <div className="mt-1.5">
            <DayChips value={toDate} onChange={setToDate} today={today} />
          </div>
        </div>
        <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
          Move to meal
          <select value={toSlot} onChange={(e) => setToSlot(e.target.value as MealSlot)} className={input}>
            {(Object.keys(SLOT_LABEL) as MealSlot[]).map((s) => (
              <option key={s} value={s}>
                {SLOT_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="mt-2 text-[10px] font-extrabold uppercase tracking-wide text-neutral-500">
        {toDate === today ? "today" : toDate} · {SLOT_LABEL[toSlot]}
      </p>
      <form action={action} className="mt-3 flex flex-wrap gap-2">
        <input type="hidden" name="draft" value={JSON.stringify({ ...draft, toDate, toSlot })} />
        <button
          type="submit"
          name="mode"
          value="confirm"
          disabled={pending}
          className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press disabled:opacity-50"
        >
          {pending ? "◌ Moving…" : "Confirm move"}
        </button>
        <button
          type="submit"
          name="mode"
          value="cancel"
          disabled={pending}
          className="rounded-none border-2 border-neutral-900 bg-white px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press disabled:opacity-50"
        >
          Cancel
        </button>
      </form>
    </div>
  );
}

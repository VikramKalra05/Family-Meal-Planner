"use client";

import { useActionState } from "react";
import { cravingAction, aiLogIntakeAction, type IntakeActionState } from "./today-actions";
import { AiWorking, WorkingBar } from "@/components/ai-working";
import { SLOT_LABEL } from "@/lib/intake";
import { intakeDescription } from "@/lib/ai/meal-parse";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400";
const label = "mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500";
const primary =
  "rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-60";

const init: IntakeActionState = { error: null, ok: null };
const round1 = (n: number) => Math.round(n * 10) / 10;

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

export function AiLogForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState(aiLogIntakeAction, init);
  const draft = state.draft ?? null;
  const totals = draft
    ? draft.items.reduce(
        (acc, item) => ({
          kcal: acc.kcal + item.kcal,
          protein: acc.protein + item.proteinG,
          carbs: acc.carbs + item.carbsG,
          fat: acc.fat + item.fatG,
        }),
        { kcal: 0, protein: 0, carbs: 0, fat: 0 },
      )
    : null;

  return (
    <div className="space-y-2">
      <form action={action} aria-busy={pending} className="space-y-2">
        <label className={label} htmlFor="ai-text">Or just tell me what you ate</label>
        <textarea
          id="ai-text"
          name="text"
          rows={2}
          required
          disabled={pending}
          placeholder="2 roti and dal for lunch, plus a mango"
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
            Enter to review · Shift+Enter for a new line · Hinglish is fine. You confirm before anything is saved.
          </p>
        </div>
        {pending && !draft && (
          <AiWorking
            label="Reading your meal…"
            hint="The AI is splitting the message into items and estimating Indian home portions. Usually 5–20 seconds; up to a minute on a cold provider."
          />
        )}
      </form>

      {draft && totals && (
        <div className="border-2 border-neutral-900 bg-amber-100 p-3 shadow-[3px_3px_0_#111]">
          <p className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-500">
            Confirm before logging
          </p>
          <p className="mt-1 text-xs font-bold">
            {SLOT_LABEL[draft.slot] ?? draft.slot} · {draft.date === today ? "today" : draft.date} ·{" "}
            {draft.items.length} item{draft.items.length === 1 ? "" : "s"}
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
            <input type="hidden" name="draft" value={JSON.stringify(draft)} />
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
      )}

      {state.error && <p className="nb-shake text-xs font-bold text-red-700">{state.error}</p>}
      {state.ok && <p className="nb-stamp text-xs font-extrabold text-emerald-700">{state.ok}</p>}
    </div>
  );
}

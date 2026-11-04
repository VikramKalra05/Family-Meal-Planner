"use client";

import { useActionState } from "react";
import { cravingAction, aiLogIntakeAction, type IntakeActionState } from "./today-actions";
import { AiWorking, WorkingBar } from "@/components/ai-working";

const input =
  "w-full rounded-none border-2 border-neutral-900 bg-white px-3 py-2 text-sm transition focus:shadow-[3px_3px_0_#111] focus:outline-none disabled:bg-neutral-100 disabled:text-neutral-400";
const label = "mb-1 block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500";
const primary =
  "rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-60";

const init: IntakeActionState = { error: null, ok: null };

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

export function AiLogForm() {
  const [state, action, pending] = useActionState(aiLogIntakeAction, init);

  return (
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
      />
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pending}
          className={`${primary} ${pending ? "nb-loading cursor-wait" : ""}`}
        >
          {pending ? "◌ Reading…" : "✨ Log with AI"}
        </button>
        <p className="text-[10px] text-neutral-400">
          Parses Hinglish too. Uses your default AI provider.
        </p>
      </div>
      {pending && (
        <AiWorking
          label="Reading your meal…"
          hint="The AI is splitting the message into items and estimating Indian home portions. Usually 5–20 seconds; up to a minute on a cold provider."
        />
      )}
      {state.error && <p className="nb-shake text-xs font-bold text-red-700">{state.error}</p>}
      {state.ok && <p className="nb-stamp text-xs font-extrabold text-emerald-700">{state.ok}</p>}
    </form>
  );
}

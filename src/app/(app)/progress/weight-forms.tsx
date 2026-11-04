"use client";

import { useActionState } from "react";
import { logWeight, setTargetWeight, type WeightActionState } from "./actions";
import { WorkingBar } from "@/components/ai-working";

const input =
  "rounded-none border-2 border-neutral-900 bg-white px-3.5 py-2.5 text-sm focus:shadow-[3px_3px_0_#111] focus:outline-none";
const label = "mb-1.5 block text-xs font-semibold uppercase tracking-wide text-neutral-500";
const primary =
  "rounded-none bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none font-extrabold uppercase tracking-wide disabled:opacity-50";

const init: WeightActionState = { error: null, ok: null };

/** Quick weigh-in form — reused on Progress and the Today dashboard. */
export function QuickLogForm({ compact = false }: { compact?: boolean }) {
  const [state, action, pending] = useActionState(logWeight, init);

  return (
    <form action={action} aria-busy={pending} className={compact ? "flex items-end gap-2" : "flex flex-wrap items-end gap-2"}>
      <div className={compact ? "w-28" : "w-32"}>
        <label className={label} htmlFor={`kg-${compact ? "c" : "f"}`}>Today&apos;s weight (kg)</label>
        <input
          id={`kg-${compact ? "c" : "f"}`}
          name="weightKg" type="number" step="0.1" min="25" max="250" required
          disabled={pending}
          placeholder="69.4"
          className={`${input} w-full disabled:bg-neutral-100`}
        />
      </div>
      <button type="submit" disabled={pending} className={`${primary} ${pending ? "nb-loading cursor-wait" : ""}`}>
        {pending ? "◌ Logging…" : "Log weigh-in"}
      </button>
      {compact ? (
        <span className={`text-xs font-bold ${state.ok ? "nb-stamp text-emerald-700" : "nb-shake text-red-700"}`}>
          {state.ok ?? state.error ?? ""}
        </span>
      ) : (
        <>
          {pending && <div className="w-full"><WorkingBar label="Saving your weigh-in…" /></div>}
          {state.error && <p className="nb-shake w-full text-sm font-bold text-red-700">{state.error}</p>}
          {state.ok && <p className="nb-stamp w-full text-sm font-extrabold text-emerald-700">{state.ok}</p>}
        </>
      )}
    </form>
  );
}

/** Target weight + daily reminder time. */
export function GoalForm({
  targetKg,
  weighInTime,
}: {
  targetKg: number | null;
  weighInTime: string | null;
}) {
  const [state, action, pending] = useActionState(setTargetWeight, init);

  return (
    <form action={action} aria-busy={pending} className="flex flex-wrap items-end gap-2">
      <div className="w-32">
        <label className={label} htmlFor="targetKg">Target weight (kg)</label>
        <input
          id="targetKg" name="targetKg" type="number" step="0.1" min="25" max="250"
          defaultValue={targetKg ?? ""}
          disabled={pending}
          placeholder="e.g. 75"
          className={`${input} w-full disabled:bg-neutral-100`}
        />
      </div>
      <div className="w-36">
        <label className={label} htmlFor="weighInTime">Daily reminder at</label>
        <input
          id="weighInTime" name="weighInTime" type="time"
          defaultValue={weighInTime ?? "07:30"}
          disabled={pending}
          className={`${input} disabled:bg-neutral-100`}
        />
      </div>
      <button type="submit" disabled={pending} className={`${primary} ${pending ? "nb-loading cursor-wait" : ""}`}>
        {pending ? "◌ Saving…" : "Save goal"}
      </button>
      {pending && <div className="w-full"><WorkingBar label="Saving goal and reminder…" /></div>}
      {state.error && <p className="w-full text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="w-full text-sm text-emerald-700">{state.ok}</p>}
      <p className="w-full text-[10px] text-neutral-400">
        Reminder: with the app open, you get a browser notification at that time until the day is logged.
        Every weigh-in also updates your weight and recalculates your targets.
      </p>
    </form>
  );
}

"use client";

import { useActionState } from "react";
import { saveMeasurement } from "../actions";
import { SubmitButton } from "@/components/submit-button";

const input =
  "mt-1 w-full rounded-none border-2 border-neutral-900 bg-white px-2 py-1.5 text-sm focus:shadow-[2px_2px_0_#111] focus:outline-none";

export interface MeasurementInitial {
  waist: number | null;
  chest: number | null;
  arm: number | null;
  thigh: number | null;
  hip: number | null;
  neck: number | null;
  notes: string | null;
}

export function MeasurementForm({
  today,
  initial,
}: {
  today: string;
  initial?: MeasurementInitial | null;
}) {
  const [state, action] = useActionState(saveMeasurement, { error: null, ok: null });

  return (
    <form key={state.ok ?? "new"} action={action} className="mt-3 space-y-2">
      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Date
        <input type="date" name="measuredOn" defaultValue={today} required className={input} />
      </label>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { name: "waist", label: "Waist", value: initial?.waist },
          { name: "chest", label: "Chest", value: initial?.chest },
          { name: "arm", label: "Arm", value: initial?.arm },
          { name: "thigh", label: "Thigh", value: initial?.thigh },
          { name: "hip", label: "Hip", value: initial?.hip },
          { name: "neck", label: "Neck", value: initial?.neck },
        ].map((f) => (
          <label key={f.name} className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
            {f.label} (cm)
            <input
              type="number"
              name={f.name}
              step="0.1"
              min="0"
              defaultValue={f.value == null ? "" : Number(f.value)}
              className={input}
            />
          </label>
        ))}
      </div>
      <label className="block text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        Note
        <input
          type="text"
          name="notes"
          maxLength={300}
          defaultValue={initial?.notes ?? ""}
          placeholder="Morning, empty stomach…"
          className={input}
        />
      </label>
      {state.error && <p className="text-xs font-bold text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs font-bold text-emerald-700">{state.ok}</p>}
      <SubmitButton
        pendingText="Saving…"
        className="w-full rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-xs font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] nb-press"
      >
        Save measurement
      </SubmitButton>
    </form>
  );
}

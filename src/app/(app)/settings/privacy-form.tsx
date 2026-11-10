"use client";

import { useState, useTransition } from "react";
import { saveAssistantPrivacyMode } from "./actions";

/** Assistant privacy-mode toggle, shown in Settings → AI providers. */
export function PrivacyForm({ initial }: { initial: boolean | null }) {
  const [on, setOn] = useState(initial === true);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startSaving] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    setError(null);
    setSaved(null);
    startSaving(async () => {
      const res = await saveAssistantPrivacyMode(next);
      if (res.ok) setSaved(next ? "Privacy mode is ON." : "Privacy mode is OFF.");
      else {
        setOn(!next);
        setError(res.error ?? "Could not save — try again.");
      }
    });
  }

  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Privacy mode</p>
        <p className="mt-1 text-xs text-neutral-500">
          Your weights and everyone&apos;s allergies are never sent to the AI provider. Dish suggestions stay safe — the
          app filters them before anything reaches the model.
        </p>
        {saved && <p className="nb-stamp mt-2 text-xs font-extrabold text-emerald-700">{saved}</p>}
        {error && <p className="nb-shake mt-2 text-xs font-bold text-red-700">{error}</p>}
      </div>
      <button
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-pressed={on}
        className={`nb-shadow-sm shrink-0 rounded-none border-2 border-neutral-900 px-4 py-2.5 text-xs font-extrabold uppercase tracking-wide disabled:opacity-60 ${
          on ? "bg-yellow-300 text-neutral-900" : "bg-white text-neutral-700 hover:bg-amber-50"
        } ${pending ? "nb-loading cursor-wait" : "nb-press"}`}
      >
        {pending ? "◌ Saving…" : on ? "Privacy ON" : "Privacy OFF"}
      </button>
    </div>
  );
}

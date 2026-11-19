"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logWeight, type WeightActionState } from "@/app/(app)/progress/actions";

const init: WeightActionState = { error: null, ok: null };

/**
 * Header weigh-in nudge: appears only while today's weigh-in is missing and
 * opens an inline form in place, so the member never has to leave the page.
 * Dismissal is stored per IST day; logging hides it immediately.
 */
export function WeighInNudge({
  loggedToday,
  weighInTime,
  today,
}: {
  loggedToday: boolean;
  weighInTime: string | null;
  today: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  /** null = not read yet (render nothing), then true/false from storage. */
  const [dismissed, setDismissed] = useState<boolean | null>(null);
  const [state, action, pending] = useActionState(logWeight, init);
  const boxRef = useRef<HTMLDivElement>(null);

  const storageKey = `fmp:weighin-nudge:${today}`;

  // Read dismissal after mount — SSR has no localStorage. The timeout keeps
  // the state write out of the effect body (React's cascading-render rule).
  useEffect(() => {
    const id = window.setTimeout(() => {
      try {
        setDismissed(localStorage.getItem(storageKey) === "1");
      } catch {
        setDismissed(false); // storage disabled: keep the nudge visible
      }
    }, 0);
    return () => window.clearTimeout(id);
  }, [storageKey]);

  useEffect(() => {
    if (!state.ok) return;
    const id = window.setTimeout(() => {
      setSaved(true);
      setOpen(false);
      // Refresh the layout so the nudge disappears app-wide.
      router.refresh();
    }, 0);
    return () => window.clearTimeout(id);
  }, [state.ok, router]);

  // Click outside closes the popover.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  function hideForToday() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      // Ignore storage failures — dismissal still works for this page view.
    }
    setDismissed(true);
    setOpen(false);
  }

  if (loggedToday || saved || dismissed !== false) return null;

  return (
    <div ref={boxRef} className="relative mr-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={
          weighInTime
            ? `Today's weigh-in is pending (daily reminder ${weighInTime})`
            : "Today's weigh-in is pending"
        }
        className={`flex items-center gap-1 rounded-none border-2 border-neutral-900 px-2.5 py-1.5 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none ${
          open ? "bg-lime-300" : "bg-amber-200"
        }`}
      >
        <span aria-hidden>⚖️</span>
        <span className="hidden sm:inline">Log weight</span>
        <span className="sr-only sm:hidden">Log today&apos;s weight</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Log today's weigh-in"
          className="absolute right-0 top-full z-40 mt-2 w-72 border-2 border-neutral-900 bg-white p-3 shadow-[5px_5px_0_#111]"
        >
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-wide text-neutral-900">Today&apos;s weigh-in</p>
              <p className="text-[10px] text-neutral-500">
                {weighInTime ? `Reminder set for ${weighInTime}. ` : ""}One number keeps your targets honest.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close weigh-in form"
              className="rounded-none border-2 border-neutral-900 bg-white px-1.5 text-[10px] font-extrabold leading-5 shadow-[2px_2px_0_#111] hover:bg-neutral-100"
            >
              ✕
            </button>
          </div>

          <form action={action} className="mt-2 flex items-end gap-2">
            <div className="flex-1">
              <label
                htmlFor="nudge-weight"
                className="mb-1 block text-[9px] font-extrabold uppercase tracking-widest text-neutral-400"
              >
                Weight (kg)
              </label>
              <input
                id="nudge-weight"
                name="weightKg"
                type="number"
                step="0.1"
                min="25"
                max="250"
                required
                autoFocus
                disabled={pending}
                placeholder="69.4"
                className="w-full rounded-none border-2 border-neutral-900 bg-white px-2.5 py-1.5 text-sm focus:shadow-[2px_2px_0_#111] focus:outline-none disabled:bg-neutral-100"
              />
            </div>
            <button
              type="submit"
              disabled={pending}
              className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-3 py-2 text-[10px] font-extrabold uppercase tracking-wide shadow-[2px_2px_0_#111] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-none disabled:opacity-50"
            >
              {pending ? "◌" : "Save"}
            </button>
          </form>

          {state.error && <p className="mt-1.5 text-[11px] font-bold text-red-700">{state.error}</p>}
          {pending && <p className="mt-1.5 text-[10px] font-bold uppercase tracking-wide text-neutral-400">Saving…</p>}

          <div className="mt-2 flex items-center justify-between border-t-2 border-dashed border-neutral-200 pt-2">
            <Link
              href="/progress"
              onClick={() => setOpen(false)}
              className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 hover:underline"
            >
              Progress →
            </Link>
            <button
              type="button"
              onClick={hideForToday}
              className="text-[9px] font-extrabold uppercase tracking-wide text-neutral-400 hover:text-neutral-900"
            >
              Hide for today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

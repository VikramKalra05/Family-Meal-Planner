"use client";

import { useEffect, useState } from "react";

/** Live elapsed-seconds counter for AI calls, which can take a while. */
function useElapsedSeconds() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  return seconds;
}

/**
 * Status panel shown while an AI request is in flight. The marching-stripe
 * bar gives the eye something moving even when the provider takes 30–60s,
 * and the elapsed counter proves the app hasn't frozen.
 */
export function AiWorking({
  label,
  hint,
  compact = false,
}: {
  label: string;
  hint?: string;
  compact?: boolean;
}) {
  const seconds = useElapsedSeconds();

  return (
    <div
      role="status"
      aria-live="polite"
      className={`border-2 border-neutral-900 bg-yellow-100 nb-shadow-sm ${
        compact ? "px-3 py-2" : "p-3"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-800">
          {label}
        </p>
        <p aria-hidden className="shrink-0 font-mono text-[10px] font-bold tabular-nums text-neutral-500">
          {seconds}s
        </p>
      </div>
      <div className="mt-2 h-2 w-full border-2 border-neutral-900 bg-white nb-loading" aria-hidden />
      {hint && <p className="mt-1.5 text-[10px] leading-snug text-neutral-500">{hint}</p>}
    </div>
  );
}

/** Thin marching bar for non-AI server actions (planner, shopping, etc.). */
export function WorkingBar({ label }: { label: string }) {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-2">
      <span className="h-2 flex-1 border-2 border-neutral-900 bg-white nb-loading" aria-hidden />
      <span className="shrink-0 text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
        {label}
      </span>
    </div>
  );
}

/** Compact inline spinner — inherits the current text colour. */
export function Spinner({ className = "h-3 w-3" }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 border-2 border-current border-r-transparent nb-blink ${className}`}
    />
  );
}

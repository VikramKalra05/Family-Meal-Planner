"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Route-group error boundary. Without one, a thrown server action or a bad
 * Supabase response replaced the whole app with a blank screen.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl space-y-4 py-10">
      <div className="border-2 border-neutral-900 bg-red-200 p-6 shadow-[5px_5px_0_#111]">
        <p className="text-4xl" aria-hidden>
          🍳
        </p>
        <h1 className="mt-2 text-lg font-extrabold uppercase tracking-tight">
          Something burned in the kitchen
        </h1>
        <p className="mt-1 text-sm text-neutral-700">
          This page hit an unexpected error. Your data is safe — try again, or go back to Today.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wide text-neutral-500">
            ref {error.digest}
          </p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-none border-2 border-neutral-900 bg-emerald-400 px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-none border-2 border-neutral-900 bg-white px-4 py-2.5 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none"
          >
            Back to Today
          </Link>
        </div>
      </div>
    </div>
  );
}

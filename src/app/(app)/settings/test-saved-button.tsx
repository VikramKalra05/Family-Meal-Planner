"use client";

import { useState, useTransition } from "react";
import { testSavedProvider } from "./actions";
import { Spinner } from "@/components/ai-working";

export function TestSavedButton({ id }: { id: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={testing}
        aria-busy={testing}
        onClick={() => {
          setResult(null);
          startTesting(async () => {
            const res = await testSavedProvider(id);
            setResult(res.ok ? `✓ ${res.latencyMs}ms` : `✕ ${res.error.slice(0, 60)}`);
          });
        }}
        className={`inline-flex items-center gap-1.5 rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50 disabled:opacity-60 ${
          testing ? "nb-loading cursor-wait" : ""
        }`}
      >
        {testing && <Spinner />}
        {testing ? "Testing…" : "Test"}
      </button>
      {result && (
        <span
          role="status"
          aria-live="polite"
          className={`text-[10px] font-medium ${result.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}
        >
          {result}
        </span>
      )}
    </span>
  );
}

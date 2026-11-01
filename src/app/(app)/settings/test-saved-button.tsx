"use client";

import { useState, useTransition } from "react";
import { testSavedProvider } from "./actions";

export function TestSavedButton({ id }: { id: string }) {
  const [result, setResult] = useState<string | null>(null);
  const [testing, startTesting] = useTransition();

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={testing}
        onClick={() => {
          setResult(null);
          startTesting(async () => {
            const res = await testSavedProvider(id);
            setResult(res.ok ? `✓ ${res.latencyMs}ms` : `✕ ${res.error.slice(0, 60)}`);
          });
        }}
        className="rounded-none border-2 border-neutral-900 px-3 py-1.5 text-xs font-medium hover:bg-amber-50 disabled:opacity-50"
      >
        {testing ? "Testing…" : "Test"}
      </button>
      {result && (
        <span className={`text-[10px] font-medium ${result.startsWith("✓") ? "text-emerald-600" : "text-red-600"}`}>
          {result}
        </span>
      )}
    </span>
  );
}

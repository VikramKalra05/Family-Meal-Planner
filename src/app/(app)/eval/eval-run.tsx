"use client";

import { useState, useTransition } from "react";
import { runEvalAction, type EvalResult } from "./actions";
import { AiWorking } from "@/components/ai-working";

export function EvalRun() {
  const [result, setResult] = useState<EvalResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [running, start] = useTransition();

  return (
    <div className="space-y-4" aria-busy={running}>
      <button
        type="button"
        disabled={running}
        onClick={() => {
          setError(null);
          start(async () => {
            const res = await runEvalAction();
            if ("error" in res) setError(res.error);
            else setResult(res.result);
          });
        }}
        className={`rounded-none border-2 border-neutral-900 bg-emerald-400 px-5 py-3 text-sm font-extrabold uppercase tracking-wide text-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] disabled:opacity-60 ${
          running ? "nb-loading cursor-wait" : ""
        }`}
      >
        {running ? "◌ Running 5 generations…" : "▶ Run E1 + E4 (5 plan generations)"}
      </button>

      {running && (
        <AiWorking
          label="Running the evaluation…"
          hint="The deterministic engine generates five weeks and checks calorie gaps and constraint violations. No AI calls."
        />
      )}

      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {result && (
        <div className="nb-stamp space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border-2 border-neutral-900 bg-lime-200 p-4 shadow-[3px_3px_0_#111]">
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">E1 · mean kcal gap</p>
              <p className="text-3xl font-extrabold">{result.meanKcalGapPct}%</p>
              <p className="text-xs text-neutral-600">worst entry: {result.worstKcalGapPct}% off slot target</p>
            </div>
            <div className={`border-2 border-neutral-900 p-4 shadow-[3px_3px_0_#111] ${result.violations.length === 0 ? "bg-lime-200" : "bg-red-200"}`}>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">E4 · constraint violations</p>
              <p className="text-3xl font-extrabold">{result.violations.length}</p>
              <p className="text-xs text-neutral-600">
                across {result.entriesTotal} entries · {result.runs} generations (target: 0)
              </p>
            </div>
          </div>
          {result.violations.length > 0 && (
            <ul className="space-y-1 text-xs">
              {result.violations.slice(0, 10).map((v, i) => (
                <li key={i}>
                  ⚠ <span className="font-bold">{v.recipe}</span> for {v.member} — {v.rule}
                </li>
              ))}
            </ul>
          )}
          <details>
            <summary className="cursor-pointer text-[10px] font-extrabold uppercase tracking-wide text-neutral-400">
              Raw JSON (for the report)
            </summary>
            <pre className="mt-2 overflow-x-auto border-2 border-neutral-900 bg-white p-3 text-[10px]">
              {JSON.stringify(result, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
}

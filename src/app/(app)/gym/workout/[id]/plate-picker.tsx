"use client";

import { useMemo, useState } from "react";
import {
  formatPlates,
  plateChips,
  solvePlates,
  totalFromPlates,
} from "@/lib/gym/plates";
import type { PlateDenom, WeightUnit } from "@/lib/gym/types";

export interface PickedPlate {
  label: string;
  qty: number;
}

const PLATE_COLORS: Record<string, string> = {
  red: "#ef4444",
  blue: "#3b82f6",
  yellow: "#fde047",
  green: "#22c55e",
  white: "#ffffff",
  chrome: "#d4d4d4",
};

export function PlatePicker({
  unit,
  barWeight,
  plates,
  initialWeight,
  onPick,
  onClose,
}: {
  unit: WeightUnit;
  barWeight: number;
  plates: PlateDenom[];
  initialWeight: number;
  onPick: (weight: number, chips: PickedPlate[]) => void;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<"target" | "bar">("target");
  const [target, setTarget] = useState(initialWeight > 0 ? initialWeight : barWeight);
  const [perSide, setPerSide] = useState<Record<string, number>>({});

  const solution = useMemo(
    () => solvePlates(Number(target) || 0, barWeight, plates),
    [target, barWeight, plates],
  );

  const forwardWeight = useMemo(() => {
    const rows = plates
      .filter((p) => (perSide[p.id] ?? 0) > 0)
      .map((p) => ({ weight: p.weight, qty: perSide[p.id] }));
    return totalFromPlates(rows, barWeight);
  }, [perSide, plates, barWeight]);

  const forwardChips: PickedPlate[] = plates
    .filter((p) => (perSide[p.id] ?? 0) > 0)
    .sort((a, b) => b.weight - a.weight)
    .map((p) => ({ label: p.label, qty: perSide[p.id] }));

  const nudge = (delta: number) => {
    const next = Math.max(barWeight, Math.round((Number(target) + delta) * 100) / 100);
    setTarget(next);
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-neutral-900/40 md:items-center md:p-6">
      <button type="button" aria-label="Close plate calculator" className="absolute inset-0" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full max-w-lg overflow-y-auto border-2 border-neutral-900 bg-white shadow-[6px_6px_0_#111]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b-2 border-neutral-900 bg-yellow-300 px-4 py-3">
          <div>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-600">Plate calculator</p>
            <p className="text-sm font-extrabold">
              {barWeight} {unit} bar
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="border-2 border-neutral-900 bg-white px-3 py-1 text-xs font-extrabold uppercase"
          >
            Close
          </button>
        </div>

        <div className="p-4">
          <div className="mb-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setMode("target")}
              className={`border-2 border-neutral-900 px-3 py-2 text-xs font-extrabold uppercase ${
                mode === "target" ? "bg-emerald-300" : "bg-white text-neutral-500"
              }`}
            >
              Target → plates
            </button>
            <button
              type="button"
              onClick={() => setMode("bar")}
              className={`border-2 border-neutral-900 px-3 py-2 text-xs font-extrabold uppercase ${
                mode === "bar" ? "bg-emerald-300" : "bg-white text-neutral-500"
              }`}
            >
              What&apos;s on the bar
            </button>
          </div>

          {mode === "target" ? (
            <>
              <label className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Total weight ({unit})
              </label>
              <div className="mt-1 flex items-stretch gap-2">
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  value={target}
                  onChange={(e) => setTarget(Number(e.target.value))}
                  className="w-full border-2 border-neutral-900 px-3 py-4 text-3xl font-extrabold focus:shadow-[3px_3px_0_#111] focus:outline-none"
                />
                <div className="grid grid-cols-2 gap-1">
                  {[-5, -2.5, 2.5, 5].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => nudge(d)}
                      className="border-2 border-neutral-900 bg-white px-3 text-xs font-extrabold"
                    >
                      {d > 0 ? `+${d}` : d}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-4 border-2 border-neutral-900 bg-amber-50 p-3">
                {solution ? (
                  <>
                    <div className="flex flex-wrap items-center gap-2">
                      {solution.perSide.map((p) => (
                        <span key={p.denom.id} className="flex items-center gap-1 border-2 border-neutral-900 bg-white px-2 py-1">
                          <span
                            className="h-5 w-5 border-2 border-neutral-900"
                            style={{ background: PLATE_COLORS[p.denom.color ?? "chrome"] ?? "#d4d4d4" }}
                          />
                          <span className="text-sm font-extrabold">{p.denom.label}</span>
                          <span className="text-[10px] font-bold text-neutral-500">×{p.qty}</span>
                        </span>
                      ))}
                    </div>
                    <p className="mt-2 text-xs font-bold text-neutral-600">{formatPlates(solution)}</p>
                    <p className="mt-1 text-2xl font-extrabold">
                      {solution.total} {unit}
                      {!solution.exact && (
                        <span className="ml-2 text-xs font-bold text-amber-700">
                          {solution.diff > 0 ? `${solution.diff} under` : `${Math.abs(solution.diff)} over`}
                        </span>
                      )}
                    </p>
                  </>
                ) : (
                  <p className="text-sm font-bold text-neutral-500">
                    Not enough plates for that weight. Add plates in gym setup.
                  </p>
                )}
              </div>

              <button
                type="button"
                disabled={!solution}
                onClick={() => {
                  if (!solution) return;
                  onPick(solution.total, plateChips(solution).map((c) => ({ label: c.label, qty: c.qty })));
                }}
                className="mt-4 w-full border-2 border-neutral-900 bg-emerald-400 px-4 py-3 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press disabled:opacity-40"
              >
                Use {solution ? `${solution.total} ${unit}` : "—"}
              </button>
            </>
          ) : (
            <>
              <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">
                Tap each plate you put on one side
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {[...plates]
                  .sort((a, b) => b.weight - a.weight)
                  .map((p) => {
                    const qty = perSide[p.id] ?? 0;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        disabled={Math.floor(p.count / 2) === 0}
                        onClick={() =>
                          setPerSide((prev) => {
                            const maxPerSide = Math.max(0, Math.floor(p.count / 2));
                            const next = { ...prev, [p.id]: Math.min(maxPerSide, (prev[p.id] ?? 0) + 1) };
                            return next;
                          })
                        }
                        className={`relative border-2 border-neutral-900 p-2 text-left disabled:cursor-not-allowed disabled:opacity-40 ${
                          qty > 0 ? "bg-lime-200" : "bg-white"
                        }`}
                      >
                        <span
                          className="block h-8 w-full border-2 border-neutral-900"
                          style={{ background: PLATE_COLORS[p.color ?? "chrome"] ?? "#d4d4d4" }}
                        />
                        <span className="mt-1 block text-sm font-extrabold">{p.label}</span>
                        <span className="text-[10px] text-neutral-500">
                          {p.weight} {unit}
                        </span>
                        {qty > 0 && (
                          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center border-2 border-neutral-900 bg-white text-[10px] font-extrabold">
                            {qty}
                          </span>
                        )}
                      </button>
                    );
                  })}
              </div>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-2 border-neutral-900 bg-amber-50 p-3">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest text-neutral-500">Per side</p>
                  <p className="text-sm font-bold">
                    {forwardChips.length > 0 ? forwardChips.map((c) => `${c.label}×${c.qty}`).join(" + ") : "bar only"}
                  </p>
                </div>
                <p className="text-2xl font-extrabold">
                  {forwardWeight} {unit}
                </p>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setPerSide({})}
                  className="border-2 border-neutral-900 bg-white px-3 py-2 text-xs font-extrabold uppercase"
                >
                  Clear
                </button>
                <button
                  type="button"
                  onClick={() => onPick(forwardWeight, forwardChips)}
                  className="flex-1 border-2 border-neutral-900 bg-emerald-400 px-4 py-2 text-sm font-extrabold uppercase tracking-wide shadow-[3px_3px_0_#111] nb-press"
                >
                  Use {forwardWeight} {unit}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

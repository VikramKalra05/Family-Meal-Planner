"use client";

import { useState } from "react";
import type { NutrientTargets } from "@/lib/nutrition/types";

export interface CalcIngredient {
  id: string;
  name: string;
  quantityG: number | null;
  unit: string | null;
  note: string | null;
}

export interface CalcMember {
  id: string;
  name: string;
  targets: NutrientTargets | null;
}

/** Share of the day's energy each meal slot carries (standard distribution). */
export const SLOT_SPLIT: Record<string, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.1,
  dinner: 0.3,
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/**
 * Portion calculator: scale the recipe to any number of portions, or fit it
 * to a member's energy target for a given meal slot. All math is local —
 * same linear scaling the planner uses.
 */
export function PortionCalculator({
  baseServings,
  perServing,
  gramsPerServing,
  ingredients,
  members,
  currentMemberId,
}: {
  baseServings: number;
  perServing: NutrientTargets | null;
  gramsPerServing: number;
  ingredients: CalcIngredient[];
  members: CalcMember[];
  currentMemberId: string;
}) {
  const [portions, setPortions] = useState(baseServings);
  const [fitMemberId, setFitMemberId] = useState(currentMemberId);
  const [slot, setSlot] = useState("dinner");

  const member = members.find((m) => m.id === fitMemberId) ?? members[0];
  const slotKcal = member?.targets ? Math.round(member.targets.kcal * SLOT_SPLIT[slot]) : null;
  const fitPortions =
    perServing && slotKcal ? Math.round((slotKcal / Math.max(1, perServing.kcal)) * 10) / 10 : null;

  const factor = portions / Math.max(1, baseServings);
  const scaledKcal = perServing ? Math.round(perServing.kcal * factor) : null;
  const onTarget = scaledKcal != null && slotKcal != null && Math.abs(scaledKcal - slotKcal) <= slotKcal * 0.1;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <div>
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Portions</p>
          <div className="flex items-center gap-1 rounded-none border-2 border-neutral-900 bg-white p-1">
            <button
              type="button"
              onClick={() => setPortions((p) => Math.max(0.5, Math.round((p - 1) * 2) / 2))}
              className="h-8 w-8 rounded-none text-lg font-semibold text-neutral-500 hover:bg-neutral-100"
              aria-label="Fewer portions"
            >
              −
            </button>
            <input
              type="number" min="0.5" max="50" step="0.5"
              value={portions}
              onChange={(e) => setPortions(Math.min(50, Math.max(0.5, Number(e.target.value) || 1)))}
              className="w-14 bg-transparent text-center text-lg font-bold text-neutral-900 focus:shadow-[3px_3px_0_#111] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setPortions((p) => Math.min(50, Math.round((p + 1) * 2) / 2))}
              className="h-8 w-8 rounded-none text-lg font-semibold text-neutral-500 hover:bg-neutral-100"
              aria-label="More portions"
            >
              +
            </button>
          </div>
        </div>

        <div className="min-w-52">
          <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">Fit to a member&apos;s meal</p>
          <div className="flex gap-1.5">
            <select
              value={fitMemberId}
              onChange={(e) => setFitMemberId(e.target.value)}
              className="rounded-none border-2 border-neutral-900 bg-white px-2.5 py-2 text-xs font-medium focus:shadow-[3px_3px_0_#111] focus:outline-none"
            >
              {members.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
            <div className="flex rounded-none border-2 border-neutral-900 bg-amber-50 p-0.5">
              {Object.keys(SLOT_SPLIT).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSlot(s)}
                  className={`rounded-none px-2 py-1.5 text-[11px] font-medium capitalize transition ${
                    slot === s ? "bg-white text-neutral-900" : "text-neutral-500"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {slotKcal != null && (
          <button
            type="button"
            onClick={() => fitPortions && setPortions(Math.max(0.5, fitPortions))}
            disabled={!fitPortions}
            className="rounded-none bg-neutral-900 text-white border-2 border-neutral-900 shadow-[3px_3px_0_#111] transition-all hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0_#111] font-bold disabled:opacity-40"
          >
            Fit {member?.name.split(" ")[0]}&apos;s {slot} · {slotKcal} kcal
          </button>
        )}
      </div>

      {/* Result line */}
      {perServing && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-none bg-amber-50 px-4 py-3 text-xs">
          <span className="font-semibold text-neutral-900">
            {scaledKcal} kcal <span className="font-normal text-neutral-500">/ person at this scale</span>
          </span>
          {slotKcal != null && scaledKcal != null && (
            <span className={onTarget ? "font-medium text-emerald-600" : "font-medium text-amber-600"}>
              {scaledKcal >= slotKcal ? "+" : "−"}{Math.abs(scaledKcal - slotKcal)} kcal vs {member?.name.split(" ")[0]}&apos;s {slot} target
            </span>
          )}
          {factor !== 1 && <span className="text-neutral-400">{factor.toFixed(2)}× the base recipe</span>}
          <span className="text-neutral-400">
            each portion ≈ {Math.round(gramsPerServing)} g · total ≈ {(gramsPerServing * portions / 1000).toFixed(1)} kg
          </span>
        </div>
      )}

      {/* Scaled ingredients */}
      <ul className="mt-4 space-y-1.5 text-sm">
        {ingredients.map((item) => {
          const qty = Number(item.quantityG ?? 0);
          const scaled = qty * factor;
          return (
            <li key={item.id} className="flex items-baseline justify-between gap-3">
              <span>
                {item.name}
                {item.note ? <span className="text-xs text-neutral-400"> ({item.note})</span> : null}
              </span>
              <span className="shrink-0 text-xs">
                {factor !== 1 && qty > 0 && (
                  <span className="mr-1.5 text-neutral-300 line-through">{fmt(qty)}</span>
                )}
                <span className={factor !== 1 && qty > 0 ? "font-semibold text-emerald-700" : "text-neutral-500"}>
                  {fmt(Math.round(scaled * 10) / 10)} {item.unit ?? "g"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

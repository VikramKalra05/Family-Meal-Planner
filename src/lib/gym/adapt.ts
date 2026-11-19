/**
 * Weekly outcome loop — the "is the plan working?" brain.
 *
 * Deliberately deterministic and explainable: the same inputs always produce
 * the same suggestion, and the UI always shows the reasoning. The app never
 * silently changes targets; `applyAdaptation` is a one-tap user action.
 *
 * Signals:
 *  - weight trend (kg/week) from the existing weight log
 *  - strength trend (% e1RM change across the main lifts)
 *  - waist change (cm) when the user measures it
 *  - data sufficiency (logs + sessions)
 */

import { clamp, type Goal } from "./types";

export type AdaptAction = "increase" | "decrease" | "hold" | "collect";

export interface AdaptInput {
  goal: Goal;
  weightKg: number;
  weightTrendPerWeek: number | null;
  strengthTrendPct: number | null;
  waistDeltaCm: number | null;
  weightLogs: number;
  sessions: number;
  currentAdjustmentKcal: number;
}

export interface AdaptSuggestion {
  action: AdaptAction;
  /** Change to apply now, in kcal/day. 0 for hold/collect. */
  deltaKcal: number;
  nextAdjustmentKcal: number;
  reason: string;
  confidence: "low" | "medium" | "high";
}

const MAX_ADJUSTMENT = 400;
const STEP = 150;

export function suggestAdaptation(input: AdaptInput): AdaptSuggestion {
  const held = (reason: string): AdaptSuggestion => ({
    action: "hold",
    deltaKcal: 0,
    nextAdjustmentKcal: clamp(input.currentAdjustmentKcal, -MAX_ADJUSTMENT, MAX_ADJUSTMENT),
    reason,
    confidence: "low",
  });

  if (input.weightLogs < 10 || input.sessions < 6) {
    return {
      action: "collect",
      deltaKcal: 0,
      nextAdjustmentKcal: input.currentAdjustmentKcal,
      reason: `Need at least 10 weigh-ins and 6 sessions — ${input.weightLogs} and ${input.sessions} so far.`,
      confidence: "low",
    };
  }
  if (input.weightTrendPerWeek == null) return held("Not enough weigh-ins in the last two weeks.");
  if (input.weightKg <= 0) return held("Add your bodyweight to calibrate.");

  const pct = (input.weightTrendPerWeek / input.weightKg) * 100;
  const strength = input.strengthTrendPct;
  const waist = input.waistDeltaCm;
  const confidence: AdaptSuggestion["confidence"] =
    input.weightLogs >= 14 && input.sessions >= 8 ? "high" : "medium";

  const make = (delta: number, reason: string): AdaptSuggestion => {
    const next = clamp(input.currentAdjustmentKcal + delta, -MAX_ADJUSTMENT, MAX_ADJUSTMENT);
    return {
      action: delta > 0 ? "increase" : delta < 0 ? "decrease" : "hold",
      deltaKcal: next - input.currentAdjustmentKcal,
      nextAdjustmentKcal: next,
      reason,
      confidence,
    };
  };

  if (input.goal === "muscle_gain") {
    if (pct < -0.1) {
      return make(STEP, `Losing ${Math.abs(pct).toFixed(2)}% bodyweight/week while trying to gain — add ${STEP} kcal.`);
    }
    if (pct < 0.1 && (strength ?? 0) <= 0) {
      return make(
        STEP,
        `Weight and strength are both flat at ${pct.toFixed(2)}%/week — add ${STEP} kcal and chase progressive overload.`,
      );
    }
    if (pct > 0.75 && (waist ?? 0) >= 1) {
      return make(
        -STEP,
        `Gaining ${pct.toFixed(2)}%/week with ${(waist ?? 0).toFixed(1)} cm on the waist — pull back ${STEP} kcal.`,
      );
    }
    if (pct > 0.75) {
      return held("Gaining a little fast, but no waist increase — hold and watch for two more weeks.");
    }
    if (pct < 0.25 && (strength ?? 0) > 0) {
      return held("Strength is rising at a slow weight gain — this is a good recomp. Hold.");
    }
    return held(`${pct.toFixed(2)}%/week is inside the muscle-gain band. Hold.`);
  }

  if (input.goal === "weight_loss") {
    if (pct > -0.2) {
      return make(-STEP, `Losing only ${Math.abs(pct).toFixed(2)}%/week — tighten by ${STEP} kcal.`);
    }
    if (pct < -1 || (strength ?? 0) < -5) {
      return make(
        STEP,
        `Losing ${Math.abs(pct).toFixed(2)}%/week${strength != null && strength < -5 ? ` and strength is down ${Math.abs(strength).toFixed(1)}%` : ""} — add ${STEP} kcal back.`,
      );
    }
    return held(`${Math.abs(pct).toFixed(2)}%/week is inside the fat-loss band. Hold.`);
  }

  // maintenance
  if (pct > 0.3) return make(-100, `Drifting up ${pct.toFixed(2)}%/week — trim 100 kcal.`);
  if (pct < -0.3) return make(100, `Drifting down ${Math.abs(pct).toFixed(2)}%/week — add 100 kcal.`);
  return held("Weight is stable. Hold.");
}

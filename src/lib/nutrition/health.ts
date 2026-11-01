import type { NutrientTargets } from "./types";

export interface HealthTag {
  label: string;
  tone: "good" | "watch";
}

/**
 * Lightweight, deterministic health signals derived from per-serving
 * nutrition — shown as badges and usable later for ranking. Thresholds are
 * simple and defensible for an academic write-up.
 */
export function healthTags(n: NutrientTargets): HealthTag[] {
  const tags: HealthTag[] = [];
  const kcal = Math.max(1, n.kcal);

  const proteinPct = (n.proteinG * 4) / kcal;
  if (n.proteinG >= 20 && proteinPct >= 0.25) tags.push({ label: "High protein", tone: "good" });
  else if (proteinPct >= 0.2) tags.push({ label: "Protein-rich", tone: "good" });

  if (n.fiberG >= 8) tags.push({ label: "High fiber", tone: "good" });
  else if (n.fiberG >= 5) tags.push({ label: "Fiber-rich", tone: "good" });

  const fatPct = (n.fatG * 9) / kcal;
  if (fatPct >= 0.45) tags.push({ label: "Heavy", tone: "watch" });
  else if (fatPct <= 0.25 && kcal <= 400) tags.push({ label: "Light", tone: "good" });

  if (kcal >= 650) tags.push({ label: "Indulgent", tone: "watch" });

  return tags;
}

/**
 * Continuous health score for ranking ("Healthiest" sort): rewards protein
 * share and fiber, penalises fat share. Deterministic and explainable —
 * documented for the evaluation module.
 */
export function healthScore(n: NutrientTargets): number {
  const kcal = Math.max(1, n.kcal);
  const proteinShare = (n.proteinG * 4) / kcal;
  const fatShare = (n.fatG * 9) / kcal;
  return Math.round((proteinShare * 100 + Math.min(n.fiberG, 20) * 1.5 - fatShare * 80) * 10) / 10;
}

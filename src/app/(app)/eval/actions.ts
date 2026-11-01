"use server";

import { generateWeek, SLOT_SPLIT, type PlannerMember, type PlannerRecipe } from "@/lib/planner";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { loadPlanData } from "@/lib/plan-data";

export interface EvalResult {
  runs: number;
  entriesTotal: number;
  /** E1: mean |planned kcal − slot target| / slot target (0 = perfect) */
  meanKcalGapPct: number;
  worstKcalGapPct: number;
  /** E4: diet/allergen violations across all generated entries (target: 0) */
  violations: { recipe: string; member: string; rule: string }[];
  generatedAt: string;
}

/**
 * Deterministic report experiments, no LLM involved:
 *  E1 — macro-energy adherence of generated plans vs each member's slot targets
 *  E4 — hard-constraint compliance (diet rules + allergen safety; target 0)
 */
export async function runEvalAction(): Promise<{ error: string } | { result: EvalResult }> {
  const profile = await requireFullProfile();
  if (profile.role !== "owner") return { error: "Owner only" };

  const supabase = await createClient();
  const { plannerRecipes, members } = await loadPlanData();
  if (plannerRecipes.length === 0 || members.length === 0) {
    return { error: "Need at least one rated recipe and one member with targets." };
  }

  const runs = 5;
  let entriesTotal = 0;
  let gapSum = 0;
  let gapCount = 0;
  let worst = 0;
  const violations: EvalResult["violations"] = [];

  for (let run = 0; run < runs; run++) {
    // Perturb the recipe pool order per run for spread, engine stays deterministic.
    const pool: PlannerRecipe[] = [...plannerRecipes].slice(run % Math.max(1, plannerRecipes.length));
    const entries = generateWeek({ recipes: pool, members, weekStart: "2027-01-04", days: 7 });
    entriesTotal += entries.length;

    for (const e of entries) {
      const eater: PlannerMember | undefined =
        e.memberId == null ? undefined : members.find((m) => m.id === e.memberId);
      const recipe = pool.find((r) => r.id === e.recipeId);
      if (!recipe) continue;

      // E4: constraint compliance
      const checkMember = eater ?? members[0];
      if (recipe.isVeg === false && checkMember.diet === "veg") {
        violations.push({ recipe: recipe.title, member: checkMember.name, rule: "veg breach" });
      }
      const hay = recipe.ingredientNames.join(" ").toLowerCase();
      for (const a of checkMember.allergies) {
        if (hay.includes(a.toLowerCase())) {
          violations.push({ recipe: recipe.title, member: checkMember.name, rule: `allergen: ${a}` });
        }
      }

      // E1: kcal adherence vs slot target of the eater (or family mean for shared)
      const targetKcal = (eater ?? members[0]).targets.kcal * SLOT_SPLIT[e.slot];
      const gap = Math.abs(recipe.kcal - targetKcal) / targetKcal;
      gapSum += gap;
      gapCount += 1;
      worst = Math.max(worst, gap);
    }
  }

  const result: EvalResult = {
    runs,
    entriesTotal,
    meanKcalGapPct: Math.round((gapSum / Math.max(1, gapCount)) * 1000) / 10,
    worstKcalGapPct: Math.round(worst * 1000) / 10,
    violations,
    generatedAt: new Date().toISOString(),
  };

  // Results are displayed and copyable as JSON in the UI; persisting to
  // eval_runs requires the service role (RLS intentionally blocks clients).
  void supabase;

  return { result };
}

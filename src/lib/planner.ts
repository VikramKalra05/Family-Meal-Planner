/**
 * Deterministic meal-plan engine: slot-scoring recipe selection for the
 * hybrid family model (shared dinner + personal breakfast/lunch/snacks),
 * weekly ingredient aggregation and pantry-aware shopping lists.
 *
 * Pure functions only — the LLM layer may re-rank later, but the plan is
 * always reproducible and explainable without it.
 */

import type { NutrientTargets } from "@/lib/nutrition/types";
import { healthScore } from "@/lib/nutrition/health";

export const SLOT_SPLIT: Record<SlotKey, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  snack: 0.1,
  dinner: 0.3,
};

export type SlotKey = "breakfast" | "lunch" | "snack" | "dinner";
export const SLOT_KEYS: SlotKey[] = ["breakfast", "lunch", "snack", "dinner"];

export interface PlannerRecipe {
  id: string;
  title: string;
  isVeg: boolean;
  servings: number;
  prepMinutes: number | null;
  /** per-serving macros */
  kcal: number;
  proteinG: number;
  fiberG: number;
  ingredientNames: string[];
  ingredientIds: string[];
}

export interface PlannerMember {
  id: string;
  name: string;
  diet: "veg" | "egg" | "non_veg";
  allergies: string[];
  targets: NutrientTargets;
}

function slotTargetKcal(member: PlannerMember, slot: SlotKey): number {
  return member.targets.kcal * SLOT_SPLIT[slot];
}

/**
 * Allergy synonyms: users type everyday words ("peanuts"), the ingredient
 * master uses formal names ("groundnut (raw)"). Safety-critical — both sides
 * must match. Matched case-insensitively via substring containment.
 */
const ALLERGEN_SYNONYMS: Record<string, string[]> = {
  peanuts: ["groundnut", "peanut", "moongphali"],
  groundnut: ["peanut", "groundnut"],
  dairy: ["milk", "curd", "dahi", "paneer", "butter", "cream", "cheese", "khoya", "ghee"],
  "milk products": ["milk", "curd", "dahi", "paneer", "butter", "cream", "cheese", "khoya", "ghee"],
  egg: ["egg"],
  eggs: ["egg"],
  gluten: ["atta", "maida", "wheat", "bread", "semolina", "rava", "sooji"],
  "tree nuts": ["cashew", "almond", "walnut"],
  cashew: ["cashew"],
  almond: ["almond", "badam"],
  soy: ["soy"],
  fish: ["fish", "rohu", "rawas"],
  prawns: ["prawn", "shrimp"],
  mustard: ["mustard"],
  sesame: ["til", "sesame"],
};

function matchesAllergies(recipe: PlannerRecipe, allergies: string[]): boolean {
  if (allergies.length === 0) return true;
  const haystack = recipe.ingredientNames.join(" ").toLowerCase();
  return !allergies.some((a) => {
    const terms = ALLERGEN_SYNONYMS[a.toLowerCase()] ?? [a.toLowerCase()];
    return terms.some((t) => haystack.includes(t));
  });
}

function dietAllows(recipe: PlannerRecipe, diet: PlannerMember["diet"]): boolean {
  if (diet === "non_veg") return true;
  if (diet === "egg") return true; // egg dishes are acceptable for eggetarians
  return recipe.isVeg;
}

export interface ScoredCandidate {
  recipe: PlannerRecipe;
  /** |planned kcal − slot target| / slot target after portioning. */
  kcalGap: number;
  score: number;
  reason: string;
  /** Portion multiplier that will be stored on the plan entry. */
  portion: number;
}

/** Portion bounds. A "serving" is recipe-defined, so 3× a light dish is normal. */
export const PORTION_MIN = 0.25;
export const PORTION_MAX = 3;

export interface PortionFit {
  /** Portion multiplier after quarter-step rounding and clamping. */
  portion: number;
  /** kcal the eater actually gets with that portion. */
  kcal: number;
  target: number;
  /** |kcal − target| / target (0 = exact). */
  gap: number;
  /** The mathematically exact multiplier before clamping/rounding. */
  rawPortion: number;
}

/** How much of one serving this member should eat to hit the slot target. */
export function fitFor(recipe: PlannerRecipe, member: PlannerMember, slot: SlotKey): PortionFit {
  const target = slotTargetKcal(member, slot);
  const rawPortion = target / Math.max(1, recipe.kcal);
  const portion = Math.min(
    PORTION_MAX,
    Math.max(PORTION_MIN, Math.round(rawPortion * 4) / 4),
  );
  const kcal = recipe.kcal * portion;
  return {
    portion,
    kcal,
    target,
    gap: Math.abs(kcal - target) / Math.max(1, target),
    rawPortion,
  };
}

export function portionFor(recipe: PlannerRecipe, member: PlannerMember, slot: SlotKey): number {
  return fitFor(recipe, member, slot).portion;
}

/**
 * Variety-first scoring with a hard look at achievable calories. Portions are
 * clamped to 0.25–3× a serving, so a 50 kcal/serving chaat can never fill a
 * 900 kcal dinner slot. Ranking on the *post-portion* gap stops the engine
 * from picking dishes it cannot actually scale to the target.
 */
export function scoreCandidate(
  recipe: PlannerRecipe,
  member: PlannerMember,
  slot: SlotKey,
  usedCount: number,
): ScoredCandidate {
  const fit = fitFor(recipe, member, slot);
  let score = 1;
  score += healthScore({
    kcal: recipe.kcal,
    proteinG: recipe.proteinG,
    carbsG: 0,
    fatG: 0,
    fiberG: recipe.fiberG,
  }) / 400;
  if (recipe.prepMinutes != null && recipe.prepMinutes <= 20) score += 0.1;
  score -= usedCount * 0.3;
  // Calorie fit dominates; a 10% gap costs 0.25, a 50% gap costs 1.25.
  score -= fit.gap * 2.5;
  // Prefer dishes that land in a believable portion range naturally.
  if (fit.rawPortion < PORTION_MIN || fit.rawPortion > PORTION_MAX) score -= 0.35;
  if (fit.portion > 2) score -= (fit.portion - 2) * 0.15;

  const reasons: string[] = [];
  if (recipe.prepMinutes != null && recipe.prepMinutes <= 20) reasons.push("quick");
  if (recipe.fiberG >= 5) reasons.push("fiber");
  if (recipe.proteinG >= 15) reasons.push("protein");
  return { recipe, kcalGap: fit.gap, score, reason: reasons.join(", ") || "balanced pick", portion: fit.portion };
}

/** Diet + allergen safety for one eater. Exported so server actions can
 *  re-validate a submitted recipe, not just trust the candidate list UI. */
export function isRecipeSafeFor(recipe: PlannerRecipe, member: PlannerMember): boolean {
  return dietAllows(recipe, member.diet) && matchesAllergies(recipe, member.allergies);
}

/** Filters + ranks candidates for a member/slot. */
export function candidatesFor(
  recipes: PlannerRecipe[],
  member: PlannerMember,
  slot: SlotKey,
  usedTitles: Set<string>,
  limit = 6,
): ScoredCandidate[] {
  return recipes
    .filter((r) => isRecipeSafeFor(r, member))
    .map((r) => scoreCandidate(r, member, slot, usedTitles.has(r.title) ? 1 : 0))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

/**
 * Shared-dish diet rule: veg if ANY eater is veg/eggetarian, allergen
 * exclusions = union of all eaters' allergies.
 */
export function sharedDiet(members: PlannerMember[]): PlannerMember {
  const anyVeg = members.some((m) => m.diet !== "non_veg");
  const allergies = [...new Set(members.flatMap((m) => m.allergies))];
  const avgTargets: NutrientTargets = {
    kcal: members.reduce((s, m) => s + m.targets.kcal, 0) / Math.max(1, members.length),
    proteinG: members.reduce((s, m) => s + m.targets.proteinG, 0) / Math.max(1, members.length),
    carbsG: members.reduce((s, m) => s + m.targets.carbsG, 0) / Math.max(1, members.length),
    fatG: members.reduce((s, m) => s + m.targets.fatG, 0) / Math.max(1, members.length),
    fiberG: members.reduce((s, m) => s + m.targets.fiberG, 0) / Math.max(1, members.length),
  };
  return {
    id: "shared",
    name: "Family",
    diet: anyVeg ? "veg" : "non_veg",
    allergies,
    targets: avgTargets,
  };
}

/**
 * Picks the best-safe candidate with tiered fallback so weeks are always
 * full, even with a tiny library. Calorie fit comes first (a plan whose days
 * miss the target by 40% is not a plan), then variety, then a final
 * safety-only fallback. Diet and allergen safety are never relaxed.
 */
function pickRanked(
  pool: PlannerRecipe[],
  member: PlannerMember,
  slot: SlotKey,
  usage: Map<string, number>,
  dayTitles: Set<string>,
): ScoredCandidate | null {
  const scored = pool
    .filter((r) => dietAllows(r, member.diet) && matchesAllergies(r, member.allergies))
    .map((r) => scoreCandidate(r, member, slot, usage.get(r.title) ?? 0))
    .sort((a, b) => b.score - a.score);
  const withinCap = scored.filter((c) => (usage.get(c.recipe.title) ?? 0) < 2);
  const fresh = withinCap.filter((c) => !dayTitles.has(c.recipe.title));
  const dayFresh = scored.filter((c) => !dayTitles.has(c.recipe.title));

  // Prefer a dish that can actually hit the slot, keep the day varied, then
  // fall back gradually. Day-fresh dishes may exceed the weekly 2-use cap:
  // repeating a dish twice in one day is worse than a third use this week.
  const tiers = [
    fresh.filter((c) => c.kcalGap <= 0.15),
    dayFresh.filter((c) => c.kcalGap <= 0.15),
    fresh.filter((c) => c.kcalGap <= 0.35),
    dayFresh.filter((c) => c.kcalGap <= 0.35),
    dayFresh,
    withinCap,
    scored,
  ];
  for (const tier of tiers) {
    if (tier.length > 0) return tier[0];
  }
  return null;
}

export interface GenerateInput {
  recipes: PlannerRecipe[];
  members: PlannerMember[]; // everyone who eats from this plan
  weekStart: string; // yyyy-mm-dd of Monday
  days?: number; // default 7
}

export interface PlannedEntry {
  date: string; // yyyy-mm-dd
  slot: SlotKey;
  /** null = shared family dish */
  memberId: string | null;
  recipeId: string;
  /** total portions of the recipe to cook (sum of per-member portions) */
  servingsBase: number;
  /** per-member portion multipliers (× one recipe serving) */
  memberPortions: Record<string, number>;
}

/**
 * Generates the hybrid week: personal breakfast/lunch/snack per member +
 * one shared family dinner per day. Portions are SCALED to each member's
 * slot target (any dish fits any slot), variety is capped at 2 uses per
 * recipe per week, and nothing repeats within a member's day.
 */
export function generateWeek(input: GenerateInput): PlannedEntry[] {
  const { recipes, members } = input;
  const days = input.days ?? 7;
  const entries: PlannedEntry[] = [];
  const usage = new Map<string, number>();

  if (recipes.length === 0 || members.length === 0) return entries;

  const shared = sharedDiet(members);
  const start = Date.parse(input.weekStart);

  for (let d = 0; d < days; d++) {
    const date = new Date(start + d * 24 * 3600 * 1000).toISOString().slice(0, 10);

    // Shared family dinner
    const dinnerPick = pickRanked(recipes, shared, "dinner", usage, new Set());
    if (dinnerPick) {
      const pick = dinnerPick.recipe;
      const portions: Record<string, number> = {};
      let total = 0;
      for (const m of members) {
        const p = portionFor(pick, m, "dinner");
        portions[m.id] = p;
        total += p;
      }
      usage.set(pick.title, (usage.get(pick.title) ?? 0) + 1);
      entries.push({
        date,
        slot: "dinner",
        memberId: null,
        recipeId: pick.id,
        servingsBase: Math.round(total * 100) / 100,
        memberPortions: portions,
      });
    }

    // Personal slots
    for (const member of members) {
      const dayTitles = new Set<string>();
      for (const slot of ["breakfast", "lunch", "snack"] as SlotKey[]) {
        const pick = pickRanked(recipes, member, slot, usage, dayTitles);
        if (!pick) continue;
        const dish = pick.recipe;
        const portion = pick.portion;
        usage.set(dish.title, (usage.get(dish.title) ?? 0) + 1);
        dayTitles.add(dish.title);
        entries.push({
          date,
          slot,
          memberId: member.id,
          recipeId: dish.id,
          servingsBase: portion,
          memberPortions: { [member.id]: portion },
        });
      }
    }
  }

  return entries;
}

// ── Aggregation & shopping ───────────────────────────────────────────────

export interface RecipeItemsInfo {
  recipeId: string;
  servings: number;
  items: { name: string; ingredientId: string | null; grams: number; unit: string }[];
}

export interface AggregatedIngredient {
  name: string;
  ingredientId: string | null;
  neededG: number;
}

const toGrams = (qty: number, unit: string): number => {
  switch (unit) {
    case "kg": return qty * 1000;
    case "ml": return qty; // density ≈ 1
    case "l": return qty * 1000;
    case "piece": return qty; // piece pantry rows count in pieces; recipe grams dominate
    default: return qty;
  }
};

/** Sums raw ingredient needs over all planned entries. */
export function aggregateIngredients(
  entries: PlannedEntry[],
  itemsByRecipe: Map<string, RecipeItemsInfo>,
): AggregatedIngredient[] {
  const acc = new Map<string, AggregatedIngredient>();
  for (const entry of entries) {
    const info = itemsByRecipe.get(entry.recipeId);
    if (!info) continue;
    const factor = entry.servingsBase / Math.max(1, info.servings);
    for (const item of info.items) {
      const key = item.ingredientId ?? `free:${item.name.toLowerCase()}`;
      const grams = toGrams(item.grams, item.unit) * factor;
      const prev = acc.get(key);
      if (prev) prev.neededG += grams;
      else acc.set(key, { name: item.name, ingredientId: item.ingredientId, neededG: grams });
    }
  }
  return [...acc.values()].sort((a, b) => b.neededG - a.neededG);
}

export interface ShoppingItem {
  name: string;
  ingredientId: string | null;
  neededG: number;
  /** human display: "2.5 kg", "300 g", "4 piece" */
  display: string;
  checked: boolean;
}

/** Pantry-aware shopping list: need − stock (grams), grouped for humans. */
export function buildShoppingList(
  agg: AggregatedIngredient[],
  pantry: { ingredientId: string | null; name: string; quantity: number; unit: string }[],
): ShoppingItem[] {
  const stock = new Map<string, number>();
  for (const p of pantry) {
    const key = p.ingredientId ?? `free:${p.name.toLowerCase()}`;
    stock.set(key, (stock.get(key) ?? 0) + toGrams(p.quantity, p.unit));
  }

  return agg
    .map((a) => {
      const have = stock.get(a.ingredientId ?? `free:${a.name.toLowerCase()}`) ?? 0;
      const neededG = Math.max(0, a.neededG - have);
      return { ...a, neededG };
    })
    .filter((a) => a.neededG >= 5) // ignore rounding dust
    .map((a) => ({
      name: a.name,
      ingredientId: a.ingredientId,
      neededG: Math.round(a.neededG),
      display: a.neededG >= 1000 ? `${(a.neededG / 1000).toFixed(1)} kg` : `${Math.round(a.neededG)} g`,
      checked: false,
    }));
}

export function mondayOf(dateISO: string): string {
  const d = new Date(Date.parse(dateISO));
  const day = (d.getDay() + 6) % 7; // 0 = Monday
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

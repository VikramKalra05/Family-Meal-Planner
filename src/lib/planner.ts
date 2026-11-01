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

export interface PlannedEntry {
  date: string; // yyyy-mm-dd
  slot: SlotKey;
  /** null = shared family dish */
  memberId: string | null;
  recipeId: string;
  /** portions of the recipe to cook */
  servingsBase: number;
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
  /** kcal gap vs the slot target — informational now, portions absorb it */
  kcalGap: number;
  score: number;
  reason: string;
}

/**
 * Variety-first scoring: portions scale to hit slot targets, so kcal fit is
 * no longer the ranking driver. Repetition is penalised hard and capped
 * (max 2 uses per recipe per week, enforced by the caller).
 */
export function scoreCandidate(
  recipe: PlannerRecipe,
  member: PlannerMember,
  slot: SlotKey,
  usedCount: number,
): ScoredCandidate {
  const target = slotTargetKcal(member, slot);
  const kcalGap = Math.abs(recipe.kcal - target) / Math.max(1, target);
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

  const reasons: string[] = [];
  if (recipe.prepMinutes != null && recipe.prepMinutes <= 20) reasons.push("quick");
  if (recipe.fiberG >= 5) reasons.push("fiber");
  if (recipe.proteinG >= 15) reasons.push("protein");
  return { recipe, kcalGap, score, reason: reasons.join(", ") || "balanced pick" };
}

/** How much of one serving this member should eat to hit the slot target. */
export function portionFor(recipe: PlannerRecipe, member: PlannerMember, slot: SlotKey): number {
  const target = slotTargetKcal(member, slot);
  const raw = target / Math.max(1, recipe.kcal);
  return Math.min(2, Math.max(0.25, Math.round(raw * 4) / 4)); // quarter-portions, 0.25–2
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
    .filter((r) => dietAllows(r, member.diet) && matchesAllergies(r, member.allergies))
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
 * full, even with a tiny library: prefer fresh dishes, then allow repeats,
 * then allow same-day repeats — diet and allergen safety are never relaxed.
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
  const tiers = [
    scored.filter((c) => (usage.get(c.recipe.title) ?? 0) < 2 && !dayTitles.has(c.recipe.title)),
    scored.filter((c) => (usage.get(c.recipe.title) ?? 0) < 2),
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
        const portion = portionFor(dish, member, slot);
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

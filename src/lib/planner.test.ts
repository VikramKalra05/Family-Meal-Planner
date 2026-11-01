import { describe, expect, it } from "vitest";
import {
  aggregateIngredients,
  buildShoppingList,
  candidatesFor,
  generateWeek,
  mondayOf,
  portionFor,
  sharedDiet,
  type PlannerMember,
  type PlannerRecipe,
  type RecipeItemsInfo,
} from "@/lib/planner";

const recipe = (id: string, title: string, opts: Partial<PlannerRecipe> = {}): PlannerRecipe => ({
  id,
  title,
  isVeg: true,
  servings: 2,
  prepMinutes: 20,
  kcal: 500,
  proteinG: 15,
  fiberG: 4,
  ingredientNames: ["rice (white, raw)"],
  ingredientIds: ["ing-rice"],
  ...opts,
});

const member = (id: string, over: Partial<PlannerMember> = {}): PlannerMember => ({
  id,
  name: id,
  diet: "veg",
  allergies: [],
  targets: { kcal: 2000, proteinG: 80, carbsG: 250, fatG: 60, fiberG: 30 },
  ...over,
});

describe("candidatesFor", () => {
  it("never suggests non-veg dishes to vegetarians", () => {
    const recipes = [
      recipe("a", "Dal", { kcal: 500 }),
      recipe("b", "Chicken Curry", { kcal: 500, isVeg: false }),
    ];
    const out = candidatesFor(recipes, member("m1"), "lunch", new Set());
    expect(out.map((c) => c.recipe.id)).toEqual(["a"]);
  });

  it("excludes allergen matches (with synonym awareness)", () => {
    const recipes = [
      recipe("a", "Peanut Sabzi", { ingredientNames: ["groundnut (raw)"] }),
      recipe("b", "Plain Rice", { ingredientNames: ["rice (white, raw)"] }),
    ];
    const out = candidatesFor(recipes, member("m1", { allergies: ["peanuts"] }), "lunch", new Set());
    expect(out.map((c) => c.recipe.id)).toEqual(["b"]);
  });

  it("penalises already-used recipes", () => {
    const recipes = [recipe("a", "Dal"), recipe("b", "Rice Bowl")];
    const used = new Set(["Dal"]);
    const out = candidatesFor(recipes, member("m1"), "lunch", used);
    expect(out[0].recipe.id).toBe("b");
  });
});

describe("portionFor", () => {
  it("scales a portion to hit the slot target", () => {
    const m = member("m", { targets: { ...member("m").targets, kcal: 2980 } });
    // snack target = 298 kcal; dish is 743 kcal/serving → 0.401 → 0.5 (quarter steps)
    expect(portionFor(recipe("x", "Dish", { kcal: 743 }), m, "snack")).toBe(0.5);
  });

  it("clamps portions to 0.25–2", () => {
    const m = member("m", { targets: { ...member("m").targets, kcal: 2980 } });
    expect(portionFor(recipe("x", "Tiny", { kcal: 100 }), m, "snack")).toBe(2); // 2.98 clamped
    expect(portionFor(recipe("x", "Huge", { kcal: 2000 }), m, "snack")).toBe(0.25); // 0.149 clamped
  });
});

describe("sharedDiet", () => {
  it("goes veg when any member is veg and unions allergies", () => {
    const fam = sharedDiet([
      member("a", { diet: "non_veg" }),
      member("b", { diet: "veg", allergies: ["peanuts"] }),
    ]);
    expect(fam.diet).toBe("veg");
    expect(fam.allergies).toContain("peanuts");
  });
});

describe("generateWeek", () => {
  const recipes = [
    recipe("dal", "Dal Tadka", { kcal: 450, ingredientNames: ["toor dal (split pigeon pea)"], ingredientIds: ["ing-dal"] }),
    recipe("poha", "Poha", { kcal: 350, ingredientNames: ["poha (thick)"], ingredientIds: ["ing-poha"] }),
    recipe("paneer", "Palak Paneer", { kcal: 550, ingredientNames: ["paneer"], ingredientIds: ["ing-paneer"] }),
    recipe("curry", "Chicken Curry", { kcal: 600, isVeg: false }),
  ];
  const fam = [member("a"), member("b", { diet: "non_veg" })];

  it("creates 7 shared dinners + 3 personal slots per member per day", () => {
    const entries = generateWeek({ recipes, members: fam, weekStart: "2026-11-02" });
    const dinners = entries.filter((e) => e.slot === "dinner");
    const personal = entries.filter((e) => e.memberId != null);
    expect(dinners).toHaveLength(7);
    expect(personal).toHaveLength(7 * 2 * 3);
    expect(dinners.every((e) => e.memberId === null)).toBe(true);
    for (const d of dinners) {
      const sum = Object.values(d.memberPortions).reduce((s, p) => s + p, 0);
      expect(d.servingsBase).toBeCloseTo(sum, 2);
    }
  });

  it("never plans non-veg-only dinners when a veg member exists", () => {
    const entries = generateWeek({ recipes, members: fam, weekStart: "2026-11-02" });
    const dinnerIds = new Set(entries.filter((e) => e.slot === "dinner").map((e) => e.recipeId));
    expect(dinnerIds.has("curry")).toBe(false);
  });

  it("keeps personal non-veg options for non-veg members", () => {
    const entries = generateWeek({ recipes, members: fam, weekStart: "2026-11-02" });
    const personalIds = new Set(
      entries.filter((e) => e.memberId === "b" && e.slot !== "dinner").map((e) => e.recipeId),
    );
    expect(personalIds.has("curry")).toBe(true);
  });

  it("caps variety at 2 uses when the library is large enough", () => {
    const bigPool = Array.from({ length: 30 }, (_, i) =>
      recipe(`r${i}`, `Dish ${i}`, { kcal: 300 + i * 25 }),
    );
    const entries = generateWeek({ recipes: bigPool, members: fam, weekStart: "2026-11-02" });
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.recipeId, (counts.get(e.recipeId) ?? 0) + 1);
    expect(Math.max(...counts.values())).toBeLessThanOrEqual(2);
  });

  it("fills the whole week even with a tiny library (tiered fallback)", () => {
    const entries = generateWeek({ recipes, members: fam, weekStart: "2026-11-02" });
    expect(entries.filter((e) => e.slot === "dinner")).toHaveLength(7);
    expect(entries.filter((e) => e.memberId != null)).toHaveLength(7 * 2 * 3);
  });

  it("scales portions per member so slots hit their kcal targets", () => {
    const entries = generateWeek({ recipes, members: fam, weekStart: "2026-11-02" });
    for (const e of entries) {
      expect(Object.keys(e.memberPortions).length).toBeGreaterThan(0);
      expect(e.servingsBase).toBeCloseTo(
        Object.values(e.memberPortions).reduce((s, p) => s + p, 0),
        2,
      );
    }
  });

  it("does not repeat a dish within the same member's day when supply allows", () => {
    const pool = Array.from({ length: 9 }, (_, i) =>
      recipe(`r${i}`, `Dish ${i}`, { kcal: 300 + i * 40, isVeg: i % 3 !== 0 ? true : i % 2 === 0 }),
    );
    const entries = generateWeek({ recipes: pool, members: fam, weekStart: "2026-11-02" });
    for (const memberId of ["a", "b"]) {
      for (let day = 2; day <= 8; day++) {
        const dayDate = new Date(Date.parse("2026-11-02") + (day - 2) * 86400000).toISOString().slice(0, 10);
        const titles = entries
          .filter((e) => e.memberId === memberId && e.date === dayDate)
          .map((e) => e.recipeId);
        expect(new Set(titles).size).toBe(titles.length);
      }
    }
  });
});

describe("aggregateIngredients + buildShoppingList", () => {
  const items: RecipeItemsInfo[] = [
    {
      recipeId: "dal",
      servings: 2,
      items: [{ name: "toor dal", ingredientId: "ing-dal", grams: 150, unit: "g" }],
    },
  ];
  const byRecipe = new Map(items.map((i) => [i.recipeId, i]));
  const entries = [
    {
      date: "2026-11-02",
      slot: "dinner" as const,
      memberId: null,
      recipeId: "dal",
      servingsBase: 1.5,
      memberPortions: { a: 0.75, b: 0.75 },
    },
  ];

  it("scales by total portions / recipe servings", () => {
    const agg = aggregateIngredients(entries, byRecipe);
    expect(agg[0].neededG).toBeCloseTo(112.5, 0); // 150 × 1.5/2
  });

  it("subtracts pantry stock and formats display", () => {
    const agg = aggregateIngredients(entries, byRecipe);
    const list = buildShoppingList(agg, [
      { ingredientId: "ing-dal", name: "toor dal", quantity: 1, unit: "kg" },
    ]);
    expect(list).toHaveLength(0); // 112.5 g needed, 1000 g stocked

    const list2 = buildShoppingList(agg, [
      { ingredientId: "ing-dal", name: "toor dal", quantity: 50, unit: "g" },
    ]);
    expect(list2).toHaveLength(1);
    expect(list2[0].display).toBe("63 g"); // 112.5 − 50, rounded for display
  });
});

describe("mondayOf", () => {
  it("snaps any day to its Monday", () => {
    expect(mondayOf("2026-11-04")).toBe("2026-11-02"); // Wed → Mon
    expect(mondayOf("2026-11-02")).toBe("2026-11-02"); // Mon → same
    expect(mondayOf("2026-11-01")).toBe("2026-10-26"); // Sun → prior Mon
  });
});

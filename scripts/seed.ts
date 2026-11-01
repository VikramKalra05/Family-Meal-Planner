/**
 * Seeds the global ingredient master + recipe library.
 *
 * Run: npm run seed   (requires SUPABASE_SERVICE_ROLE_KEY in .env.local —
 * Supabase Dashboard → Project Settings → API → service_role, server-only)
 *
 * Idempotent: existing global ingredients (by name) and recipes (by title)
 * are left untouched; only missing rows are inserted. Nutrition is computed
 * from the ingredient master at seed time via the same deterministic module
 * the app uses.
 */

process.loadEnvFile(".env.local");

import { createClient } from "@supabase/supabase-js";
import { SEED_INGREDIENTS } from "../src/data/seed-ingredients.ts";
import { SEED_RECIPES } from "../src/data/seed-recipes.ts";
import { computeRecipeNutrition } from "../src/lib/nutrition/recipe.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.\n" +
      "Get the service_role key from Supabase Dashboard → Project Settings → API. " +
      "It bypasses RLS and must never ship to the browser.",
  );
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function seedIngredients(): Promise<Map<string, string>> {
  const { data: existing, error } = await db
    .from("ingredients")
    .select("id, name")
    .is("household_id", null);
  if (error) throw error;

  const byLowerName = new Map<string, string>(
    (existing ?? []).map((r) => [r.name.toLowerCase(), r.id]),
  );

  const missing = SEED_INGREDIENTS.filter((i) => !byLowerName.has(i.name.toLowerCase()));
  if (missing.length > 0) {
    const rows = missing.map((i) => ({
      name: i.name,
      name_hi: i.name_hi,
      category: i.category,
      kcal_per_100g: i.kcal,
      protein_per_100g: i.protein,
      carbs_per_100g: i.carbs,
      fat_per_100g: i.fat,
      fiber_per_100g: i.fiber,
      cost_per_100g: i.cost,
    }));
    const { error: insertErr } = await db.from("ingredients").insert(rows);
    if (insertErr) throw insertErr;
    console.log(`ingredients: inserted ${rows.length}`);
  } else {
    console.log("ingredients: nothing to insert");
  }

  // Refetch to resolve ids for everything (including just-inserted rows).
  const { data: all, error: refetchErr } = await db
    .from("ingredients")
    .select("id, name")
    .is("household_id", null);
  if (refetchErr) throw refetchErr;
  return new Map((all ?? []).map((r) => [r.name.toLowerCase(), r.id]));
}

async function seedRecipes(ingredientIds: Map<string, string>) {
  const { data: existing, error } = await db
    .from("recipes")
    .select("title")
    .is("household_id", null);
  if (error) throw error;
  const existingTitles = new Set((existing ?? []).map((r) => r.title.toLowerCase()));

  const nutritionRows: object[] = [];
  let inserted = 0;

  for (const recipe of SEED_RECIPES) {
    if (existingTitles.has(recipe.title.toLowerCase())) continue;

    // Validate every ingredient reference before touching the DB.
    const resolved = recipe.items.map(([name, grams, note]) => {
      const id = ingredientIds.get(name.toLowerCase());
      if (!id) {
        throw new Error(
          `Recipe "${recipe.title}" references unknown ingredient "${name}" — ` +
            `fix src/data/seed-recipes.ts or src/data/seed-ingredients.ts`,
        );
      }
      const ing = SEED_INGREDIENTS.find((i) => i.name.toLowerCase() === name.toLowerCase())!;
      return {
        grams,
        note: note ?? null,
        nutrition: { name, kcalPer100g: ing.kcal, proteinPer100g: ing.protein, carbsPer100g: ing.carbs, fatPer100g: ing.fat, fiberPer100g: ing.fiber },
      };
    });

    const { data: created, error: insertErr } = await db
      .from("recipes")
      .insert({
        title: recipe.title,
        description: recipe.description,
        source_type: "seed",
        servings: recipe.servings,
        prep_minutes: recipe.prep_minutes,
        steps: recipe.steps,
        is_veg: recipe.is_veg,
        cuisine: recipe.cuisine,
        verified: true,
        confidence: 1.0,
      })
      .select("id")
      .single();
    if (insertErr) throw insertErr;

    const { error: itemsErr } = await db.from("recipe_items").insert(
      resolved.map((r) => ({
        recipe_id: created.id,
        ingredient_id: ingredientIds.get(r.nutrition.name.toLowerCase()),
        quantity_g: r.grams,
        unit: "g",
        grams_estimate: r.grams,
        note: r.note,
      })),
    );
    if (itemsErr) throw itemsErr;

    const nutrition = computeRecipeNutrition(
      resolved.map((r) => ({ ingredient: r.nutrition, grams: r.grams })),
      recipe.servings,
    );
    nutritionRows.push({
      recipe_id: created.id,
      kcal: nutrition.kcal,
      protein_g: nutrition.proteinG,
      carbs_g: nutrition.carbsG,
      fat_g: nutrition.fatG,
      fiber_g: nutrition.fiberG,
      method: "computed",
    });
    inserted++;
  }

  if (nutritionRows.length > 0) {
    const { error: nutErr } = await db.from("recipe_nutrition").insert(nutritionRows);
    if (nutErr) throw nutErr;
  }
  console.log(`recipes: inserted ${inserted}, skipped ${SEED_RECIPES.length - inserted}`);
}

// ── Recipe photos from Wikimedia Commons ─────────────────────────────────────
// Curated title→article lookups only: a wrong-dish photo is worse than the
// gradient placeholder, so no blind search. Images are hotlinked from
// upload.wikimedia.org (CC-licensed; attribution display lands in M6).
// User-set image_url values are never overwritten.

const WIKI_OVERRIDES: Record<string, string> = {
  "kanda poha": "Poha (dish)",
  "rava upma": "Upma",
  "idli (8 pieces)": "Idli",
  "plain dosa (4 pieces)": "Dosa",
  "masala dosa (2 pieces)": "Masala dosa",
  "aloo paratha (3 pieces)": "Aloo paratha",
  "plain paratha (3 pieces)": "Paratha",
  "methi thepla (4 pieces)": "Thepla",
  "sabudana khichdi": "Sabudana khichdi",
  "egg bhurji (4 eggs)": "Egg bhurji",
  "dal tadka": "Dal",
  "dal fry": "Dal",
  "moong dal khichdi": "Khichdi",
  "punjabi rajma": "Rajma",
  "chole (chana masala)": "Chana masala",
  "palak paneer": "Palak paneer",
  "matar paneer": "Mattar paneer",
  "shahi paneer": "Shahi paneer",
  "aloo gobi": "Aloo gobi",
  "aloo mutter": "Aloo mutter",
  "bhindi masala": "Bhindi masala",
  "baingan bharta": "Baingan bharta",
  "gujarati dhokla": "Dhokla",
  "vegetable pulao": "Pulao",
  "chicken pulao": "Pulao",
  "lemon rice": "Lemon rice",
  "curd rice": "Curd rice",
  sambar: "Sambar (dish)",
  rasam: "Rasam",
  "vegetable biryani": "Biryani",
  "coconut chutney": "Chutney",
  "roti / chapati (4 pieces)": "Roti",
  "puri (6 pieces)": "Puri",
  "naan (3 pieces)": "Naan",
  "missi roti (3 pieces)": "Missi roti",
  "samosa (6 pieces)": "Samosa",
  "aloo pakora (8 pieces)": "Pakora",
  "bhel puri": "Bhel puri",
  "vegetable cutlet (6 pieces)": "Cutlet",
  "vada pav (2 pieces)": "Vada pav",
  "pav bhaji": "Pav bhaji",
  "pesarattu (2 pieces)": "Pesarattu",
  "ven pongal": "Pongal (dish)",
  "rava dosa (3 pieces)": "Rava dosa",
  "medu vada (6 pieces)": "Vada",
  "chicken curry": "Chicken curry",
  "butter chicken": "Butter chicken",
  "chicken biryani": "Chicken biryani",
  "rice kheer": "Kheer",
  "tandoori chicken (grilled)": "Tandoori chicken",
  "chicken tikka (oven-grilled)": "Chicken tikka",
  "egg fried rice": "Fried rice",
  "chicken keema matar": "Keema",
  "chicken seekh kebab (oven)": "Seekh kebab",
};

async function wikiThumbnail(article: string): Promise<string | null> {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrsearch", article);
  url.searchParams.set("gsrlimit", "2");
  url.searchParams.set("prop", "pageimages");
  url.searchParams.set("piprop", "thumbnail");
  url.searchParams.set("pithumbsize", "640");

  // The API throttles bursts with empty responses — retry with backoff.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "FamilyMealPlanner/0.1 (academic capstone; seed image lookup)" },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
        };
        const pages = Object.values(data.query?.pages ?? {});
        const thumb = pages.find((p) => p.thumbnail?.source)?.thumbnail?.source ?? null;
        if (thumb) return thumb;
        return null; // valid response, no image for this article
      }
    } catch {
      // network hiccup — fall through to retry
    }
    await new Promise((res) => setTimeout(res, 1000 * (attempt + 1)));
  }
  return null;
}

// Recipes whose photo lives in public/photos/ (Wikimedia images downloaded,
// visually verified against the dish, and committed to the repo — no hotlink,
// no runtime API dependency). See src/data/photo-credits.md for provenance.
const LOCAL_PHOTOS: Record<string, string> = {
  "moong dal chilla": "/photos/moong-dal-chilla.jpg",
  "besan chilla": "/photos/besan-chilla.jpg",
  "oats porridge": "/photos/oats-porridge.jpg",
  "sprouts chaat": "/photos/sprouts-chaat.jpg",
  "jeera aloo": "/photos/jeera-aloo.jpg",
  "cabbage poriyal": "/photos/cabbage-poriyal.jpg",
  "mixed vegetable sabzi": "/photos/mixed-vegetable-sabzi.jpg",
  "lauki chana dal": "/photos/lauki-chana-dal.jpg",
  "soy chunk curry": "/photos/soy-chunk-curry.jpg",
  "steamed rice": "/photos/steamed-rice.jpg",
  "jeera rice": "/photos/jeera-rice.jpg",
  "curd rice (thayir sadam)": "/photos/curd-rice.jpg",
  "bread pakora (4 pieces)": "/photos/bread-pakora.jpg",
  "egg curry (6 eggs)": "/photos/egg-curry.jpg",
  "fish fry (2 pieces)": "/photos/fish-fry.jpg",
  "sooji halwa": "/photos/sooji-halwa.jpg",
  "mixed fruit bowl": "/photos/mixed-fruit-bowl.jpg",
  "pepper chicken dry": "/photos/pepper-chicken-dry.jpg",
  "chicken clear soup": "/photos/chicken-clear-soup.jpg",
  "egg dosa (2 pieces)": "/photos/egg-dosa.jpg",
  "light fish curry": "/photos/light-fish-curry.jpg",
  "prawn masala (dry)": "/photos/prawn-masala.jpg",
  "grilled chicken salad bowl": "/photos/grilled-chicken-salad.jpg",
};

async function backfillImages(): Promise<void> {
  const { data: recipes, error } = await db
    .from("recipes")
    .select("id, title")
    .is("household_id", null)
    .is("image_url", null);
  if (error) throw error;
  if (!recipes?.length) {
    console.log("images: all recipes already have photos");
    return;
  }

  let set = 0;
  let missed = 0;
  for (const r of recipes) {
    const local = LOCAL_PHOTOS[r.title.toLowerCase()];
    if (local) {
      const { error: localErr } = await db.from("recipes").update({ image_url: local }).eq("id", r.id);
      if (localErr) throw localErr;
      set++;
      continue;
    }
    const article = WIKI_OVERRIDES[r.title.toLowerCase()];
    if (!article) {
      missed++;
      continue;
    }
    const thumb = await wikiThumbnail(article);
    if (thumb) {
      const { error: updErr } = await db.from("recipes").update({ image_url: thumb }).eq("id", r.id);
      if (updErr) throw updErr;
      set++;
    } else {
      missed++;
    }
    await new Promise((res) => setTimeout(res, 400)); // be polite to the API
  }
  console.log(`images: set ${set}, no article found for ${missed} (placeholders remain)`);
}

const ingredients = await seedIngredients();
await seedRecipes(ingredients);
await backfillImages();
console.log("Seed complete.");

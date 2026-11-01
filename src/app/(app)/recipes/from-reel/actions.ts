"use server";

import { revalidatePath } from "next/cache";

import { z } from "zod";
import {
  ProviderNotConfiguredError,
  ProviderError,
  chatJson,
  resolveProvider,
} from "@/lib/ai/provider";
import {
  draftRecipeSchema,
  estimateMessages,
  estimatedIngredientSchema,
  fetchPageMeta,
  reelExtractionMessages,
  type DraftRecipe,
} from "@/lib/ai/recipes";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import { defaultUnitFor } from "@/lib/food";
import { requireFullProfile } from "@/lib/profile";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export type DraftResult =
  | { ok: true; draft: DraftRecipe }
  | { ok: false; error: string; needsCaption?: boolean };

export async function draftRecipeFromUrl(input: {
  url: string;
  caption?: string | null;
}): Promise<DraftResult> {
  const profile = await requireFullProfile();
  const provider = await resolveProvider();
  if (!provider) {
    return { ok: false, error: "No AI provider configured — add one in Settings → AI Providers first." };
  }
  if (!checkRate(`reel:${profile.id}`, 10, 60 * 60 * 1000)) {
    return { ok: false, error: rateLimited(10, 60 * 60 * 1000) };
  }

  const urlCheck = z.string().url().safeParse(input.url);
  if (!urlCheck.success) return { ok: false, error: "Paste a valid URL (Instagram reel, YouTube short, blog post…)" };

  const meta = await fetchPageMeta(input.url);
  if (!meta && !input.caption?.trim()) {
    return {
      ok: false,
      error:
        "The link could not be read (Instagram usually blocks automated access). Paste the caption or the ingredients/steps text and try again.",
      needsCaption: true,
    };
  }

  try {
    const draft = await chatJson(provider, draftRecipeSchema, reelExtractionMessages({
      url: input.url,
      pageMeta: meta,
      caption: input.caption ?? null,
    }), { maxTokens: 2500, temperature: 0.2 });
    return { ok: true, draft };
  } catch (e) {
    if (e instanceof ProviderNotConfiguredError || e instanceof ProviderError) {
      return { ok: false, error: e.message };
    }
    return { ok: false, error: "Something went wrong while drafting — try again." };
  }
}

const importSchema = draftRecipeSchema.extend({
  source_url: z.string().url().refine((v) => /^https?:\/\//i.test(v), "Only http(s) URLs").optional().nullable(),
});

export type ImportResult = { error: string } | { id: string };

/**
 * Persists an (edited) AI draft: matches ingredient names against the master
 * library, AI-estimates macros for unknown ones (stored as household
 * ingredients), computes nutrition, and creates the recipe.
 */
export async function importDraftRecipe(draftInput: DraftRecipe & { source_url?: string | null }): Promise<ImportResult> {
  const profile = await requireFullProfile();
  const parsed = importSchema.safeParse(draftInput);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid draft" };
  const draft = parsed.data;

  const supabase = await createClient();

  // Resolve or create every ingredient.
  const { data: master } = await supabase
    .from("ingredients")
    .select("id, name, category, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g");
  const byLower = new Map((master ?? []).map((i) => [i.name.toLowerCase(), i]));

  const resolvedItems: {
    id: string;
    name: string;
    category: string | null;
    kcal: number; protein: number; carbs: number; fat: number; fiber: number | null;
    grams: number;
    note: string | null;
    aiEstimated: boolean;
  }[] = [];

  let provider: Awaited<ReturnType<typeof resolveProvider>> = null;
  for (const item of draft.ingredients) {
    const key = item.name.trim().toLowerCase();
    const hit = byLower.get(key);
    if (hit) {
      resolvedItems.push({
        id: hit.id, name: hit.name, category: hit.category,
        kcal: Number(hit.kcal_per_100g), protein: Number(hit.protein_per_100g),
        carbs: Number(hit.carbs_per_100g), fat: Number(hit.fat_per_100g),
        fiber: hit.fiber_per_100g == null ? null : Number(hit.fiber_per_100g),
        grams: item.grams, note: item.note ?? null, aiEstimated: false,
      });
      continue;
    }

    // Unknown ingredient — estimate macros with AI and store household-scoped.
    provider ??= await resolveProvider();
    if (!provider) return { error: "No AI provider configured — needed to estimate unknown ingredients." };

    const est = await chatJson(provider, estimatedIngredientSchema, estimateMessages({ name: item.name }), { maxTokens: 400 });
    const { data: created, error: insErr } = await supabase
      .from("ingredients")
      .insert({
        household_id: profile.household_id,
        name: key,
        category: "custom-ai",
        kcal_per_100g: est.kcal_per_100g,
        protein_per_100g: est.protein_per_100g,
        carbs_per_100g: est.carbs_per_100g,
        fat_per_100g: est.fat_per_100g,
        fiber_per_100g: est.fiber_per_100g ?? null,
      })
      .select("id, name")
      .single();
    if (insErr) return { error: insErr.message };
    byLower.set(key, {
      id: created.id,
      name: created.name,
      category: "custom-ai",
      kcal_per_100g: est.kcal_per_100g,
      protein_per_100g: est.protein_per_100g,
      carbs_per_100g: est.carbs_per_100g,
      fat_per_100g: est.fat_per_100g,
      fiber_per_100g: est.fiber_per_100g ?? null,
    });
    resolvedItems.push({
      id: created.id, name: created.name, category: "custom-ai",
      kcal: est.kcal_per_100g, protein: est.protein_per_100g,
      carbs: est.carbs_per_100g, fat: est.fat_per_100g, fiber: est.fiber_per_100g ?? null,
      grams: item.grams, note: item.note ?? null, aiEstimated: true,
    });
  }

  const nutrition = computeRecipeNutrition(
    resolvedItems.map((r) => ({
      ingredient: {
        name: r.name,
        kcalPer100g: r.kcal,
        proteinPer100g: r.protein,
        carbsPer100g: r.carbs,
        fatPer100g: r.fat,
        fiberPer100g: r.fiber,
      },
      grams: r.grams,
    })),
    draft.servings,
  );

  const { data: createdRecipe, error: recipeErr } = await supabase
    .from("recipes")
    .insert({
      household_id: profile.household_id,
      owner_id: profile.id,
      title: draft.title,
      description: draft.description ?? null,
      source_type: "reel",
      source_url: draft.source_url ?? null,
      servings: draft.servings,
      steps: draft.steps,
      is_veg: draft.is_veg,
      cuisine: draft.cuisine ?? null,
      confidence: 0.8,
    })
    .select("id")
    .single();
  if (recipeErr) return { error: recipeErr.message };

  const { error: itemsErr } = await supabase.from("recipe_items").insert(
    resolvedItems.map((r) => ({
      recipe_id: createdRecipe.id,
      ingredient_id: r.id,
      quantity_g: r.grams,
      unit: defaultUnitFor(r.name, r.category),
      grams_estimate: r.grams,
      note: r.note,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  const { error: nutErr } = await supabase.from("recipe_nutrition").insert({
    recipe_id: createdRecipe.id,
    kcal: nutrition.kcal,
    protein_g: nutrition.proteinG,
    carbs_g: nutrition.carbsG,
    fat_g: nutrition.fatG,
    fiber_g: nutrition.fiberG,
    method: "computed",
  });
  if (nutErr) return { error: nutErr.message };

  if (draft.source_url) {
    await supabase.from("recipe_media").insert({
      recipe_id: createdRecipe.id,
      kind: "video",
      url: draft.source_url,
      label: "Original post",
    });
  }

  revalidatePath("/recipes");
  return { id: createdRecipe.id };
}

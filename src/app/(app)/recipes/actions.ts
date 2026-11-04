"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  ProviderError,
  chatJson,
  resolveProvider,
} from "@/lib/ai/provider";
import {
  estimateMessages,
  estimatedIngredientSchema,
} from "@/lib/ai/recipes";
import { computeRecipeNutrition } from "@/lib/nutrition/recipe";
import { defaultUnitFor } from "@/lib/food";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { requireFullProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import type { IngredientOption } from "./types";

export type RecipeActionState = { error: string | null };

/** z.string().url() accepts javascript:/data: URIs — enforce http(s) for anything rendered as href/src. */
const httpUrl = z
  .string()
  .url("Must be a valid URL")
  .refine((v) => /^https?:\/\//i.test(v), "Only http(s) URLs are allowed")
  .max(600);

const createIngredientSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  kcal: z.coerce.number().min(0).max(900),
  protein: z.coerce.number().min(0).max(100),
  carbs: z.coerce.number().min(0).max(100),
  fat: z.coerce.number().min(0).max(100),
});

/**
 * Household-scoped custom ingredient for recipes whose item isn't in the
 * master library. Visible to the whole household via RLS.
 */
export async function createCustomIngredient(input: {
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}): Promise<{ error: string } | { id: string; name: string }> {
  const profile = await requireFullProfile();
  const parsed = createIngredientSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid ingredient" };
  const v = parsed.data;

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("ingredients")
    .select("id, name")
    .eq("household_id", profile.household_id)
    .ilike("name", v.name)
    .maybeSingle();
  if (existing) return { id: existing.id, name: existing.name };

  const { data: created, error } = await supabase
    .from("ingredients")
    .insert({
      household_id: profile.household_id,
      name: v.name.toLowerCase(),
      category: "custom",
      kcal_per_100g: v.kcal,
      protein_per_100g: v.protein,
      carbs_per_100g: v.carbs,
      fat_per_100g: v.fat,
      fiber_per_100g: null,
    })
    .select("id, name")
    .single();
  if (error) return { error: error.message };
  return { id: created.id, name: created.name };
}

/** Client-facing adapter: creates the ingredient and returns it as a form option. */
export async function createCustomIngredientOption(
  name: string,
  macros: { kcal: number; protein: number; carbs: number; fat: number },
): Promise<IngredientOption | null> {
  const res = await createCustomIngredient({ name, ...macros });
  if ("error" in res) return null;
  return {
    id: res.id,
    name: res.name,
    category: "custom",
    kcalPer100g: macros.kcal,
    proteinPer100g: macros.protein,
    carbsPer100g: macros.carbs,
    fatPer100g: macros.fat,
    fiberPer100g: null,
    unit: defaultUnitFor(res.name, null),
  };
}

/** ✨ AI macro estimation for the ingredient-create mini-form. */
export async function estimateIngredientAction(
  name: string,
): Promise<{ kcal: number; protein: number; carbs: number; fat: number } | { error: string }> {
  const prof = await requireFullProfile();
  const provider = await resolveProvider();
  if (!provider) return { error: "No AI provider configured — add one in Settings → AI Providers." };
  if (!checkRate(`est:${prof.id}`, 20, 60 * 60 * 1000)) return { error: rateLimited(20, 60 * 60 * 1000) };
  try {
    const est = await chatJson(
      provider,
      estimatedIngredientSchema,
      estimateMessages({ name }),
      { maxTokens: 400, temperature: 0.2, feature: "ingredient_estimate" },
    );
    return {
      kcal: est.kcal_per_100g,
      protein: est.protein_per_100g,
      carbs: est.carbs_per_100g,
      fat: est.fat_per_100g,
    };
  } catch (e) {
    return { error: e instanceof ProviderError ? e.message : "Estimation failed — enter values manually." };
  }
}

const ingredientOptionSchema = z.object({
  id: z.string().uuid(),
  grams: z.coerce.number().min(0.1).max(5000),
  unit: z.enum(["g", "ml"]).default("g"),
  note: z.string().max(120).optional().nullable(),
});

const recipePayloadSchema = z.object({
  title: z.string().min(2, "Title is required").max(80),
  description: z.string().max(300).optional().nullable(),
  cuisine: z.string().max(40).optional().nullable(),
  servings: z.coerce.number().int().min(1).max(20),
  prep_minutes: z.coerce.number().int().min(0).max(600).optional().nullable(),
  is_veg: z.coerce.boolean(),
  image_url: httpUrl.optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  steps: z.array(z.string().min(1)).min(1, "Add at least one step"),
  items: z.array(ingredientOptionSchema).min(1, "Add at least one ingredient"),
  media: z
    .array(
      z.object({
        kind: z.enum(["image", "video"]),
        url: httpUrl,
        label: z.string().max(80).optional().nullable(),
      }),
    )
    .max(12)
    .optional()
    .default([]),
});

function parsePayload(formData: FormData) {
  const raw = formData.get("payload");
  if (typeof raw !== "string") return { ok: false as const, error: "Missing form payload" };
  const parsed = recipePayloadSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid recipe" };
  }
  return { ok: true as const, data: parsed.data };
}

export async function createRecipe(
  _prev: RecipeActionState,
  formData: FormData,
): Promise<RecipeActionState> {
  const profile = await requireFullProfile();
  const parsed = parsePayload(formData);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.data;

  const supabase = await createClient();

  // Resolve chosen ingredient ids to their master nutrition for computation.
  const { data: ingredients, error: ingErr } = await supabase
    .from("ingredients")
    .select("id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .in("id", v.items.map((i) => i.id));
  if (ingErr) return { error: ingErr.message };
  const byId = new Map((ingredients ?? []).map((i) => [i.id, i]));

  const missing = v.items.filter((i) => !byId.has(i.id));
  if (missing.length > 0) return { error: "Unknown ingredient selected" };

  const { data: created, error: insertErr } = await supabase
    .from("recipes")
    .insert({
      household_id: profile.household_id,
      owner_id: profile.id,
      title: v.title,
      description: v.description ?? null,
      source_type: "user",
      servings: v.servings,
      prep_minutes: v.prep_minutes ?? null,
      steps: v.steps,
      is_veg: v.is_veg,
      cuisine: v.cuisine ?? null,
      image_url: v.image_url ?? null,
      notes: v.notes ?? null,
      confidence: 1.0,
    })
    .select("id")
    .single();
  if (insertErr) return { error: insertErr.message };

  const { error: itemsErr } = await supabase.from("recipe_items").insert(
    v.items.map((i) => ({
      recipe_id: created.id,
      ingredient_id: i.id,
      quantity_g: i.grams,
      unit: i.unit,
      grams_estimate: i.grams,
      note: i.note ?? null,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  const nutrition = computeRecipeNutrition(
    v.items.map((i) => {
      const ing = byId.get(i.id)!;
      return {
        ingredient: {
          name: ing.name,
          kcalPer100g: Number(ing.kcal_per_100g),
          proteinPer100g: Number(ing.protein_per_100g),
          carbsPer100g: Number(ing.carbs_per_100g),
          fatPer100g: Number(ing.fat_per_100g),
          fiberPer100g: ing.fiber_per_100g == null ? null : Number(ing.fiber_per_100g),
        },
        grams: i.grams,
      };
    }),
    v.servings,
  );

  const { error: nutErr } = await supabase.from("recipe_nutrition").insert({
    recipe_id: created.id,
    kcal: nutrition.kcal,
    protein_g: nutrition.proteinG,
    carbs_g: nutrition.carbsG,
    fat_g: nutrition.fatG,
    fiber_g: nutrition.fiberG,
    method: "computed",
  });
  if (nutErr) return { error: nutErr.message };

  if (v.media.length > 0) {
    const { error: mediaErr } = await supabase.from("recipe_media").insert(
      v.media.map((m) => ({ recipe_id: created.id, kind: m.kind, url: m.url, label: m.label ?? null })),
    );
    if (mediaErr) return { error: mediaErr.message };
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${created.id}`);
}

export async function updateRecipe(
  _prev: RecipeActionState,
  formData: FormData,
): Promise<RecipeActionState> {
  const profile = await requireFullProfile();
  const recipeId = z.string().uuid().safeParse(formData.get("recipe_id"));
  if (!recipeId.success) return { error: "Invalid recipe" };

  const parsed = parsePayload(formData);
  if (!parsed.ok) return { error: parsed.error };
  const v = parsed.data;

  const supabase = await createClient();

  // RLS also enforces ownership; this check gives a friendly error.
  const { data: existing } = await supabase
    .from("recipes")
    .select("id, owner_id")
    .eq("id", recipeId.data)
    .maybeSingle();
  if (!existing) return { error: "Recipe not found" };
  if (existing.owner_id !== profile.id) return { error: "You can only edit your own recipes" };

  const { data: ingredients, error: ingErr } = await supabase
    .from("ingredients")
    .select("id, name, kcal_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, fiber_per_100g")
    .in("id", v.items.map((i) => i.id));
  if (ingErr) return { error: ingErr.message };
  const byId = new Map((ingredients ?? []).map((i) => [i.id, i]));

  const { error: updateErr } = await supabase
    .from("recipes")
    .update({
      title: v.title,
      description: v.description ?? null,
      cuisine: v.cuisine ?? null,
      servings: v.servings,
      prep_minutes: v.prep_minutes ?? null,
      steps: v.steps,
      is_veg: v.is_veg,
      image_url: v.image_url ?? null,
      notes: v.notes ?? null,
    })
    .eq("id", recipeId.data);
  if (updateErr) return { error: updateErr.message };

  await supabase.from("recipe_media").delete().eq("recipe_id", recipeId.data);
  if (v.media.length > 0) {
    const { error: mediaErr } = await supabase.from("recipe_media").insert(
      v.media.map((m) => ({ recipe_id: recipeId.data, kind: m.kind, url: m.url, label: m.label ?? null })),
    );
    if (mediaErr) return { error: mediaErr.message };
  }

  await supabase.from("recipe_items").delete().eq("recipe_id", recipeId.data);
  const { error: itemsErr } = await supabase.from("recipe_items").insert(
    v.items.map((i) => ({
      recipe_id: recipeId.data,
      ingredient_id: i.id,
      quantity_g: i.grams,
      unit: i.unit,
      grams_estimate: i.grams,
      note: i.note ?? null,
    })),
  );
  if (itemsErr) return { error: itemsErr.message };

  const nutrition = computeRecipeNutrition(
    v.items.map((i) => {
      const ing = byId.get(i.id)!;
      return {
        ingredient: {
          name: ing.name,
          kcalPer100g: Number(ing.kcal_per_100g),
          proteinPer100g: Number(ing.protein_per_100g),
          carbsPer100g: Number(ing.carbs_per_100g),
          fatPer100g: Number(ing.fat_per_100g),
          fiberPer100g: ing.fiber_per_100g == null ? null : Number(ing.fiber_per_100g),
        },
        grams: i.grams,
      };
    }),
    v.servings,
  );

  const { error: nutErr } = await supabase
    .from("recipe_nutrition")
    .upsert({
      recipe_id: recipeId.data,
      kcal: nutrition.kcal,
      protein_g: nutrition.proteinG,
      carbs_g: nutrition.carbsG,
      fat_g: nutrition.fatG,
      fiber_g: nutrition.fiberG,
      method: "computed",
      computed_at: new Date().toISOString(),
    });
  if (nutErr) return { error: nutErr.message };

  revalidatePath("/recipes");
  revalidatePath(`/recipes/${recipeId.data}`);
  redirect(`/recipes/${recipeId.data}`);
}

const tagMediaSchema = z.object({
  recipe_id: z.string().uuid(),
  kind: z.enum(["image", "video"]),
  url: httpUrl,
  label: z.string().trim().max(80).optional().nullable(),
});

/** Quick media tagging straight from the recipe page — any member who can
 *  see the recipe can tag (collaborative watch-later, per RLS). */
export async function tagRecipeMedia(formData: FormData): Promise<void> {
  await requireFullProfile();
  const parsed = tagMediaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("recipe_media").insert({
    recipe_id: parsed.data.recipe_id,
    kind: parsed.data.kind,
    url: parsed.data.url,
    label: parsed.data.label || null,
  });
  revalidatePath(`/recipes/${parsed.data.recipe_id}`);
}

export async function untagRecipeMedia(formData: FormData): Promise<void> {
  await requireFullProfile();
  const parsed = z
    .object({ mediaId: z.string().uuid(), recipeId: z.string().uuid() })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return;
  const supabase = await createClient();
  await supabase.from("recipe_media").delete().eq("id", parsed.data.mediaId);
  revalidatePath(`/recipes/${parsed.data.recipeId}`);
}

export async function deleteRecipe(formData: FormData): Promise<void> {
  await requireFullProfile();
  const recipeId = z.string().uuid().safeParse(formData.get("recipe_id"));
  if (!recipeId.success) return;

  const supabase = await createClient();
  // RLS: delete allowed only for own recipes.
  await supabase.from("recipes").delete().eq("id", recipeId.data);
  revalidatePath("/recipes");
  redirect("/recipes");
}

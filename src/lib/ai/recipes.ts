import { z } from "zod";

/** Schemas + prompts shared by the AI features (reel extraction, estimation). */

export const draftRecipeSchema = z.object({
  title: z.string().min(2).max(80),
  description: z.string().max(300).optional().nullable(),
  servings: z.coerce.number().int().min(1).max(12),
  is_veg: z.boolean(),
  cuisine: z.string().max(40).optional().nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        grams: z.coerce.number().min(0.1).max(5000),
        note: z.string().max(120).optional().nullable(),
      }),
    )
    .min(1)
    .max(30),
  steps: z.array(z.string().min(1).max(600)).min(1).max(20),
});
export type DraftRecipe = z.infer<typeof draftRecipeSchema>;

export const estimatedIngredientSchema = z.object({
  kcal_per_100g: z.coerce.number().min(0).max(900),
  protein_per_100g: z.coerce.number().min(0).max(100),
  carbs_per_100g: z.coerce.number().min(0).max(100),
  fat_per_100g: z.coerce.number().min(0).max(100),
  fiber_per_100g: z.coerce.number().min(0).max(100).optional().nullable(),
  confidence: z.coerce.number().min(0).max(1),
});
export type EstimatedIngredient = z.infer<typeof estimatedIngredientSchema>;

const REEL_EXTRACTION_SYSTEM = `You extract recipes from social media posts (Instagram reels, YouTube shorts, food blogs).
Respond with ONLY a JSON object, no prose, shaped exactly like:
{
  "title": string,
  "description": string (one line, optional),
  "servings": integer 1-12,
  "is_veg": boolean (false if the dish contains meat, fish or egg),
  "cuisine": one of "north-indian", "south-indian", "punjabi", "gujarati", "maharashtrian", "hyderabadi", "bengali", "street-food", "all-india", "continental",
  "ingredients": [{"name": "lowercase english ingredient name", "grams": number (raw weight in grams for the WHOLE recipe; liquids may be given in ml-as-grams), "note": string|null (e.g. "for tempering", "frying oil, absorbed")}],
  "steps": [string, …]
}
Rules: scale ingredients to the stated servings; use common Indian ingredient naming (e.g. "atta (whole wheat flour)", "toor dal (split pigeon pea)", "paneer", "curd (dahi)"); include salt, oil/ghee and spices with realistic gram amounts; 4-10 steps written as instructions.`;

const ESTIMATE_SYSTEM = `You are a nutrition-data assistant using Indian (IFCT) and USDA food composition knowledge.
Given an ingredient name (and optional context), estimate its macronutrients PER 100 GRAMS of the edible raw portion.
Respond with ONLY JSON: {"kcal_per_100g": number, "protein_per_100g": number, "carbs_per_100g": number, "fat_per_100g": number, "fiber_per_100g": number|null, "confidence": 0-1}.
Be conservative: typical values for the most common interpretation of the name. confidence reflects how standard the item is (packaged/branded items are lower).`;

export function reelExtractionMessages(input: {
  url: string;
  pageMeta: { title?: string; description?: string } | null;
  caption?: string | null;
}): { role: "system" | "user"; content: string }[] {
  const parts = [`Post URL: ${input.url}`];
  if (input.pageMeta?.title) parts.push(`Page title: ${input.pageMeta.title}`);
  if (input.pageMeta?.description) parts.push(`Page description: ${input.pageMeta.description}`);
  if (input.caption?.trim()) parts.push(`Caption/transcript:\n${input.caption.trim().slice(0, 4000)}`);
  return [
    { role: "system", content: REEL_EXTRACTION_SYSTEM },
    { role: "user", content: parts.join("\n\n") },
  ];
}

export function estimateMessages(input: {
  name: string;
  context?: string | null;
}): { role: "system" | "user"; content: string }[] {
  return [
    { role: "system", content: ESTIMATE_SYSTEM },
    { role: "user", content: `Ingredient: ${input.name}${input.context ? `\nContext: ${input.context}` : ""}` },
  ];
}

/**
 * Fetches og/meta metadata from a share URL; returns null when blocked
 * (Instagram frequently does). SSRF guard: https-only and hostnames that
 * can never resolve inside the server's own network.
 */
const BLOCKED_HOSTS = /^(localhost$|127\.|10\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[::1\]$|.*\.local$|.*\.internal$)/i;

export function isSafePublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    return !BLOCKED_HOSTS.test(u.hostname);
  } catch {
    return false;
  }
}

export async function fetchPageMeta(
  url: string,
): Promise<{ title?: string; description?: string } | null> {
  if (!isSafePublicUrl(url)) return null;
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
        Accept: "text/html",
      },
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 200_000);
    const pick = (prop: string) => {
      const m =
        html.match(new RegExp(`<meta[^>]+property=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i")) ??
        html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${prop}["']`, "i"));
      return m?.[1];
    };
    const title = pick("og:title") ?? html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    const description = pick("og:description") ?? pick("description");
    return { title: title?.trim(), description: description?.trim() };
  } catch {
    return null;
  }
}

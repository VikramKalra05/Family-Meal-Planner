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
Rules: base the recipe ONLY on the provided page title, description and caption — NEVER invent or "fill in" a recipe that the text does not describe. If the provided text does not clearly identify one specific dish (no usable dish name, ingredients, or cooking method), respond with exactly {"cannot_extract": true} and nothing else. Otherwise: scale ingredients to the stated servings; use common Indian ingredient naming (e.g. "atta (whole wheat flour)", "toor dal (split pigeon pea)", "paneer", "curd (dahi)"); include salt, oil/ghee and spices with realistic gram amounts; 4-10 steps written as instructions.`;

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

const UA_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36",
  Accept: "text/html",
};

/**
 * Instagram-specific fallback: the /embed/captioned/ endpoint often returns
 * the full post caption even when the main page is a login wall. Only ever
 * called with https Instagram URLs (the action validates them first).
 */
export async function fetchInstagramCaption(url: string): Promise<string | null> {
  if (!/^(https?:\/\/)?(www\.)?instagram\.com\//i.test(url)) return null;
  const shortcode = url.match(/instagram\.com\/(?:p|reel|reels|tv)\/([A-Za-z0-9_-]+)/i)?.[1];
  if (!shortcode) return null;
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  if (!isSafePublicUrl(embedUrl)) return null;
  try {
    const res = await fetch(embedUrl, {
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: UA_HEADERS,
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 300_000);
    const capMatch = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/);
    const raw = capMatch?.[1] ?? pickMetaDescription(html);
    if (!raw) return null;
    const text = raw
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&quot;/g, '"')
      .replace(/&#0?39;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .trim();
    // The embed caption block ends with UI strings like "View on Instagram" —
    // those add noise for the model, so cut them off.
    const cleaned = text.split(/\n\s*(?:View on Instagram|Comments|Share|Log in)/i)[0].trim();
    return cleaned.length > 0 ? cleaned.slice(0, 4000) : null;
  } catch {
    return null;
  }
}

function pickMetaDescription(html: string): string | null {
  const m =
    html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  return m?.[1] ?? null;
}

// Login-wall/boilerplate values that carry no recipe information.
const GENERIC_META = /^(instagram|login ?[•-] ?instagram|create an? account|see instagram photos and videos[^\n]*|x+|\d+ likes?,? ?\d* ?comments?.*)$/i;

/**
 * Decides whether the gathered post content is substantial enough to ask the
 * LLM for a recipe. The whole point: never let the model hallucinate a dish
 * from a bare URL — with no usable text we refuse and ask for the caption.
 */
export function postHasRecipeContent(
  meta: { title?: string; description?: string } | null,
  caption?: string | null,
): boolean {
  if (caption?.trim() && caption.trim().length >= 20) return true;
  const text = [meta?.title, meta?.description]
    .filter((s): s is string => Boolean(s && s.trim()))
    .join(" ")
    .trim();
  if (!text) return false;
  const stripped = text.replace(GENERIC_META, "").trim();
  return stripped.length >= 40;
}

/** Video/media link parsing for watch-later tags and auto card art. */

export interface ParsedMedia {
  platform: "youtube" | "instagram" | "link";
  videoId: string | null;
  /** Auto thumbnail when the platform provides one (YouTube). */
  thumbnailUrl: string | null;
}

export function parseMediaUrl(rawUrl: string): ParsedMedia {
  try {
    const url = new URL(rawUrl);

    if (url.hostname.includes("youtube.com")) {
      const videoId = url.searchParams.get("v") ?? url.pathname.split("/").filter(Boolean).pop() ?? null;
      const valid = videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId) ? videoId : null;
      return {
        platform: "youtube",
        videoId: valid,
        thumbnailUrl: valid ? `https://i.ytimg.com/vi/${valid}/hqdefault.jpg` : null,
      };
    }
    if (url.hostname === "youtu.be") {
      const videoId = url.pathname.slice(1) || null;
      const valid = videoId && /^[a-zA-Z0-9_-]{6,20}$/.test(videoId) ? videoId : null;
      return {
        platform: "youtube",
        videoId: valid,
        thumbnailUrl: valid ? `https://i.ytimg.com/vi/${valid}/hqdefault.jpg` : null,
      };
    }
    if (url.hostname.includes("instagram.com")) {
      return { platform: "instagram", videoId: null, thumbnailUrl: null };
    }
    return { platform: "link", videoId: null, thumbnailUrl: null };
  } catch {
    return { platform: "link", videoId: null, thumbnailUrl: null };
  }
}

/** deterministic placeholder art per dish — flat clashing pastels (no gradients). */
const CUISINE_COLORS: Record<string, string> = {
  "north-indian": "bg-orange-200",
  "south-indian": "bg-lime-200",
  punjabi: "bg-rose-200",
  gujarati: "bg-yellow-200",
  maharashtrian: "bg-orange-300",
  hyderabadi: "bg-pink-200",
  "street-food": "bg-fuchsia-200",
  "all-india": "bg-emerald-200",
  continental: "bg-sky-200",
};

export function placeholderGradient(cuisine: string | null): string {
  return CUISINE_COLORS[cuisine ?? ""] ?? "bg-neutral-200";
}

export function dishEmoji(title: string): string {
  const t = title.toLowerCase();
  if (/(chicken|murgh)/.test(t)) return "🍗";
  if (/(mutton|keema)/.test(t)) return "🥘";
  if (/(fish|prawn)/.test(t)) return "🐟";
  if (/egg/.test(t)) return "🥚";
  if (/(paneer|cheese)/.test(t)) return "🧀";
  if (/(dal|rajma|chole|sambar|rasam)/.test(t)) return "🥣";
  if (/(biryani|pulao|rice|pongal|khichdi)/.test(t)) return "🍛";
  if (/(roti|naan|paratha|puri|thepla|dosa|chilla|uttapam|pesarattu)/.test(t)) return "🫓";
  if (/(idli|vada|dhokla)/.test(t)) return "🍥";
  if (/(soup)/.test(t)) return "🍲";
  if (/(kheer|halwa|sweet)/.test(t)) return "🍮";
  if (/(samosa|pakora|vada pav|cutlet|tikka|kebab)/.test(t)) return "🥟";
  if (/(salad|chaat|bhel|sprout|fruit)/.test(t)) return "🥗";
  if (/(pav bhaji|bhaji|bhurji|masala|sabzi|poriyal|curry)/.test(t)) return "🥘";
  return "🍽️";
}

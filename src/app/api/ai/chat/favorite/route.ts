import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";

const bodySchema = z.object({
  provider_id: z.string().uuid(),
  model: z.string().trim().min(1).max(120),
  favorite: z.boolean(),
});

/**
 * Stars/unstars a model on the member's own provider row so the chat
 * model-changer can pin favorites to the top. Favorites are a subset of the
 * provider's saved catalog.
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!checkRate(`fav:${profile.id}`, 30, 5 * 60_000)) {
    return NextResponse.json({ error: rateLimited(30, 5 * 60_000) }, { status: 429 });
  }

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ai_providers")
    .select("id, model, models, favorite_models")
    .eq("id", body.data.provider_id)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return NextResponse.json({ error: "Provider not found." }, { status: 404 });

  const catalog = new Set<string>([
    ...((row.models as string[] | null) ?? []),
    String(row.model ?? ""),
  ]);
  if (!catalog.has(body.data.model)) {
    return NextResponse.json({ error: "That model is not in this provider's catalog." }, { status: 400 });
  }

  const favorites = new Set<string>((row.favorite_models as string[] | null) ?? []);
  if (body.data.favorite) favorites.add(body.data.model);
  else favorites.delete(body.data.model);

  const { error } = await supabase
    .from("ai_providers")
    .update({ favorite_models: [...favorites] })
    .eq("id", body.data.provider_id)
    .eq("user_id", profile.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, favorites: [...favorites] });
}

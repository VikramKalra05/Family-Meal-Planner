import { NextResponse } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { decryptSecret, } from "@/lib/crypto";
import { opencodeSessionHeaders } from "@/lib/ai/provider";
import { isSafePublicUrl } from "@/lib/ai/recipes";

const bodySchema = z.object({
  base_url: z
    .string()
    .trim()
    .url("Base URL must be a valid URL")
    .max(200)
    .refine((v) => /^https?:\/\//i.test(v), "Only http(s) URLs are allowed"),
  /** For editing: fall back to the stored encrypted key when the field is blank. */
  provider_id: z.string().uuid().optional(),
  api_key: z.string().trim().max(300).optional(),
});

/**
 * Fetches the OpenAI-compatible `{base_url}/models` catalog so the provider
 * forms can offer a picker instead of guessing model ids. The key is either
 * the typed one or the stored (decrypted server-side) one for edits. SSRF
 * guarded: https(s) public hosts only.
 */
export async function POST(req: Request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const body = bodySchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request" }, { status: 400 });
  }
  if (!isSafePublicUrl(body.data.base_url)) {
    return NextResponse.json({ error: "That base URL is not reachable from the server." }, { status: 400 });
  }
  if (!checkRate(`models:${user.id}`, 10, 5 * 60_000)) {
    return NextResponse.json({ error: rateLimited(10, 5 * 60_000) }, { status: 429 });
  }

  const supabase = await createClient();
  let apiKey = body.data.api_key?.trim() ?? "";
  if (!apiKey) {
    if (!body.data.provider_id) {
      return NextResponse.json({ error: "Enter the API key first, then fetch models." }, { status: 400 });
    }
    const { data: row } = await supabase
      .from("ai_providers")
      .select("api_key_encrypted")
      .eq("id", body.data.provider_id)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!row) return NextResponse.json({ error: "Provider not found." }, { status: 404 });
    try {
      apiKey = decryptSecret(row.api_key_encrypted);
    } catch {
      return NextResponse.json({ error: "Could not decrypt the stored key — enter a new key." }, { status: 400 });
    }
  }

  const base = body.data.base_url.replace(/\/+$/, "");
  try {
    const res = await fetch(`${base}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...opencodeSessionHeaders(base, crypto.randomUUID()),
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const text = (await res.text().catch(() => "")).replaceAll(apiKey, "•••");
      return NextResponse.json(
        { error: `The endpoint returned HTTP ${res.status} for /models${text ? ` — ${text.slice(0, 160)}` : ""}` },
        { status: 502 },
      );
    }
    const json = (await res.json().catch(() => null)) as
      | { data?: { id?: string; name?: string }[]; models?: ({ name?: string; id?: string } | string)[] }
      | null;
    const ids = new Set<string>();
    for (const entry of json?.data ?? []) {
      if (typeof entry?.id === "string" && entry.id.trim()) ids.add(entry.id.trim());
    }
    for (const entry of json?.models ?? []) {
      const id = typeof entry === "string" ? entry : (entry?.name ?? entry?.id);
      if (typeof id === "string" && id.trim()) ids.add(id.trim());
    }
    if (ids.size === 0) {
      return NextResponse.json(
        { error: "The endpoint returned no models — you can still type the model id manually." },
        { status: 502 },
      );
    }
    return NextResponse.json({ models: [...ids].sort((a, b) => a.localeCompare(b)).slice(0, 300) });
  } catch (e) {
    const msg = (e as Error).name === "TimeoutError" || (e as Error).name === "AbortError"
      ? "The endpoint took too long to answer /models."
      : `Could not reach ${(e as Error).message || "the endpoint"}`;
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

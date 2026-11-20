import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/profile";
import { createClient } from "@/lib/supabase/server";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import {
  listConversations,
  loadThread,
  resolveChatProvider,
  runAssistantTurn,
} from "@/lib/ai/assistant/loop";
import { resolveProvider } from "@/lib/ai/provider";
import { memberLabels } from "@/lib/ai/assistant/labels";

/** Panel bootstrap: conversations list, provider list + the active thread. */
export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }
  const requested = new URL(req.url).searchParams.get("conversation");
  const supabase = await createClient();
  const [providerRes, providersResFirst, conversations, membersRes] = await Promise.all([
    resolveProvider(),
    supabase
      .from("ai_providers")
      .select("id, label, model, models, favorite_models, is_default")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at"),
    listConversations(profile.id),
    supabase
      .from("profiles")
      .select("id, display_name")
      .eq("household_id", profile.household_id!),
  ]);
  // Migrations 0012/0013 not applied? Keep the model dropdown alive with the
  // basic columns (no catalogs) instead of an empty list.
  let providersRes = providersResFirst as { data: { id: string; label: string; model: string; is_default: boolean }[] | null; error: { message: string } | null };
  if (providersRes.error && /models|favorite_models/i.test(providersRes.error.message)) {
    providersRes = (await supabase
      .from("ai_providers")
      .select("id, label, model, is_default")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at")) as typeof providersRes;
  }
  // Alias → real name, for the member's own browser only — this mapping is
  // deliberately absent from everything sent to the AI provider.
  const labels = memberLabels(
    (membersRes.data ?? []).map((m) => ({ id: m.id, display_name: m.display_name })),
    profile.id,
  );
  const memberMap: Record<string, string> = {};
  for (const [id, label] of labels) {
    if (label === "You") continue;
    const real = (membersRes.data ?? []).find((m) => m.id === id)?.display_name;
    if (real) memberMap[label] = real;
  }
  // Active thread: the requested conversation (if owned), else the most recent.
  const activeConversationId =
    (requested && conversations.some((c) => c.id === requested) ? requested : null) ??
    conversations[0]?.id ??
    null;
  const { messages, error: historyError } = activeConversationId
    ? await loadThread(profile.id, activeConversationId)
    : { messages: [], error: null };
  return NextResponse.json({
    provider: providerRes ? { label: providerRes.label, model: providerRes.model } : null,
    providers: providersRes.data ?? [],
    memberMap,
    chatLanguage: profile.chat_language ?? null,
    conversations,
    activeConversationId,
    messages,
    historyError,
  });
}

const dataImage = z
  .string()
  .trim()
  .max(4_000_000, "That photo is too large")
  .regex(/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i, "Unsupported image format");

const askSchema = z
  .object({
    message: z.string().trim().max(1000).optional(),
    /** Compressed data URL from the assistant's photo button. */
    image: dataImage.optional(),
    /** Optional model-changer pick (ai_providers.id); default provider when omitted. */
    provider_id: z.string().uuid().optional(),
    /** Conversation to append to; omitted/null = start a new chat. */
    conversation_id: z.string().uuid().nullable().optional(),
    /** Model override (a model from the picked provider's saved catalog). */
    model: z.string().trim().min(1).max(120).optional(),
    /** App path the assistant panel is currently open on. */
    page: z.string().trim().max(200).optional(),
  })
  .refine((value) => Boolean(value.message) || Boolean(value.image), {
    message: "Type something or attach a photo",
  });

/** One assistant turn. */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }

  const body = askSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid message" }, { status: 400 });
  }

  const isPhoto = Boolean(body.data.image);
  const limit = isPhoto ? 10 : 20;
  if (!checkRate(`${isPhoto ? "chat-photo" : "chat"}:${profile.id}`, limit, 60 * 60 * 1000)) {
    return NextResponse.json({ error: rateLimited(limit, 60 * 60 * 1000) }, { status: 429 });
  }

  const provider = await resolveChatProvider(body.data.provider_id, profile, body.data.model);
  if (!provider) {
    return NextResponse.json(
      {
        error:
          body.data.provider_id
            ? "That model is no longer available — pick another in the ✨ dropdown."
            : "No AI provider configured — add one in Settings → AI Providers and Rasoi AI comes alive.",
      },
      { status: 409 },
    );
  }

  try {
    // req.signal fires when the client disconnects (Stop button aborts the
    // fetch) — the loop then cancels the LLM call and skips further steps.
    const result = await runAssistantTurn(
      body.data.message?.trim() || (body.data.image ? "Log this meal" : ""),
      profile,
      provider,
      req.signal,
      body.data.conversation_id ?? null,
      body.data.page,
      body.data.image,
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rasoi] turn failed:", e);
    return NextResponse.json({ error: "Something went wrong — try again." }, { status: 500 });
  }
}

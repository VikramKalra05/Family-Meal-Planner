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

/** Panel bootstrap: conversations list, provider list + the active thread. */
export async function GET(req: Request) {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }
  const requested = new URL(req.url).searchParams.get("conversation");
  const supabase = await createClient();
  const [providerRes, providersRes, conversations] = await Promise.all([
    resolveProvider(),
    supabase
      .from("ai_providers")
      .select("id, label, model, models, favorite_models, is_default")
      .eq("user_id", profile.id)
      .order("is_default", { ascending: false })
      .order("created_at"),
    listConversations(profile.id),
  ]);
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
    conversations,
    activeConversationId,
    messages,
    historyError,
  });
}

const askSchema = z.object({
  message: z.string().trim().min(1, "Type something first").max(1000),
  /** Optional model-changer pick (ai_providers.id); default provider when omitted. */
  provider_id: z.string().uuid().optional(),
  /** Conversation to append to; omitted/null = start a new chat. */
  conversation_id: z.string().uuid().nullable().optional(),
  /** Model override (a model from the picked provider's saved catalog). */
  model: z.string().trim().min(1).max(120).optional(),
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

  if (!checkRate(`chat:${profile.id}`, 20, 60 * 60 * 1000)) {
    return NextResponse.json({ error: rateLimited(20, 60 * 60 * 1000) }, { status: 429 });
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
      body.data.message,
      profile,
      provider,
      req.signal,
      body.data.conversation_id ?? null,
    );
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rasoi] turn failed:", e);
    return NextResponse.json({ error: "Something went wrong — try again." }, { status: 500 });
  }
}

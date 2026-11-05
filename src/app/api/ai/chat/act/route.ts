import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/profile";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { resolveChatProvider, runConfirmedAction } from "@/lib/ai/assistant/loop";
import { assistantActionSchema, isReadAction } from "@/lib/ai/assistant/schema";

const actSchema = z.object({
  action: assistantActionSchema,
  /** Chosen model (panel dropdown) — used by mutations that call the LLM (log_meal). */
  provider_id: z.string().uuid().optional(),
  /** Conversation the confirmed action belongs to (for the thread note). */
  conversation_id: z.string().uuid().nullable().optional(),
});

/**
 * Executes a confirmed mutation. The action JSON is re-validated against the
 * same whitelist schema here — the client's copy is never trusted — and read
 * actions are rejected (they never need confirmation).
 */
export async function POST(req: Request) {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }

  const body = actSchema.safeParse(await req.json().catch(() => null));
  if (!body.success) {
    return NextResponse.json({ ok: false, message: "That action is not on the assistant's whitelist." }, { status: 400 });
  }
  if (isReadAction(body.data.action)) {
    return NextResponse.json({ ok: false, message: "Read actions don't need confirmation." }, { status: 400 });
  }

  if (!checkRate(`chat-act:${profile.id}`, 30, 60 * 60 * 1000)) {
    return NextResponse.json({ ok: false, message: rateLimited(30, 60 * 60 * 1000) }, { status: 429 });
  }

  const provider = await resolveChatProvider(body.data.provider_id, profile);
  if (body.data.provider_id && !provider) {
    return NextResponse.json({ ok: false, message: "That model is no longer available — pick another in the ✨ dropdown." }, { status: 409 });
  }

  try {
    const result = await runConfirmedAction(body.data.action, profile, provider, body.data.conversation_id ?? null);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rasoi] confirmed action failed:", e);
    return NextResponse.json({ ok: false, message: "Something went wrong running that — check the app and try again." }, { status: 500 });
  }
}

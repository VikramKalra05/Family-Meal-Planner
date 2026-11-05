import { NextResponse } from "next/server";
import { z } from "zod";
import { getProfile } from "@/lib/profile";
import { checkRate, rateLimited } from "@/lib/rate-limit";
import { loadThread, runAssistantTurn } from "@/lib/ai/assistant/loop";
import { resolveProvider } from "@/lib/ai/provider";

/** Panel bootstrap: thread history + whether an AI provider is configured. */
export async function GET() {
  const profile = await getProfile();
  if (!profile?.household_id) {
    return NextResponse.json({ error: "Finish setting up your profile first." }, { status: 403 });
  }
  const provider = await resolveProvider();
  const { messages, error: historyError } = await loadThread(profile.id);
  return NextResponse.json({
    provider: provider ? { label: provider.label, model: provider.model } : null,
    messages,
    historyError,
  });
}

const askSchema = z.object({ message: z.string().trim().min(1, "Type something first").max(1000) });

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

  try {
    const result = await runAssistantTurn(body.data.message, profile);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[rasoi] turn failed:", e);
    return NextResponse.json({ error: "Something went wrong — try again." }, { status: 500 });
  }
}

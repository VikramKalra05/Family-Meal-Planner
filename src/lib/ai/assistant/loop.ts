import type { Profile } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";
import { chatJson, resolveProvider, ProviderError, type ChatMessage } from "@/lib/ai/provider";
import { buildContextSnapshot } from "./context";
import { systemMessage } from "./prompt";
import {
  chatTurnSchema,
  isReadAction,
  summarizeAction,
  type AssistantAction,
} from "./schema";
import { executeReadAction, executeMutationAction } from "./tools";

/**
 * The assistant loop. One user message → up to MAX_STEPS model calls:
 *  - read actions execute server-side and their results loop back to the
 *    model so the final reply is grounded;
 *  - the first mutation action stops everything and returns a proposal for
 *    the user to confirm (the /act route executes it after re-validation).
 *
 * The loop is stateless per request; the visible thread persists in
 * ai_chat_messages (tool chatter stays out of the stored history).
 */

const MAX_STEPS = 3;
const HISTORY_WINDOW = 30;

export interface AssistantProposal {
  action: AssistantAction;
  summary: string;
}

export interface AssistantTurnResult {
  reply: string;
  toolTrace: string[];
  proposal: AssistantProposal | null;
  error: string | null;
}

// ── Thread persistence ──────────────────────────────────────────────────────

interface StoredMessage {
  role: "user" | "assistant" | "system";
  content: string;
  meta: {
    tools?: string[];
    proposal?: { action: AssistantAction; summary: string } | null;
    kind?: string;
  } | null;
  created_at: string;
}

export async function loadThread(profileId: string): Promise<StoredMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_chat_messages")
    .select("role, content, meta, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  return ((data ?? []) as StoredMessage[]).reverse();
}

async function persistMessage(
  profileId: string,
  role: "user" | "assistant" | "system",
  content: string,
  meta?: StoredMessage["meta"],
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_chat_messages").insert({ user_id: profileId, role, content: content.slice(0, 4000), meta: meta ?? null });
}

// ── The turn ────────────────────────────────────────────────────────────────

export async function runAssistantTurn(userText: string, profile: Profile): Promise<AssistantTurnResult> {
  const provider = await resolveProvider();
  if (!provider) {
    return {
      reply: "",
      toolTrace: [],
      proposal: null,
      error: "No AI provider configured — add one in Settings → AI Providers and Rasoi AI comes alive.",
    };
  }

  await persistMessage(profile.id, "user", userText);

  const snapshot = await buildContextSnapshot(profile);
  const history = await loadThread(profile.id);
  // The just-stored user message is the last history entry; the model gets
  // system + prior history + the fresh user line.
  const priorHistory = history.slice(0, -1);
  const messages: ChatMessage[] = [
    systemMessage(profile, snapshot),
    ...priorHistory.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: userText },
  ];

  const toolTrace: string[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    let turn;
    try {
      turn = await chatJson(provider, chatTurnSchema, messages, {
        maxTokens: 1400,
        temperature: 0.3,
        feature: "assistant",
      });
    } catch (e) {
      const error =
        e instanceof ProviderError
          ? e.message
          : "Rasoi AI hit a snag thinking — try again in a moment.";
      await persistMessage(profile.id, "system", `error: ${error}`, { kind: "error" });
      return { reply: "", toolTrace, proposal: null, error };
    }

    const actions = turn.actions ?? [];
    const mutation = actions.find((a) => !isReadAction(a));

    if (mutation) {
      const proposal: AssistantProposal = { action: mutation, summary: summarizeAction(mutation) };
      await persistMessage(profile.id, "assistant", turn.reply, { tools: toolTrace, proposal });
      return { reply: turn.reply, toolTrace, proposal, error: null };
    }

    if (actions.length === 0) {
      await persistMessage(profile.id, "assistant", turn.reply, { tools: toolTrace });
      return { reply: turn.reply, toolTrace, proposal: null, error: null };
    }

    // Reads: execute all, feed results back, loop again for the final answer.
    const results = [];
    for (const readAction of actions.filter(isReadAction)) {
      const result = await executeReadAction(readAction, profile);
      toolTrace.push(result.message);
      results.push({ action: readAction.action, ok: result.ok, data: result.ok ? result.data : result.message });
    }
    messages.push({ role: "assistant", content: JSON.stringify({ reply: turn.reply, actions }) });
    messages.push({
      role: "user",
      content:
        "TOOL RESULTS (auto-executed, compact JSON — use these facts in your final answer, then reply with NO actions):\n" +
        JSON.stringify(results).slice(0, 6000),
    });
  }

  // Step budget exhausted while still requesting reads — force a final answer.
  messages.push({ role: "user", content: "Tool budget reached. Answer the user now from what you have, with NO actions." });
  try {
    const finalTurn = await chatJson(provider, chatTurnSchema, messages, {
      maxTokens: 1200,
      temperature: 0.3,
      feature: "assistant",
    });
    await persistMessage(profile.id, "assistant", finalTurn.reply, { tools: toolTrace });
    return { reply: finalTurn.reply, toolTrace, proposal: null, error: null };
  } catch {
    const reply = "I gathered the data but ran out of room to finish the answer — try asking again.";
    await persistMessage(profile.id, "assistant", reply, { tools: toolTrace });
    return { reply, toolTrace, proposal: null, error: null };
  }
}

// ── Confirmation execution (POST /api/ai/chat/act) ──────────────────────────

export async function runConfirmedAction(
  action: AssistantAction,
  profile: Profile,
): Promise<{ ok: boolean; message: string }> {
  const provider = await resolveProvider();
  const result = await executeMutationAction(action, profile, provider);
  await persistMessage(
    profile.id,
    "assistant",
    `${result.ok ? "✅" : "⚠️"} ${result.message}`,
    { kind: "confirmed", tools: [summarizeAction(action)] },
  );
  return result;
}

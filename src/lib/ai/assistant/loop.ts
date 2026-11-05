import type { Profile } from "@/lib/db-types";
import { createClient } from "@/lib/supabase/server";
import {
  chatJson,
  resolveProvider,
  ProviderError,
  type ChatMessage,
  type ResolvedProvider,
} from "@/lib/ai/provider";
import { decryptSecret } from "@/lib/crypto";
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
  /** True when the user pressed Stop mid-turn. */
  stopped?: boolean;
  /** The conversation this turn belongs to (created if it was a new chat). */
  conversationId: string | null;
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

export interface ThreadLoad {
  messages: StoredMessage[];
  /** Set when the history query itself failed (e.g. migrations missing). */
  error: string | null;
}

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
}

export async function listConversations(profileId: string): Promise<ConversationSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_chat_conversations")
    .select("id, title, created_at")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return [];
  return (data ?? []) as ConversationSummary[];
}

export async function latestConversationId(profileId: string): Promise<string | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_chat_conversations")
    .select("id")
    .eq("user_id", profileId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

export async function loadThread(profileId: string, conversationId: string): Promise<ThreadLoad> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("ai_chat_messages")
    .select("role, content, meta, created_at")
    .eq("user_id", profileId)
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_WINDOW);
  // Fail loudly: an unreadable history table must surface, never present as
  // an innocent empty thread.
  if (error) return { messages: [], error: error.message };
  return { messages: ((data ?? []) as StoredMessage[]).reverse(), error: null };
}

async function persistMessage(
  profileId: string,
  role: "user" | "assistant" | "system",
  content: string,
  meta: StoredMessage["meta"] | undefined,
  conversationId: string | null,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("ai_chat_messages").insert({
    user_id: profileId,
    role,
    content: content.slice(0, 4000),
    meta: meta ?? null,
    conversation_id: conversationId,
  });
}

/**
 * Returns a valid conversation id for the turn: validates the caller's pick
 * (ownership-checked), or opens a new conversation titled from the first
 * message when starting fresh.
 */
async function ensureConversation(
  profileId: string,
  conversationId: string | null | undefined,
  firstText: string,
): Promise<string | null> {
  const supabase = await createClient();
  if (conversationId) {
    const { data: existing } = await supabase
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("user_id", profileId)
      .maybeSingle();
    if (existing) return conversationId;
  }
  const { data: created } = await supabase
    .from("ai_chat_conversations")
    .insert({ user_id: profileId, title: firstText.slice(0, 48) })
    .select("id")
    .single();
  return created?.id ?? null;
}

/**
 * Resolves the provider a chat turn should use: the explicitly picked
 * ai_providers row (panel model-changer), or the member's default when no
 * choice was made. Ownership-checked; null means "cannot chat".
 */
export async function resolveChatProvider(
  providerId: string | undefined,
  profile: Profile,
  modelOverride?: string,
): Promise<ResolvedProvider | null> {
  if (!providerId) {
    const base = await resolveProvider();
    if (!base) return null;
    return modelOverride ? { ...base, model: modelOverride } : base;
  }
  const supabase = await createClient();
  const { data: row } = await supabase
    .from("ai_providers")
    .select("id, label, base_url, api_key_encrypted, model")
    .eq("id", providerId)
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!row) return null;
  try {
    return {
      id: row.id,
      userId: profile.id,
      label: row.label,
      baseUrl: row.base_url.replace(/\/+$/, ""),
      apiKey: decryptSecret(row.api_key_encrypted),
      model: modelOverride ?? row.model,
      source: "user",
    };
  } catch {
    // Stored key undecryptable (encryption key rotated) — no chat on it.
    return null;
  }
}

// ── The turn ────────────────────────────────────────────────────────────────

export async function runAssistantTurn(
  userText: string,
  profile: Profile,
  provider: ResolvedProvider,
  signal: AbortSignal | undefined,
  conversationId: string | null | undefined,
): Promise<AssistantTurnResult> {
  // Stop path: persist a thread note so history reflects the cancellation,
  // skip any assistant reply, and tell the client.
  const returnStopped = async (conv: string | null): Promise<AssistantTurnResult> => {
    await persistMessage(profile.id, "system", "⏹ Stopped — the partial answer was discarded.", { kind: "stopped" }, conv);
    return { reply: "", toolTrace: [], proposal: null, error: null, stopped: true, conversationId: conv };
  };

  const conversation = await ensureConversation(profile.id, conversationId, userText);
  await persistMessage(profile.id, "user", userText, undefined, conversation);

  const [snapshot, thread] = await Promise.all([
    buildContextSnapshot(profile),
    conversation ? loadThread(profile.id, conversation) : Promise.resolve({ messages: [], error: null } as ThreadLoad),
  ]);
  // The just-stored user message is the last history entry; the model gets
  // system + prior history + the fresh user line.
  const priorHistory = thread.messages.slice(0, -1);
  const messages: ChatMessage[] = [
    systemMessage(profile, snapshot),
    ...priorHistory.map((m) => ({ role: m.role, content: m.content }) as ChatMessage),
    { role: "user", content: userText },
  ];

  const toolTrace: string[] = [];

  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (signal?.aborted) return await returnStopped(conversation);
    let turn;
    try {
      turn = await chatJson(provider, chatTurnSchema, messages, {
        maxTokens: 1400,
        temperature: 0.3,
        feature: "assistant",
      });
    } catch (e) {
      if (signal?.aborted) return await returnStopped(conversation);
      const error =
        e instanceof ProviderError
          ? e.message
          : "Rasoi AI hit a snag thinking — try again in a moment.";
      await persistMessage(profile.id, "system", `error: ${error}`, { kind: "error" }, conversation);
      return { reply: "", toolTrace, proposal: null, error, conversationId: conversation };
    }

    const actions = turn.actions ?? [];
    const mutation = actions.find((a) => !isReadAction(a));

    if (mutation) {
      const proposal: AssistantProposal = { action: mutation, summary: summarizeAction(mutation) };
      await persistMessage(profile.id, "assistant", turn.reply, { tools: toolTrace, proposal }, conversation);
      return { reply: turn.reply, toolTrace, proposal, error: null, conversationId: conversation ?? null };
    }

    if (actions.length === 0) {
      await persistMessage(profile.id, "assistant", turn.reply, { tools: toolTrace }, conversation);
      return { reply: turn.reply, toolTrace, proposal: null, error: null, conversationId: conversation ?? null };
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
    if (signal?.aborted) return await returnStopped(conversation);
  }

  // Step budget exhausted while still requesting reads — force a final answer.
  if (signal?.aborted) return await returnStopped(conversation);
  messages.push({ role: "user", content: "Tool budget reached. Answer the user now from what you have, with NO actions." });
  try {
    const finalTurn = await chatJson(provider, chatTurnSchema, messages, {
      maxTokens: 1200,
      temperature: 0.3,
      feature: "assistant",
    });
    await persistMessage(profile.id, "assistant", finalTurn.reply, { tools: toolTrace }, conversation);
    return { reply: finalTurn.reply, toolTrace, proposal: null, error: null, conversationId: conversation ?? null };
  } catch {
    if (signal?.aborted) return await returnStopped(conversation);
    const reply = "I gathered the data but ran out of room to finish the answer — try asking again.";
    await persistMessage(profile.id, "assistant", reply, { tools: toolTrace }, conversation);
    return { reply, toolTrace, proposal: null, error: null, conversationId: conversation };
  }
}

// ── Confirmation execution (POST /api/ai/chat/act) ──────────────────────────

export async function runConfirmedAction(
  action: AssistantAction,
  profile: Profile,
  provider: ResolvedProvider | null,
  conversationId: string | null | undefined,
): Promise<{ ok: boolean; message: string }> {
  const result = await executeMutationAction(action, profile, provider);
  let conversation = conversationId ?? null;
  if (conversation) {
    const supabase = await createClient();
    const { data: owned } = await supabase
      .from("ai_chat_conversations")
      .select("id")
      .eq("id", conversation)
      .eq("user_id", profile.id)
      .maybeSingle();
    if (!owned) conversation = null;
  }
  await persistMessage(
    profile.id,
    "assistant",
    `${result.ok ? "✅" : "⚠️"} ${result.message}`,
    { kind: "confirmed", tools: [summarizeAction(action)] },
    conversation,
  );
  return result;
}

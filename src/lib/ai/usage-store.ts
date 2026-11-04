import { createClient } from "@/lib/supabase/server";
import { estimateCostUsd } from "./pricing";
import type { TokenUsage } from "./tokens";

export interface AiUsageContext {
  userId: string | null;
  providerId: string | null;
  providerLabel: string;
  model: string;
  feature: string;
  baseUrl?: string;
  /** Local/demo endpoint with no marginal cost to the user. */
  free?: boolean;
}

let warned = false;

/**
 * Appends one call to the AI usage ledger. Never throws into the AI path: a
 * missing migration or transient DB error must not turn a successful model
 * response into a failed user action.
 */
export async function recordAiUsage(ctx: AiUsageContext, usage: TokenUsage): Promise<void> {
  if (!ctx.userId) return;
  try {
    const supabase = await createClient();
    const cost = estimateCostUsd(ctx.model, usage.promptTokens, usage.completionTokens, {
      reportedCostUsd: usage.reportedCostUsd,
      free: ctx.free,
      baseUrl: ctx.baseUrl,
    });
    const { error } = await supabase.from("ai_usage_events").insert({
      user_id: ctx.userId,
      provider_id: ctx.providerId,
      provider_label: ctx.providerLabel,
      model: ctx.model,
      feature: ctx.feature,
      prompt_tokens: usage.promptTokens,
      completion_tokens: usage.completionTokens,
      reasoning_tokens: usage.reasoningTokens > 0 ? usage.reasoningTokens : null,
      total_tokens: usage.totalTokens,
      estimated: usage.estimated,
      cost_usd: cost == null ? null : Number(cost.toFixed(8)),
    });
    if (error && !warned) {
      warned = true;
      console.warn(
        `[ai-usage] could not record usage (${error.message}). ` +
          "Apply supabase/migrations/0009_ai_usage.sql to enable the usage ledger.",
      );
    }
  } catch (e) {
    if (!warned) {
      warned = true;
      console.warn("[ai-usage] usage recording failed:", e);
    }
  }
}

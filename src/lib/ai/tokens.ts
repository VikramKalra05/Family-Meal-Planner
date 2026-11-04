/**
 * Token accounting for any OpenAI-compatible response. Providers disagree on
 * field names and several gateways omit `usage` entirely, so this normalizes
 * what is available and falls back to a clearly-marked character estimate.
 */

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  reasoningTokens: number;
  totalTokens: number;
  /** True when the provider did not return usage and we estimated. */
  estimated: boolean;
  /** Provider-reported cost (OpenRouter and some gateways); USD. */
  reportedCostUsd: number | null;
}

export interface UsageMessage {
  content: string;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

/** Rough tokenizer-free estimate: ~4 characters per token. */
export function approxTokens(text: string): number {
  return Math.max(0, Math.ceil(text.length / 4));
}

export function normalizeUsage(
  raw: unknown,
  messages: UsageMessage[],
  completion: string,
): TokenUsage {
  const usage = asRecord(raw);
  const completionDetails = asRecord(usage?.completion_tokens_details);

  const promptRaw =
    asFiniteNumber(usage?.prompt_tokens) ?? asFiniteNumber(usage?.input_tokens) ?? null;
  const completionRaw =
    asFiniteNumber(usage?.completion_tokens) ?? asFiniteNumber(usage?.output_tokens) ?? null;
  const reasoningRaw =
    asFiniteNumber(usage?.reasoning_tokens) ??
    asFiniteNumber(completionDetails?.reasoning_tokens) ??
    asFiniteNumber(usage?.reasoning_output_tokens) ??
    0;
  const reportedCost =
    asFiniteNumber(usage?.cost) ??
    asFiniteNumber(usage?.total_cost) ??
    asFiniteNumber(usage?.cost_details && asRecord(usage.cost_details)?.upstream_inference_cost) ??
    null;

  // If the provider gave no token counts at all, estimate and mark it.
  if (promptRaw == null && completionRaw == null) {
    const prompt = messages.reduce((sum, m) => sum + approxTokens(m.content), 0);
    const completionTokens = approxTokens(completion);
    return {
      promptTokens: prompt,
      completionTokens,
      reasoningTokens: Math.max(0, Math.round(reasoningRaw ?? 0)),
      totalTokens: prompt + completionTokens,
      estimated: true,
      reportedCostUsd: reportedCost,
    };
  }

  const promptTokens = Math.max(0, Math.round(promptRaw ?? 0));
  const completionTokens = Math.max(0, Math.round(completionRaw ?? 0));
  const totalRaw = asFiniteNumber(usage?.total_tokens);
  return {
    promptTokens,
    completionTokens,
    reasoningTokens: Math.max(0, Math.round(reasoningRaw ?? 0)),
    totalTokens: totalRaw != null ? Math.max(0, Math.round(totalRaw)) : promptTokens + completionTokens,
    estimated: false,
    reportedCostUsd: reportedCost,
  };
}

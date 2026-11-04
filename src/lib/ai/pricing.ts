/**
 * Approximate list prices in USD per 1M tokens. This is a bring-your-own-key
 * app, so pricing is informational: OpenRouter-style providers that return a
 * real `usage.cost` always win over this table, and unknown models show "—"
 * instead of inventing a number. Update prices here when providers change them.
 */

interface ModelPrice {
  pattern: RegExp;
  inputPerMTok: number;
  outputPerMTok: number;
}

const USD_TO_INR = 88;

const PRICES: ModelPrice[] = [
  // Local / free
  { pattern: /(^|[/:])ollama|local|llama\.?cpp|lmstudio/i, inputPerMTok: 0, outputPerMTok: 0 },
  { pattern: /:free$/i, inputPerMTok: 0, outputPerMTok: 0 },

  // Google Gemini (specific first)
  { pattern: /gemini.*flash.*lite/i, inputPerMTok: 0.075, outputPerMTok: 0.3 },
  { pattern: /gemini.*2\.5.*flash/i, inputPerMTok: 0.3, outputPerMTok: 2.5 },
  { pattern: /gemini.*2\.5.*pro/i, inputPerMTok: 1.25, outputPerMTok: 10 },
  { pattern: /gemini.*2\.0.*flash/i, inputPerMTok: 0.1, outputPerMTok: 0.4 },
  { pattern: /gemini.*1\.5.*flash/i, inputPerMTok: 0.075, outputPerMTok: 0.3 },
  { pattern: /gemini.*1\.5.*pro/i, inputPerMTok: 1.25, outputPerMTok: 5 },

  // Anthropic Claude
  { pattern: /claude.*(sonnet.*4|4.*sonnet)/i, inputPerMTok: 3, outputPerMTok: 15 },
  { pattern: /claude.*3[.-]5.*sonnet/i, inputPerMTok: 3, outputPerMTok: 15 },
  { pattern: /claude.*3[.-]5.*haiku/i, inputPerMTok: 0.8, outputPerMTok: 4 },
  { pattern: /claude.*3.*opus/i, inputPerMTok: 15, outputPerMTok: 75 },
  { pattern: /claude.*3.*haiku/i, inputPerMTok: 0.25, outputPerMTok: 1.25 },

  // OpenAI
  { pattern: /gpt-4o-mini/i, inputPerMTok: 0.15, outputPerMTok: 0.6 },
  { pattern: /gpt-4o(?!-mini)/i, inputPerMTok: 2.5, outputPerMTok: 10 },
  { pattern: /gpt-4\.1-mini/i, inputPerMTok: 0.4, outputPerMTok: 1.6 },
  { pattern: /gpt-4\.1-nano/i, inputPerMTok: 0.1, outputPerMTok: 0.4 },
  { pattern: /gpt-4\.1(?!-)/i, inputPerMTok: 2, outputPerMTok: 8 },
  { pattern: /o4-mini|o3-mini|o1-mini/i, inputPerMTok: 1.1, outputPerMTok: 4.4 },
  { pattern: /^o3(?!-)/i, inputPerMTok: 2, outputPerMTok: 8 },
  { pattern: /^o1(?!-)/i, inputPerMTok: 15, outputPerMTok: 60 },

  // Z.ai GLM
  { pattern: /glm-4\.6/i, inputPerMTok: 0.6, outputPerMTok: 2.2 },
  { pattern: /glm-4\.5-air/i, inputPerMTok: 0.2, outputPerMTok: 1.1 },
  { pattern: /glm-4\.5/i, inputPerMTok: 0.6, outputPerMTok: 2.2 },
  { pattern: /glm-4-flash|glm-4\.5-flash/i, inputPerMTok: 0, outputPerMTok: 0 },

  // DeepSeek
  { pattern: /deepseek-reasoner/i, inputPerMTok: 0.55, outputPerMTok: 2.19 },
  { pattern: /deepseek-chat/i, inputPerMTok: 0.27, outputPerMTok: 1.1 },

  // Groq / Meta
  { pattern: /llama-3\.3-70b/i, inputPerMTok: 0.59, outputPerMTok: 0.79 },
  { pattern: /llama-3\.1-8b/i, inputPerMTok: 0.05, outputPerMTok: 0.08 },
  { pattern: /qwen3-32b/i, inputPerMTok: 0.29, outputPerMTok: 0.59 },
];

export function priceForModel(model: string): { inputPerMTok: number; outputPerMTok: number } | null {
  const match = PRICES.find((p) => p.pattern.test(model));
  return match ? { inputPerMTok: match.inputPerMTok, outputPerMTok: match.outputPerMTok } : null;
}

export interface CostOptions {
  /** Provider-reported USD cost (e.g. OpenRouter `usage.cost`). */
  reportedCostUsd?: number | null;
  /** Local endpoint or demo provider — no marginal cost to the user. */
  free?: boolean;
  baseUrl?: string;
}

/** USD cost for one call, or null when the model has no known price. */
export function estimateCostUsd(
  model: string,
  promptTokens: number,
  completionTokens: number,
  opts: CostOptions = {},
): number | null {
  if (opts.reportedCostUsd != null && Number.isFinite(opts.reportedCostUsd) && opts.reportedCostUsd >= 0) {
    return opts.reportedCostUsd;
  }
  if (opts.free) return 0;
  if (opts.baseUrl && /(^https?:\/\/)?(localhost|127\.0\.0\.1|0\.0\.0\.0)(:|\/|$)/i.test(opts.baseUrl)) {
    return 0;
  }
  const price = priceForModel(model);
  if (!price) return null;
  return (
    (promptTokens / 1_000_000) * price.inputPerMTok +
    (completionTokens / 1_000_000) * price.outputPerMTok
  );
}

export function formatUsd(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value === 0) return "$0.00";
  if (value < 0.01) return `$${value.toFixed(6)}`;
  if (value < 1) return `$${value.toFixed(4)}`;
  return `$${value.toFixed(2)}`;
}

export function formatInrApprox(valueUsd: number | null): string {
  if (valueUsd == null || !Number.isFinite(valueUsd)) return "—";
  const inr = valueUsd * USD_TO_INR;
  if (inr === 0) return "₹0";
  if (inr < 1) return `₹${inr.toFixed(2)}`;
  return `₹${inr.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export function formatTokens(value: number): string {
  return Math.round(value).toLocaleString("en-IN");
}

export const PRICING_NOTE =
  "Costs are estimates from public list prices (1M-token rates), not your provider invoice. OpenRouter-reported costs and local/free endpoints are used as-is.";

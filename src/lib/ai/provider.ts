import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getUser } from "@/lib/profile";
import { decryptSecret } from "@/lib/crypto";
import { normalizeUsage } from "./tokens";
import { recordAiUsage } from "./usage-store";

export interface ResolvedProvider {
  /** ai_providers.id; null for the env demo provider. */
  id: string | null;
  /** Owner of the provider row (and of the usage ledger rows). */
  userId: string | null;
  label: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  source: "user" | "env-demo";
}

const providerRowSchema = z.object({
  id: z.string().uuid(),
  label: z.string(),
  base_url: z.string(),
  api_key_encrypted: z.string(),
  model: z.string(),
  is_default: z.boolean(),
});

/**
 * Resolves the caller's active LLM provider: their default row (key
 * decrypted server-side only), else the env-configured demo provider, else
 * null — callers surface a "configure a provider in Settings" message.
 */
export async function resolveProvider(): Promise<ResolvedProvider | null> {
  const supabase = await createClient();
  const user = await getUser();
  if (user) {
    const { data: rows } = await supabase
      .from("ai_providers")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at");
    const parsed = z.array(providerRowSchema).safeParse(rows);
    if (parsed.success && parsed.data.length > 0) {
      const row = parsed.data[0];
      try {
        return {
          id: row.id,
          userId: user.id,
          label: row.label,
          baseUrl: row.base_url.replace(/\/+$/, ""),
          apiKey: decryptSecret(row.api_key_encrypted),
          model: row.model,
          source: "user",
        };
      } catch {
        // Decryption failed (e.g. key rotated) — fall through to demo.
      }
    }
  }

  const demoUrl = process.env.DEMO_LLM_BASE_URL;
  const demoKey = process.env.DEMO_LLM_API_KEY;
  const demoModel = process.env.DEMO_LLM_MODEL;
  if (demoUrl && demoKey && demoModel) {
    return {
      id: null,
      userId: user?.id ?? null,
      label: "Demo provider",
      baseUrl: demoUrl.replace(/\/+$/, ""),
      apiKey: demoKey,
      model: demoModel,
      source: "env-demo",
    };
  }
  return null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No AI provider configured — add one in Settings → AI Providers.");
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/**
 * OpenCode (zen/go endpoints) routes requests by session and rejects with
 * MissingSessionID when `x-opencode-session` is absent. Any stable
 * per-conversation id satisfies it — we use the provider row id so a
 * member's calls route consistently. No-op for every other provider.
 */
export function opencodeSessionHeaders(baseUrl: string, sessionId: string): Record<string, string> {
  return /opencode\.ai/i.test(baseUrl) ? { "x-opencode-session": sessionId } : {};
}

/**
 * One chat completion against any OpenAI-compatible endpoint
 * (Z.ai GLM, OpenAI, Gemini, Groq, OpenRouter, Ollama…). When `json` is set,
 * the response is coerced to an object with fence-stripping so providers
 * without native JSON mode still work.
 */
export async function chatComplete(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number; feature?: string; signal?: AbortSignal } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  // External stop (assistant Stop button / client disconnect) joins the same
  // controller, so the in-flight LLM fetch actually cancels.
  const onExternalAbort = () => controller.abort();
  opts.signal?.addEventListener("abort", onExternalAbort);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
        ...opencodeSessionHeaders(provider.baseUrl, provider.id ?? `fmp-demo-${provider.model}`),
      },
      body: JSON.stringify({
        model: provider.model,
        messages,
        temperature: opts.temperature ?? 0.4,
        max_tokens: opts.maxTokens ?? 2000,
        ...(opts.json ? { response_format: { type: "json_object" } } : {}),
      }),
    });

    if (!res.ok) {
      // Never echo the key back, even if the provider echoes headers.
      const body = (await res.text().catch(() => "")).replaceAll(provider.apiKey, "•••");
      if (res.status === 401 || res.status === 403) {
        throw new ProviderError(`Provider rejected the API key (${res.status}). Check it in Settings.`);
      }
      if (res.status === 429) {
        throw new ProviderError("Provider rate limit hit — try again in a moment.");
      }
      // Some OpenAI-compatible endpoints reject response_format entirely —
      // retry the same request without it before giving up.
      if (res.status === 400 && opts.json && body.includes("response_format")) {
        return chatComplete(provider, messages, { ...opts, json: false });
      }
      throw new ProviderError(`Provider error ${res.status}: ${body.slice(0, 300)}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string | { text?: string }[] } }[];
      usage?: unknown;
    };
    const raw = data.choices?.[0]?.message?.content;
    // Some gateways return content as an array of parts — normalize to text.
    const content =
      typeof raw === "string"
        ? raw
        : Array.isArray(raw)
          ? raw.map((part) => part?.text ?? "").join("")
          : undefined;
    if (!content) throw new ProviderError("Provider returned an empty completion.");

    // Every feature call lands in the usage ledger; a failed insert is logged
    // but never breaks the model response.
    await recordAiUsage(
      {
        userId: provider.userId,
        providerId: provider.id,
        providerLabel: provider.label,
        model: provider.model,
        feature: opts.feature ?? "chat",
        baseUrl: provider.baseUrl,
        free: provider.source === "env-demo",
      },
      normalizeUsage(data.usage, messages, content),
    );

    return content;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === "AbortError") {
      // External stop: rethrow so the assistant loop can treat it as
      // "stopped" (distinct from our own 60s timeout).
      if (opts.signal?.aborted) throw e;
      throw new ProviderError("Provider timed out after 60s.");
    }
    throw new ProviderError(`Could not reach ${provider.label}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timeout);
    opts.signal?.removeEventListener("abort", onExternalAbort);
  }
}

/** Extracts the first JSON object from a completion, tolerating code fences and prose. */
export function parseJsonLoose(raw: string): unknown {
  const cleaned = raw
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    // Fall back to the first balanced {...} block.
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new ProviderError("The AI response was not valid JSON — try again.");
  }
}

/** Thrown when the completion matches `rejectIf` — an honest refusal (e.g. the model says it can't extract a recipe). */
export class ProviderRejectedError extends Error {
  constructor(message: string) {
    super(message);
  }
}

/** chatComplete + loose JSON parse in one step. */
export async function chatJson<T>(
  provider: ResolvedProvider,
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts: {
    maxTokens?: number;
    temperature?: number;
    /** Ledger label, e.g. "meal_log" or "reel_draft". */
    feature?: string;
    /** External stop — forwarded to every underlying completion call. */
    signal?: AbortSignal;
    /** If the parsed JSON matches, throw ProviderRejectedError instead of coercing it into the schema. */
    rejectIf?: (data: unknown) => boolean;
    rejectMessage?: string;
  } = {},
): Promise<T> {
  const raw = await chatComplete(provider, messages, { json: true, ...opts });
  const parsed = schema.safeParse(parseJsonLoose(raw));
  if (parsed.success) {
    if (opts.rejectIf?.(parsed.data)) throw new ProviderRejectedError(opts.rejectMessage ?? "Rejected");
    return parsed.data;
  }

  // The model may have answered with a deliberate refusal object rather than
  // the schema — check BEFORE asking it to "fix" the shape, which would push
  // it into inventing content.
  try {
    const loose = parseJsonLoose(raw);
    if (opts.rejectIf?.(loose)) throw new ProviderRejectedError(opts.rejectMessage ?? "Rejected");
  } catch (e) {
    if (e instanceof ProviderRejectedError) throw e;
    // not JSON at all — fall through to the corrective retry below
  }

  // One retry with the validation error fed back — cheap and usually enough.
  if (opts.signal?.aborted) throw Object.assign(new Error("Request aborted"), { name: "AbortError" });
  const retryRaw = await chatComplete(
    provider,
    [
      ...messages,
      { role: "assistant", content: raw },
      {
        role: "user",
        content: `Your JSON did not match the required schema: ${parsed.error.issues
          .slice(0, 5)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; ")}. Return corrected JSON only.`,
      },
    ],
    { json: true, ...opts },
  );
  const retryParsed = parseJsonLoose(retryRaw);
  if (opts.rejectIf?.(retryParsed)) throw new ProviderRejectedError(opts.rejectMessage ?? "Rejected");
  const retry = schema.safeParse(retryParsed);
  if (retry.success) return retry.data;
  throw new ProviderError("The AI kept returning malformed data — try a different model in Settings.");
}

/** Minimal live check used by Settings → "Test connection". */
export async function testProviderCreds(
  baseUrl: string,
  apiKey: string,
  model: string,
  usageCtx?: {
    userId: string | null;
    providerId: string | null;
    providerLabel: string;
    feature?: string;
  },
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const started = Date.now();
  const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
  const TIMEOUT_MS = 30_000;

  // Slow/garbage errors that a single fresh attempt often clears (cold-start
  // gateways, sleepy serverless endpoints) — retry once before giving up.
  const slow = (err: Error) => err.name === "AbortError" || err.name === "TimeoutError";

  // OpenCode needs a routing session even for tests; the provider row id is
  // the stable choice when known, otherwise a one-off id for this test.
  const sessionHeaders = opencodeSessionHeaders(endpoint, usageCtx?.providerId ?? crypto.randomUUID());
  async function attempt(body: Record<string, unknown>): Promise<Response> {
    return fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, ...sessionHeaders },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  }

  try {
    let res: Response;
    try {
      res = await attempt({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 16 });
    } catch (err) {
      if (!slow(err as Error)) throw err;
      res = await attempt({ model, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 16 });
    }

    if (!res.ok) {
      const body = (await res.text().catch(() => "")).replaceAll(apiKey, "•••");
      // Reasoning models reject max_tokens (they use max_completion_tokens) —
      // retry once without any token cap before declaring the provider broken.
      if (res.status === 400 && body.includes("max_tokens")) {
        const retry = await attempt({ model, messages: [{ role: "user", content: "ok" }] });
        if (retry.ok) return { ok: true, latencyMs: Date.now() - started };
        return { ok: false, error: `HTTP ${retry.status} — model rejected the test call` };
      }
      if (res.status === 404) {
        return { ok: false, error: `HTTP 404 — the model id "${model}" was not found on this endpoint. ${body.slice(0, 140)}` };
      }
      return { ok: false, error: `HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}` };
    }
    const data = (await res.json()) as { choices?: unknown[]; usage?: unknown };
    if (!data.choices?.length) return { ok: false, error: "Unexpected response shape" };
    if (usageCtx) {
      await recordAiUsage(
        {
          userId: usageCtx.userId,
          providerId: usageCtx.providerId,
          providerLabel: usageCtx.providerLabel,
          model,
          feature: usageCtx.feature ?? "provider_test",
          baseUrl,
        },
        normalizeUsage(data.usage, [{ content: "ok" }], "ok"),
      );
    }
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    const err = e as Error;
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return {
        ok: false,
        error: `No response within ${TIMEOUT_MS / 1000}s (tried twice). The endpoint may be slow or the model id may be wrong — try again, and double-check the model in Settings.`,
      };
    }
    return { ok: false, error: err.message };
  }
}

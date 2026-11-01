import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/crypto";

export interface ResolvedProvider {
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
  const {
    data: { user },
  } = await supabase.auth.getUser();
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
    return { label: "Demo provider", baseUrl: demoUrl.replace(/\/+$/, ""), apiKey: demoKey, model: demoModel, source: "env-demo" };
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
 * One chat completion against any OpenAI-compatible endpoint
 * (Z.ai GLM, OpenAI, Gemini, Groq, OpenRouter, Ollama…). When `json` is set,
 * the response is coerced to an object with fence-stripping so providers
 * without native JSON mode still work.
 */
export async function chatComplete(
  provider: ResolvedProvider,
  messages: ChatMessage[],
  opts: { json?: boolean; maxTokens?: number; temperature?: number } = {},
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const res = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${provider.apiKey}`,
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
    return content;
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    if ((e as Error).name === "AbortError") {
      throw new ProviderError("Provider timed out after 60s.");
    }
    throw new ProviderError(`Could not reach ${provider.label}: ${(e as Error).message}`);
  } finally {
    clearTimeout(timeout);
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

/** chatComplete + loose JSON parse in one step. */
export async function chatJson<T>(
  provider: ResolvedProvider,
  schema: z.ZodType<T>,
  messages: ChatMessage[],
  opts: { maxTokens?: number; temperature?: number } = {},
): Promise<T> {
  const raw = await chatComplete(provider, messages, { json: true, ...opts });
  const parsed = schema.safeParse(parseJsonLoose(raw));
  if (parsed.success) return parsed.data;

  // One retry with the validation error fed back — cheap and usually enough.
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
  const retry = schema.safeParse(parseJsonLoose(retryRaw));
  if (retry.success) return retry.data;
  throw new ProviderError("The AI kept returning malformed data — try a different model in Settings.");
}

/** Minimal live check used by Settings → "Test connection". */
export async function testProviderCreds(
  baseUrl: string,
  apiKey: string,
  model: string,
): Promise<{ ok: true; latencyMs: number } | { ok: false; error: string }> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with the single word: ok" }],
        max_tokens: 16,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).replaceAll(apiKey, "•••");
      // Reasoning models reject max_tokens (they use max_completion_tokens) —
      // retry once without any token cap before declaring the provider broken.
      if (res.status === 400 && body.includes("max_tokens")) {
        const retry = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "ok" }] }),
          signal: AbortSignal.timeout(20_000),
        });
        if (retry.ok) return { ok: true, latencyMs: Date.now() - started };
        return { ok: false, error: `HTTP ${retry.status} — model rejected the test call` };
      }
      return { ok: false, error: `HTTP ${res.status}${body ? ` — ${body.slice(0, 160)}` : ""}` };
    }
    const data = (await res.json()) as { choices?: unknown[] };
    if (!data.choices?.length) return { ok: false, error: "Unexpected response shape" };
    return { ok: true, latencyMs: Date.now() - started };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

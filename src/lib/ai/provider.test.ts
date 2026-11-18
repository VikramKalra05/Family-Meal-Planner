import { afterEach, describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret, maskKey } from "@/lib/crypto";
import {
  chatComplete,
  parseJsonLoose,
  ProviderError,
  type ResolvedProvider,
} from "@/lib/ai/provider";

describe("crypto (AES-256-GCM)", () => {
  it("round-trips a key", () => {
    const secret = "sk-test-abc123XYZ-do-not-share";
    expect(decryptSecret(encryptSecret(secret))).toBe(secret);
  });

  it("produces different ciphertexts per call (random IV)", () => {
    expect(encryptSecret("same")).not.toBe(encryptSecret("same"));
  });

  it("rejects tampered payloads", () => {
    const payload = encryptSecret("secret");
    const [iv, tag] = payload.split(":");
    const tampered = `${iv}:${tag}:${Buffer.from("tampered").toString("base64")}`;
    expect(() => decryptSecret(tampered)).toThrow();
  });

  it("masks keys for display", () => {
    expect(maskKey("sk-1234567890abcdefgh")).toBe("sk-1••••efgh");
    expect(maskKey("short")).toBe("••••••••");
  });
});

describe("parseJsonLoose", () => {
  it("parses plain JSON", () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it("strips markdown code fences", () => {
    expect(parseJsonLoose('```json\n{"a": 1}\n```')).toEqual({ a: 1 });
  });

  it("extracts the JSON object from surrounding prose", () => {
    expect(parseJsonLoose('Here you go:\n{"title":"Dal", "servings": 3}\nHope this helps!')).toEqual({
      title: "Dal",
      servings: 3,
    });
  });

  it("throws a friendly error when nothing parses", () => {
    expect(() => parseJsonLoose("no json here at all")).toThrow(/not valid JSON/);
  });
});

describe("chatComplete — reasoning-model truncation", () => {
  // userId null keeps the usage ledger out of the test path entirely.
  const provider: ResolvedProvider = {
    id: null,
    userId: null,
    label: "Test provider",
    baseUrl: "https://llm.example.com/v1",
    apiKey: "sk-test",
    model: "reasoning-model",
    source: "user",
  };

  const respond = (body: unknown) =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  afterEach(() => vi.unstubAllGlobals());

  it("retries once with double the budget when reasoning exhausts max_tokens", async () => {
    const bodies: Record<string, unknown>[] = [];
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      bodies.push(JSON.parse(String(init.body)));
      if (bodies.length === 1) {
        return respond({
          choices: [{ message: { content: "", reasoning_content: "thinking…" }, finish_reason: "length" }],
          usage: { prompt_tokens: 12, completion_tokens: 900, total_tokens: 912 },
        });
      }
      return respond({ choices: [{ message: { content: '{"ok":true}' }, finish_reason: "stop" }] });
    });
    vi.stubGlobal("fetch", fetchMock);

    const out = await chatComplete(provider, [{ role: "user", content: "hi" }], { maxTokens: 900 });

    expect(out).toBe('{"ok":true}');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(bodies[0].max_tokens).toBe(900);
    expect(bodies[1].max_tokens).toBe(1800);
  });

  it("throws an actionable error when the doubled retry also truncates", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond({ choices: [{ message: { content: "" }, finish_reason: "length" }] }),
      ),
    );

    await expect(chatComplete(provider, [{ role: "user", content: "hi" }], { maxTokens: 500 })).rejects.toThrow(
      /ran out of tokens/,
    );
  });

  it("still reports a genuinely empty completion", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => respond({ choices: [{ message: { content: "" }, finish_reason: "stop" }] })),
    );

    await expect(chatComplete(provider, [{ role: "user", content: "hi" }], { maxTokens: 500 })).rejects.toBeInstanceOf(
      ProviderError,
    );
  });
});

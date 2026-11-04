import { describe, expect, it } from "vitest";
import { normalizeUsage } from "./tokens";

describe("normalizeUsage", () => {
  it("uses provider-reported tokens, reasoning and reported cost", () => {
    const usage = normalizeUsage(
      {
        prompt_tokens: 120,
        completion_tokens: 80,
        total_tokens: 200,
        completion_tokens_details: { reasoning_tokens: 30 },
        cost: 0.0012,
      },
      [{ content: "hello" }],
      "world",
    );
    expect(usage).toEqual({
      promptTokens: 120,
      completionTokens: 80,
      reasoningTokens: 30,
      totalTokens: 200,
      estimated: false,
      reportedCostUsd: 0.0012,
    });
  });

  it("accepts input_tokens/output_tokens from Anthropic-style gateways", () => {
    const usage = normalizeUsage({ input_tokens: 40, output_tokens: 10 }, [], "");
    expect(usage.promptTokens).toBe(40);
    expect(usage.completionTokens).toBe(10);
    expect(usage.totalTokens).toBe(50);
    expect(usage.estimated).toBe(false);
  });

  it("estimates and marks the row when the provider omits usage", () => {
    const usage = normalizeUsage(undefined, [{ content: "a".repeat(400) }], "b".repeat(80));
    expect(usage.estimated).toBe(true);
    expect(usage.promptTokens).toBe(100);
    expect(usage.completionTokens).toBe(20);
    expect(usage.totalTokens).toBe(120);
    expect(usage.reportedCostUsd).toBeNull();
  });

  it("fills a missing side of usage from zero rather than estimating", () => {
    const usage = normalizeUsage({ prompt_tokens: 25 }, [{ content: "a".repeat(400) }], "ok");
    expect(usage.promptTokens).toBe(25);
    expect(usage.completionTokens).toBe(0);
    expect(usage.estimated).toBe(false);
  });
});

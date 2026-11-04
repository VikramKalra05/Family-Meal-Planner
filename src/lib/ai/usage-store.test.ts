import { beforeEach, describe, expect, it, vi } from "vitest";

const { insert } = vi.hoisted(() => ({ insert: vi.fn() }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    from: () => ({ insert }),
  }),
}));

import { recordAiUsage } from "./usage-store";

const context = {
  userId: "11111111-1111-4111-8111-111111111111",
  providerId: "22222222-2222-4222-8222-222222222222",
  providerLabel: "Google Gemini",
  model: "gpt-4o-mini",
  feature: "meal_log",
};

const usage = {
  promptTokens: 1_000_000,
  completionTokens: 1_000_000,
  reasoningTokens: 0,
  totalTokens: 2_000_000,
  estimated: false,
  reportedCostUsd: null,
};

describe("recordAiUsage", () => {
  beforeEach(() => {
    insert.mockReset();
    insert.mockResolvedValue({ error: null });
  });

  it("writes tokens, provider identity and the computed cost", async () => {
    await recordAiUsage(context, usage);
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: context.userId,
        provider_id: context.providerId,
        provider_label: "Google Gemini",
        model: "gpt-4o-mini",
        feature: "meal_log",
        prompt_tokens: 1_000_000,
        completion_tokens: 1_000_000,
        total_tokens: 2_000_000,
        estimated: false,
        cost_usd: 0.75,
      }),
    );
  });

  it("does not throw if the ledger migration has not been applied", async () => {
    insert.mockResolvedValueOnce({ error: { message: "relation does not exist" } });
    await expect(recordAiUsage(context, usage)).resolves.toBeUndefined();
  });

  it("skips unsigned/demo calls with no user", async () => {
    await recordAiUsage({ ...context, userId: null }, usage);
    expect(insert).not.toHaveBeenCalled();
  });
});

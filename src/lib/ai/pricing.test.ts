import { describe, expect, it } from "vitest";
import {
  estimateCostUsd,
  formatInrApprox,
  formatUsd,
  priceForModel,
} from "./pricing";

describe("priceForModel", () => {
  it("matches common models case-insensitively", () => {
    expect(priceForModel("gpt-4o-mini")).toEqual({ inputPerMTok: 0.15, outputPerMTok: 0.6 });
    expect(priceForModel("gemini-3.5-flash-lite")).toEqual({ inputPerMTok: 0.075, outputPerMTok: 0.3 });
    expect(priceForModel("glm-4.6")).toEqual({ inputPerMTok: 0.6, outputPerMTok: 2.2 });
    expect(priceForModel("openrouter/auto")).toBeNull();
  });
});

describe("estimateCostUsd", () => {
  it("calculates from per-million list prices", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1_000_000, 1_000_000)).toBeCloseTo(0.75, 6);
  });

  it("prefers a provider-reported cost", () => {
    expect(estimateCostUsd("gpt-4o-mini", 1000, 1000, { reportedCostUsd: 0.0042 })).toBe(0.0042);
  });

  it("treats local endpoints and demo calls as free", () => {
    expect(estimateCostUsd("llama3.2", 1000, 1000, { baseUrl: "http://localhost:11434/v1" })).toBe(0);
    expect(estimateCostUsd("unknown-model", 1000, 1000, { free: true })).toBe(0);
  });

  it("returns null for an unknown paid model", () => {
    expect(estimateCostUsd("some-future-model", 1000, 1000)).toBeNull();
  });
});

describe("formatting", () => {
  it("keeps tiny costs visible", () => {
    expect(formatUsd(0.0000421)).toBe("$0.000042");
    expect(formatUsd(null)).toBe("—");
    expect(formatUsd(0)).toBe("$0.00");
  });

  it("shows an approximate rupee value", () => {
    expect(formatInrApprox(1)).toBe("₹88");
    expect(formatInrApprox(null)).toBe("—");
  });
});

import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, maskKey } from "@/lib/crypto";
import { parseJsonLoose } from "@/lib/ai/provider";

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

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isAllowedAiBaseUrl,
  isAllowedPushEndpoint,
  isPrivateHostname,
  isSafePublicUrl,
} from "./security";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isPrivateHostname", () => {
  it("blocks loopback, private, link-local and CGNAT IPv4", () => {
    for (const host of [
      "localhost",
      "127.0.0.1",
      "10.0.0.5",
      "172.16.4.2",
      "172.31.255.254",
      "192.168.1.10",
      "169.254.169.254",
      "100.64.0.1",
      "100.127.255.255",
      "0.0.0.0",
    ]) {
      expect(isPrivateHostname(host), host).toBe(true);
    }
  });

  it("blocks IPv6 loopback, unique-local, link-local and mapped forms", () => {
    for (const host of ["::1", "::", "fd00::1", "fc00::1", "fe80::1", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
      expect(isPrivateHostname(host), host).toBe(true);
    }
  });

  it("allows public hostnames", () => {
    for (const host of [
      "api.openai.com",
      "api.groq.com",
      "172.32.0.1",
      "100.128.0.1",
      "8.8.8.8",
      "2001:4860:4860::8888",
    ]) {
      expect(isPrivateHostname(host), host).toBe(false);
    }
  });
});

describe("isSafePublicUrl", () => {
  it("allows public http(s) URLs", () => {
    expect(isSafePublicUrl("https://api.openai.com/v1")).toBe(true);
    expect(isSafePublicUrl("http://example.com/recipe")).toBe(true);
  });

  it("blocks private hosts and non-http schemes", () => {
    for (const url of [
      "http://localhost:11434/v1",
      "http://127.0.0.1:3000/",
      "http://169.254.169.254/latest/meta-data/",
      "http://10.1.2.3/",
      "https://[::1]/",
      "javascript:alert(1)",
      "file:///etc/passwd",
      "ftp://example.com/",
    ]) {
      expect(isSafePublicUrl(url), url).toBe(false);
    }
  });

  it("rejects malformed input", () => {
    expect(isSafePublicUrl("not a url")).toBe(false);
    expect(isSafePublicUrl("")).toBe(false);
  });
});

describe("isAllowedAiBaseUrl", () => {
  it("allows local endpoints outside production (local Ollama workflow)", () => {
    expect(isAllowedAiBaseUrl("http://localhost:11434/v1")).toBe(true);
    expect(isAllowedAiBaseUrl("http://192.168.1.20:11434/v1")).toBe(true);
  });

  it("still rejects non-http schemes outside production", () => {
    expect(isAllowedAiBaseUrl("file:///etc/passwd")).toBe(false);
    expect(isAllowedAiBaseUrl("javascript:alert(1)")).toBe(false);
  });

  it("blocks private endpoints in production", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(isAllowedAiBaseUrl("http://localhost:11434/v1")).toBe(false);
    expect(isAllowedAiBaseUrl("http://169.254.169.254/latest")).toBe(false);
    expect(isAllowedAiBaseUrl("https://api.groq.com/openai/v1")).toBe(true);
  });
});

describe("isAllowedPushEndpoint", () => {
  it("accepts the major push services", () => {
    for (const url of [
      "https://fcm.googleapis.com/fcm/send/abc",
      "https://updates.push.services.mozilla.com/wpush/v2/abc",
      "https://web.push.apple.com/abc",
      "https://wns2-par02p.notify.windows.com/w/?token=abc",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(true);
    }
  });

  it("rejects arbitrary hosts and non-https endpoints", () => {
    for (const url of [
      "https://evil.example.com/push",
      "http://fcm.googleapis.com/fcm/send/abc",
      "https://fcm.googleapis.com.evil.example.com/push",
      "not a url",
    ]) {
      expect(isAllowedPushEndpoint(url), url).toBe(false);
    }
  });
});

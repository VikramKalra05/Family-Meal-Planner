import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * AES-256-GCM for BYO LLM API keys stored in `ai_providers`. The key comes
 * from API_KEY_ENCRYPTION_KEY (32-byte hex). If unset, a development key is
 * derived deterministically so local setups keep working — production must
 * set the variable explicitly (documented in .env.example).
 */
function encryptionKey(): Buffer {
  const hex = process.env.API_KEY_ENCRYPTION_KEY;
  if (hex && /^[0-9a-fA-F]{64}$/.test(hex)) {
    return Buffer.from(hex, "hex");
  }
  // The dev fallback derives from publicly-known values — never allow it
  // outside development, or stored keys would be trivially decryptable.
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "API_KEY_ENCRYPTION_KEY must be set to a 32-byte hex value in production.",
    );
  }
  return createHash("sha256")
    .update(`dev-fallback:${process.env.NEXT_PUBLIC_SUPABASE_URL ?? "local"}`)
    .digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${tag.toString("base64")}:${encrypted.toString("base64")}`;
}

export function decryptSecret(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split(":");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Malformed encrypted payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivB64, "base64"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/** Masked rendering for the settings list — never return full keys to the client. */
export function maskKey(plaintext: string): string {
  if (plaintext.length <= 8) return "••••••••";
  return `${plaintext.slice(0, 4)}••••${plaintext.slice(-4)}`;
}

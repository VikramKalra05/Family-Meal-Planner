/**
 * URL-safety helpers for server-side fetches of user-supplied URLs.
 *
 * Kept in one neutral module so route handlers, server actions and the reel
 * pipeline share the same checks (previously the guard lived in the reel
 * module and the AI provider path silently skipped it).
 */

const BLOCKED_HOSTNAMES = new Set(["localhost", "metadata.google.internal"]);

/** True for loopback, link-local, private, CGNAT, multicast and reserved hosts. */
export function isPrivateHostname(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.$/, "");
  if (!h) return true;
  if (BLOCKED_HOSTNAMES.has(h)) return true;
  if (h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return true;

  // IPv4 — the WHATWG URL parser normalises decimal/hex/octal forms to a
  // dotted quad before we see them, so a plain regex is sufficient here.
  const v4 = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (v4) {
    const a = Number(v4[1]);
    const b = Number(v4[2]);
    if (a === 0 || a === 10 || a === 127) return true; // this-network, private, loopback
    if (a === 169 && b === 254) return true; // link-local (cloud metadata)
    if (a === 172 && b >= 16 && b <= 31) return true; // private
    if (a === 192 && b === 168) return true; // private
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    if (a >= 224) return true; // multicast + reserved
  }

  // IPv6 — the URL parser keeps brackets; they were stripped above.
  if (h.includes(":")) {
    if (h === "::" || h === "::1") return true; // unspecified, loopback
    if (/^f[cd][0-9a-f]{2}:/i.test(h)) return true; // fc00::/7 unique-local
    if (/^fe[0-9a-f]{2}:/i.test(h)) return true; // fe80::/10 link-local + site-local
    // IPv4-mapped addresses: dotted form, or the hex form the parser emits.
    const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
    if (mapped) return isPrivateHostname(mapped[1]);
    const hexMapped = h.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
    if (hexMapped) {
      const hi = parseInt(hexMapped[1], 16);
      const lo = parseInt(hexMapped[2], 16);
      const embedded = `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
      if (isPrivateHostname(embedded)) return true;
    }
  }

  return false;
}

/** http(s) only, and the host must be publicly routable. */
export function isSafePublicUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (!u.hostname) return false;
    return !isPrivateHostname(u.hostname);
  } catch {
    return false;
  }
}

/**
 * AI provider base URLs may intentionally point at a local Ollama in
 * development. In production only public http(s) hosts are accepted; this is
 * enforced at write time (settings actions) and again at fetch time
 * (provider.chatComplete / testProviderCreds), so a row edited directly via
 * PostgREST cannot bypass it.
 */
export function isAllowedAiBaseUrl(raw: string): boolean {
  if (process.env.NODE_ENV !== "production") {
    try {
      const u = new URL(raw);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }
  return isSafePublicUrl(raw);
}

/**
 * Web-push endpoints must belong to a known push service. Without this, any
 * authenticated member could turn the server into a POST primitive against an
 * arbitrary HTTPS host (payload is encrypted, but it is still SSRF-adjacent).
 */
const PUSH_HOSTS = new Set([
  "fcm.googleapis.com",
  "android.googleapis.com",
  "updates.push.services.mozilla.com",
  "push.services.mozilla.com",
]);
const PUSH_HOST_SUFFIXES = [".push.apple.com", ".notify.windows.com"];

export function isAllowedPushEndpoint(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    return PUSH_HOSTS.has(h) || PUSH_HOST_SUFFIXES.some((suffix) => h.endsWith(suffix));
  } catch {
    return false;
  }
}

/**
 * In-memory sliding-window rate limiter. Per-server-instance (fine for a
 * single-region deployment; swap for Upstash/Redis if the app ever scales
 * horizontally). Used to meter expensive outbound calls — LLM endpoints and
 * brute-forceable lookups — per user, per window.
 */
const buckets = new Map<string, number[]>();

export function checkRate(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);

  // Crude GC so the map can't grow unbounded.
  if (buckets.size > 10_000) {
    for (const [k, times] of buckets) {
      if (times.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  return true;
}

export function rateLimited(limit: number, windowMs: number): string {
  const minutes = Math.max(1, Math.round(windowMs / 60_000));
  return `Rate limit reached — try again in up to ${minutes} minutes.`;
}

/* Family Meal Planner service worker.
 * Minimal on purpose: owning the /sw.js scope enables PWA install + the
 * Android share target (reels shared straight into the app). Static caching
 * strategy kept conservative — network-first, cache fallback for GET only. */
const CACHE = "fmp-v1";
const PRECACHE = ["/manifest.webmanifest", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  // Cache STATIC ASSETS ONLY — never authenticated pages or API responses,
  // so no RLS-scoped data ever lands in Cache Storage on disk.
  const path = new URL(req.url).pathname;
  const cacheable = path.startsWith("/_next/static/") || path.startsWith("/icons/") || path === "/manifest.webmanifest";
  if (!cacheable) return;
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

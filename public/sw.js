/* Family Meal Planner service worker.
 * Minimal on purpose: owning the /sw.js scope enables PWA install + the
 * Android share target (reels shared straight into the app). Static caching
 * strategy kept conservative — network-first, cache fallback for GET only. */
const CACHE = "fmp-v2";
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

// Web Push — the server scheduler (src/lib/push-scheduler.ts) delivers
// reminders even when every tab is closed.
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "Family Meal Planner", body: event.data ? event.data.text() : "" };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Family Meal Planner", {
      body: data.body || "",
      icon: "/icons/icon.svg",
      badge: "/icons/icon.svg",
      tag: data.tag || undefined,
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && "focus" in client) {
          client.focus();
          if ("navigate" in client) return client.navigate(url);
          return;
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});

// ── Gym offline queue ───────────────────────────────────────────────────────
// The workout screen writes set logs to IndexedDB and registers a one-shot
// Background Sync. This handler flushes them even if the tab is minimised.
// Android Chrome fires it; iOS Safari falls back to the foreground flush.
const GYM_DB = "fm-gym";

function openGymDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(GYM_DB, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("queue")) db.createObjectStore("queue", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function flushGymQueue() {
  let db;
  try {
    db = await openGymDb();
  } catch {
    return;
  }
  if (!db.objectStoreNames.contains("queue")) return;

  const items = await new Promise((resolve, reject) => {
    const tx = db.transaction("queue", "readonly");
    const req = tx.objectStore("queue").getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  }).catch(() => []);
  if (!items.length) return;

  let response;
  try {
    response = await fetch("/api/gym/sync", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mutations: items.map(({ id, kind, data }) => ({ id, kind, data })),
      }),
      credentials: "same-origin",
    });
  } catch {
    return;
  }
  if (!response.ok) return;

  const json = await response.json().catch(() => ({}));
  const okIds = new Set((json.results || []).filter((r) => r.ok).map((r) => r.id));
  if (okIds.size === 0) return;

  await new Promise((resolve) => {
    const tx = db.transaction("queue", "readwrite");
    for (const id of okIds) tx.objectStore("queue").delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

self.addEventListener("sync", (event) => {
  if (event.tag === "gym-sync") event.waitUntil(flushGymQueue());
});

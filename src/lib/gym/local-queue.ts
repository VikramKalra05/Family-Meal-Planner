"use client";

/**
 * Offline write queue for the workout screen.
 *
 * IndexedDB (not localStorage) so a service worker can flush it from a
 * Background Sync event while the tab is minimised. Every item carries a
 * client-generated UUID, so the server upsert is idempotent and a retry after
 * a dropped response cannot duplicate a set.
 *
 * Scope: the workout logging surface only. Other pages remain server-rendered
 * and intentionally are not cached by the service worker.
 */

export type MutationKind = "set_upsert" | "set_delete" | "session_upsert" | "session_complete";

export interface QueueItem {
  id: string;
  kind: MutationKind;
  data?: Record<string, unknown>;
  queuedAt: number;
  status: "pending" | "error";
  error?: string;
}

const DB_NAME = "fm-gym";
const DB_VERSION = 1;
const STORE = "queue";
const SYNC_TAG = "gym-sync";

const memory: QueueItem[] = [];
export interface FlushResult {
  ok: number;
  failed: number;
  okIds: string[];
  errors: { id: string; error: string }[];
}

const EMPTY: FlushResult = { ok: 0, failed: 0, okIds: [], errors: [] };
const listeners = new Set<(summary: QueueSummary) => void>();
let flushing: Promise<FlushResult> | null = null;

export interface QueueSummary {
  pending: number;
  errors: number;
  firstError: string | null;
}

/** Preserve the order things actually happened in. */
export function sortQueue<T extends { queuedAt: number; id: string }>(items: T[]): T[] {
  return [...items].sort(
    (a, b) => a.queuedAt - b.queuedAt || a.id.localeCompare(b.id),
  );
}

function hasIdb(): boolean {
  return typeof window !== "undefined" && typeof indexedDB !== "undefined";
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readQueue(): Promise<QueueItem[]> {
  if (!hasIdb()) return sortQueue([...memory]);
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(sortQueue((req.result ?? []) as QueueItem[]));
    req.onerror = () => reject(req.error);
  });
}

async function writeItem(item: QueueItem): Promise<void> {
  if (!hasIdb()) {
    const index = memory.findIndex((m) => m.id === item.id);
    if (index >= 0) memory[index] = item;
    else memory.push(item);
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function deleteItems(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  if (!hasIdb()) {
    for (const id of ids) {
      const index = memory.findIndex((m) => m.id === id);
      if (index >= 0) memory.splice(index, 1);
    }
    return;
  }
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    for (const id of ids) tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function summarize(items: QueueItem[]): QueueSummary {
  const failed = items.filter((i) => i.status === "error");
  return {
    pending: items.filter((i) => i.status === "pending").length,
    errors: failed.length,
    firstError: failed[0]?.error ?? null,
  };
}

async function notify(): Promise<void> {
  try {
    const summary = summarize(await readQueue());
    for (const listener of listeners) listener(summary);
  } catch {
    // A closed DB or private mode should never break logging.
  }
}

export async function enqueue(item: Omit<QueueItem, "queuedAt" | "status">): Promise<void> {
  await writeItem({ ...item, queuedAt: Date.now(), status: "pending" });
  await notify();
  void registerBackgroundSync();
}

export async function pendingCount(): Promise<number> {
  try {
    return (await readQueue()).filter((i) => i.status === "pending").length;
  } catch {
    return 0;
  }
}

export async function queueSummary(): Promise<QueueSummary> {
  try {
    return summarize(await readQueue());
  } catch {
    return { pending: 0, errors: 0, firstError: null };
  }
}

export async function queueItems(): Promise<QueueItem[]> {
  try {
    return await readQueue();
  } catch {
    return [];
  }
}

/**
 * Move rejected items back to pending and try again. Rejected writes are kept
 * on the device so a transient server error never loses a set.
 */
export async function retryFailed(): Promise<void> {
  const items = await readQueue();
  for (const item of items.filter((i) => i.status === "error")) {
    await writeItem({ ...item, status: "pending", error: undefined });
  }
  await notify();
  void flushQueue();
}

/** Drop rejected copies from this device. The server never saved them. */
export async function discardFailed(): Promise<void> {
  const items = await readQueue();
  await deleteItems(items.filter((i) => i.status === "error").map((i) => i.id));
  await notify();
}

export function subscribeQueue(listener: (summary: QueueSummary) => void): () => void {
  listeners.add(listener);
  void notify();
  return () => listeners.delete(listener);
}

/**
 * Flush the queue. Returns the number accepted and rejected. A network
 * failure leaves everything queued; a per-item server rejection is marked
 * `error` and kept for the UI to show, not silently dropped.
 */
export async function flushQueue(): Promise<FlushResult> {
  if (flushing) return flushing;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return EMPTY;

  flushing = (async () => {
    const items = await readQueue();
    if (items.length === 0) return EMPTY;

    const mutations = items.map(({ id, kind, data }) => ({ id, kind, data }));
    let response: Response;
    try {
      response = await fetch("/api/gym/sync", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mutations }),
        credentials: "same-origin",
      });
    } catch {
      return EMPTY;
    }
    if (!response.ok) return EMPTY;

    const json = (await response.json()) as {
      results?: { id: string; ok: boolean; error?: string }[];
    };
    const results = json.results ?? [];
    const okIds = results.filter((r) => r.ok).map((r) => r.id);
    const errors = results.filter((r) => !r.ok);

    for (const failure of errors) {
      const item = items.find((i) => i.id === failure.id);
      if (item) await writeItem({ ...item, status: "error", error: failure.error ?? "Rejected" });
    }
    await deleteItems(okIds);
    await notify();
    return {
      ok: okIds.length,
      failed: errors.length,
      okIds,
      errors: errors.map((e) => ({ id: e.id, error: e.error ?? "Rejected" })),
    };
  })().finally(() => {
    flushing = null;
  });

  return flushing;
}

export async function registerBackgroundSync(): Promise<void> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sync = (registration as ServiceWorkerRegistration & { sync?: { register: (tag: string) => Promise<void> } }).sync;
    if (sync) await sync.register(SYNC_TAG);
  } catch {
    // Background Sync is unsupported on iOS; the visibility/online flush covers it.
  }
}

let installed = false;

/** Flush on reconnect, on return to the tab, and every 30 seconds. */
export function installAutoFlush(): () => void {
  if (typeof window === "undefined") return () => {};
  if (installed) return () => {};
  installed = true;

  const onOnline = () => void flushQueue();
  const onVisible = () => {
    if (document.visibilityState === "visible") void flushQueue();
  };
  window.addEventListener("online", onOnline);
  document.addEventListener("visibilitychange", onVisible);
  const interval = window.setInterval(() => {
    if (document.visibilityState === "visible") void flushQueue();
  }, 30_000);

  return () => {
    window.removeEventListener("online", onOnline);
    document.removeEventListener("visibilitychange", onVisible);
    window.clearInterval(interval);
    installed = false;
  };
}

export { SYNC_TAG };

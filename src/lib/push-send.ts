/**
 * Server-side Web Push delivery. Never import from client code — web-push
 * is a Node-only module and the VAPID private key must stay server-side.
 */
import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface PushPayload {
  title: string;
  body: string;
  /** In-app path to open when the notification is clicked. */
  url?: string;
  /** Notifications with the same tag replace each other instead of stacking. */
  tag?: string;
}

export function vapidConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

let configured = false;
function ensureVapid(): void {
  if (configured) return;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    throw new Error("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in env");
  }
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:family-meal-planner@example.com",
    publicKey,
    privateKey,
  );
  configured = true;
}

export interface SubscriptionRow {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface DeliveryResult {
  sent: number;
  /** Subscriptions removed because the browser reported them gone (404/410). */
  removed: number;
}

/**
 * Sends the payload to every push subscription stored for a member and
 * cleans up stale ones. `db` may be a service-role client (scheduler) or
 * the member's own authed client (test endpoint) — RLS scopes it either way.
 */
export async function sendToMemberSubs(
  db: SupabaseClient,
  memberId: string,
  payload: PushPayload,
): Promise<DeliveryResult> {
  const { data: subs, error } = await db
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("member_id", memberId);
  if (error) throw error;
  if (!subs?.length) return { sent: 0, removed: 0 };

  ensureVapid();
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (sub: SubscriptionRow) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload),
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // Subscription expired (browser uninstalled, permission revoked).
          await db.from("push_subscriptions").delete().eq("id", sub.id);
          removed += 1;
        } else if (status !== 429) {
          // Transient provider hiccups (429, 5xx) are logged, not fatal.
          console.error(`[push] delivery failed (${status ?? "no status"}) for ${sub.endpoint.slice(0, 60)}`);
        }
      }
    }),
  );
  return { sent, removed };
}

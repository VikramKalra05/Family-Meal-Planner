/**
 * Background push scheduler — delivers weigh-in reminders through web-push
 * even when no browser tab is open.
 *
 * Two runtimes:
 *  - Self-hosted / dev: `startPushScheduler()` (called by
 *    src/instrumentation.ts) runs the tick every 60s inside the server.
 *  - Vercel (serverless): long-lived intervals don't survive, so the
 *    instrumentation hook skips starting and Vercel Cron hits
 *    /api/push/tick instead, which calls `runSchedulerTick()` directly.
 *
 * Uses the service role key, which is why it lives server-side only and
 * never touches client bundles.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { istMoment, shouldSendWeighInPush } from "./push";
import { sendToMemberSubs, vapidConfigured } from "./push-send";

const TICK_MS = 60_000;
const LOG_RETENTION_DAYS = 30;

let db: SupabaseClient | null = null;

function schedulerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;
  db ??= createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return db;
}

export function startPushScheduler(): void {
  if (!vapidConfigured()) {
    console.warn("[push] VAPID keys missing — background weigh-in reminders disabled");
    return;
  }
  if (!schedulerClient()) {
    console.warn("[push] SUPABASE_SERVICE_ROLE_KEY missing — background weigh-in reminders disabled");
    return;
  }
  if (process.env.VERCEL === "1") {
    // Serverless: the interval would die with the lambda. Vercel Cron hits
    // /api/push/tick instead (see vercel.json).
    console.log("[push] Vercel detected — scheduler runs via /api/push/tick cron");
    return;
  }
  console.log("[push] scheduler started — weigh-in reminders every 60s (IST clock)");
  void runSchedulerTick();
  setInterval(() => void runSchedulerTick(), TICK_MS);
}

/** One due-check + delivery pass over all members. Safe to call repeatedly. */
export async function runSchedulerTick(): Promise<void> {
  const db = schedulerClient();
  if (!db || !vapidConfigured()) return;
  await runTick(db);
}

async function runTick(db: SupabaseClient): Promise<void> {
  try {
    const now = istMoment(new Date());

    const { data: members, error } = await db
      .from("profiles")
      .select("id, display_name, weigh_in_time")
      .not("weigh_in_time", "is", null);
    if (error) throw error;
    if (!members?.length) return;

    const ids = members.map((m) => m.id);
    const [logsRes, sentRes] = await Promise.all([
      db.from("weight_logs").select("member_id").eq("logged_on", now.day).in("member_id", ids),
      db.from("push_log").select("member_id, sent_at").eq("kind", "weigh-in").eq("day", now.day).in("member_id", ids),
    ]);
    if (logsRes.error) throw logsRes.error;
    if (sentRes.error) throw sentRes.error;

    const loggedToday = new Set((logsRes.data ?? []).map((l) => l.member_id));
    const sentBy = new Map<string, string[]>();
    for (const row of sentRes.data ?? []) {
      sentBy.set(row.member_id, [...(sentBy.get(row.member_id) ?? []), row.sent_at]);
    }

    for (const member of members) {
      const due = shouldSendWeighInPush({
        now,
        weighInTime: member.weigh_in_time as string,
        loggedToday: loggedToday.has(member.id),
        sentToday: sentBy.get(member.id) ?? [],
      });
      if (!due) continue;

      const { sent } = await sendToMemberSubs(db, member.id, {
        title: "Time to weigh in ⚖️",
        body: "Log today's weight — your targets follow your body.",
        url: "/progress",
        tag: "weigh-in",
      });
      if (sent > 0) {
        await db.from("push_log").insert({ member_id: member.id, kind: "weigh-in", day: now.day });
        console.log(`[push] weigh-in reminder → ${member.display_name} (${sent} device${sent === 1 ? "" : "s"})`);
      }
    }

    await maybePruneLog(db);
  } catch (err) {
    console.error("[push] tick failed:", err);
  }
}

let lastPrune = 0;
async function maybePruneLog(db: SupabaseClient): Promise<void> {
  // Hourly at most — the log is tiny, this just keeps it bounded.
  if (Date.now() - lastPrune < 60 * 60 * 1000) return;
  lastPrune = Date.now();
  const cutoff = new Date(Date.now() - LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
  await db.from("push_log").delete().lt("sent_at", cutoff);
}

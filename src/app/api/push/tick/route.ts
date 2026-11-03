import { NextResponse } from "next/server";
import { runSchedulerTick } from "@/lib/push-scheduler";

/**
 * One scheduler tick for environments without a long-lived process.
 * Vercel Cron calls this on a schedule (see vercel.json) with
 * `Authorization: Bearer ${CRON_SECRET}` when CRON_SECRET is configured.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }
  await runSchedulerTick();
  return NextResponse.json({ ok: true });
}

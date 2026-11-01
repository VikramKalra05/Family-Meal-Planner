/**
 * Pure helpers for the background push scheduler. All household-facing
 * times are IST (UTC+5:30, no DST — India-first by design), so "today"
 * and "HH:MM" are always computed on an IST clock regardless of the
 * server's own timezone.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

export interface IstMoment {
  /** 'YYYY-MM-DD' — the IST calendar day. */
  day: string;
  /** 'HH:MM' — the IST wall-clock time. */
  time: string;
}

export function istMoment(date: Date): IstMoment {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.toISOString().slice(0, 10);
  const time = `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
  return { day, time };
}

export interface WeighInPushContext {
  now: IstMoment;
  /** Member's chosen reminder time, 'HH:MM' (IST). */
  weighInTime: string;
  /** Member already logged a weight today (IST day). */
  loggedToday: boolean;
  /** sent_at ISO timestamps of today's already-delivered weigh-in pushes. */
  sentToday: string[];
}

export interface WeighInPushPolicy {
  maxPerDay: number;
  gapHours: number;
}

export const WEIGH_IN_POLICY: WeighInPushPolicy = { maxPerDay: 2, gapHours: 4 };

/**
 * Cadence decision, mirroring the in-app reminder: only after the chosen
 * time, never on a logged day, at most maxPerDay nudges per day with a
 * gapHours minimum between them.
 */
export function shouldSendWeighInPush(
  ctx: WeighInPushContext,
  policy: WeighInPushPolicy = WEIGH_IN_POLICY,
): boolean {
  if (!ctx.weighInTime || ctx.now.time < ctx.weighInTime) return false;
  if (ctx.loggedToday) return false;
  if (ctx.sentToday.length >= policy.maxPerDay) return false;

  if (ctx.sentToday.length > 0) {
    const nowMs = Date.parse(`${ctx.now.day}T${ctx.now.time}:00+05:30`);
    const last = Math.max(...ctx.sentToday.map((s) => Date.parse(s)));
    if (Number.isFinite(last) && nowMs - last < policy.gapHours * 60 * 60 * 1000) return false;
  }
  return true;
}

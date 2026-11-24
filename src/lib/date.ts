/**
 * India-first date helpers. The app's day boundary is IST (UTC+5:30, no
 * DST), independent of the server's timezone. Using `toISOString()` directly
 * would put 00:00–05:30 IST into the previous UTC day — wrong weigh-ins,
 * wrong "today" meals, and the previous week's plan on Monday morning.
 */

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** 'YYYY-MM-DD' for the IST calendar day containing `date`. */
export function istDateISO(date: Date = new Date()): string {
  return new Date(date.getTime() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** 0–23 IST wall-clock hour. */
export function istHour(date: Date = new Date()): number {
  return new Date(date.getTime() + IST_OFFSET_MS).getUTCHours();
}

/** Valid calendar-day string for diary/meal actions (past, today or future). */
export function isDiaryDateISO(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  if (value < "2000-01-01" || value > "2100-12-31") return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Add whole days to an ISO calendar day without touching local time. */
export function shiftDiaryDate(date: string, days: number): string {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
] as const;

/**
 * Resolve a day named inside a freeform meal message. Only unambiguous forms
 * are handled (today/yesterday/tomorrow, +/- N days, last/next weekday, an
 * explicit ISO date); the review card still shows the date before writing.
 * Returns null when the text names no day, so callers can keep their own.
 */
export function parseDateHint(text: string, today: string = istDateISO()): string | null {
  const lower = text.toLowerCase();

  const explicit = lower.match(/\b(20\d{2}-\d{2}-\d{2})\b/);
  if (explicit && isDiaryDateISO(explicit[1])) return explicit[1];

  if (/\bday before yesterday\b/.test(lower)) return shiftDiaryDate(today, -2);
  if (/\bday after tomorrow\b/.test(lower)) return shiftDiaryDate(today, 2);
  if (/\byesterday\b/.test(lower)) return shiftDiaryDate(today, -1);
  if (/\btomorrow\b/.test(lower)) return shiftDiaryDate(today, 1);
  if (/\btoday\b/.test(lower)) return today;

  const relative = lower.match(/\b(\d{1,2})\s+days?\s+(ago|from now|later)\b/);
  if (relative) {
    const days = Number(relative[1]);
    if (days <= 365) return shiftDiaryDate(today, relative[2] === "ago" ? -days : days);
  }

  const inDays = lower.match(/\bin\s+(\d{1,2})\s+days?\b/);
  if (inDays) {
    const days = Number(inDays[1]);
    if (days <= 365) return shiftDiaryDate(today, days);
  }

  const weekday = lower.match(
    /\b(last|previous|next)\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/,
  );
  if (weekday) {
    const target = WEEKDAYS.indexOf(weekday[2] as (typeof WEEKDAYS)[number]);
    const current = new Date(`${today}T00:00:00Z`).getUTCDay();
    if (weekday[1] === "next") {
      const forward = (target - current + 7) % 7;
      return shiftDiaryDate(today, forward || 7);
    }
    const backward = (current - target + 7) % 7;
    return shiftDiaryDate(today, -(backward || 7));
  }

  return null;
}

/** 'HH:MM' IST wall-clock time. */
export function istTimeHHMM(date: Date = new Date()): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
}

/** Human date label rendered in IST regardless of the runtime timezone. */
export function formatIstDate(
  date: Date | string,
  opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" },
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...opts }).format(value);
}

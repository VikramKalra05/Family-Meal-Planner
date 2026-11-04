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

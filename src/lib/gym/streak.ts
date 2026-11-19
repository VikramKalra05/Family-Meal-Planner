/**
 * Streak rules that don't punish rest days.
 *
 * Only *scheduled* training days can extend or break a streak. A rest day is
 * neutral. Today's scheduled session is not "missed" until the day ends, so
 * opening the app in the morning never shows a broken streak.
 *
 * One freeze per calendar month covers a genuine miss (travel, illness)
 * without turning the streak into a lie.
 */

import { addDays, daysBetween, weekdayIndex } from "./types";

export interface StreakInput {
  /** ISO dates with at least one completed session. */
  sessionDates: string[];
  /** 0 = Monday … 6 = Sunday. Empty means no schedule → no streak. */
  scheduledDays: number[];
  /** Today in IST, yyyy-mm-dd. */
  today: string;
  /** ISO dates the user spent a freeze on. */
  freezes?: string[];
  /** How far back to compute "longest". Default 180 days. */
  lookbackDays?: number;
}

export interface StreakResult {
  current: number;
  longest: number;
  /** Completed scheduled days ÷ elapsed scheduled days, 0–100. */
  consistencyPct: number | null;
  scheduledDaysElapsed: number;
  completed: number;
  /** Scheduled days missed in the last 28 days, newest first. */
  recentMisses: string[];
  /** 0 or 1 — one freeze per calendar month. */
  freezesAvailable: number;
}

export function computeStreak(input: StreakInput): StreakResult {
  const scheduled = new Set(input.scheduledDays.filter((d) => d >= 0 && d <= 6));
  const sessions = new Set(input.sessionDates);
  const freezes = new Set(input.freezes ?? []);
  const today = input.today;
  const lookback = input.lookbackDays ?? 180;

  if (scheduled.size === 0) {
    return {
      current: 0,
      longest: 0,
      consistencyPct: null,
      scheduledDaysElapsed: 0,
      completed: 0,
      recentMisses: [],
      freezesAvailable: freezesAvailableThisMonth(input.freezes ?? [], today),
    };
  }

  // Consistency starts in the week the user actually started training.
  // Otherwise a new account would show a terrible score for months of
  // scheduled days that predate it.
  const history = [...input.sessionDates, ...(input.freezes ?? [])].sort();
  const earliest = history[0];
  const earliestWeek = earliest ? mondayOf(earliest) : mondayOf(today);
  const windowStart = addDays(today, -lookback);
  const start = earliestWeek < windowStart ? windowStart : earliestWeek;

  const isScheduled = (date: string) => scheduled.has(weekdayIndex(date));
  const isDone = (date: string) => sessions.has(date) || freezes.has(date);

  // Current streak: walk backwards. Skip non-scheduled days and today if it
  // is still pending. The first missed past scheduled day ends the run.
  let current = 0;
  let cursor = today;
  let guard = 0;
  while (cursor >= start && guard++ < lookback + 7) {
    if (isScheduled(cursor)) {
      if (isDone(cursor)) {
        current++;
      } else if (cursor === today) {
        // Not due yet — keep walking.
      } else {
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  // Longest + consistency over the tracked window.
  let longest = 0;
  let run = 0;
  let elapsed = 0;
  let completed = 0;
  const recentMisses: string[] = [];
  cursor = start;
  guard = 0;
  while (cursor <= today && guard++ < lookback + 7) {
    if (isScheduled(cursor)) {
      if (isDone(cursor)) {
        run++;
        completed++;
        elapsed++;
        longest = Math.max(longest, run);
      } else if (cursor === today) {
        // Still pending — do not count it as elapsed or a miss.
      } else {
        elapsed++;
        run = 0;
        if (daysBetween(cursor, today) <= 28) recentMisses.push(cursor);
      }
    }
    cursor = addDays(cursor, 1);
  }

  return {
    current,
    longest,
    consistencyPct: elapsed === 0 ? null : Math.round((completed / elapsed) * 100),
    scheduledDaysElapsed: elapsed,
    completed,
    recentMisses: recentMisses.reverse(),
    freezesAvailable: freezesAvailableThisMonth(input.freezes ?? [], today),
  };
}

/** Monday of the week containing `date` (0 = Monday). */
function mondayOf(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

function freezesAvailableThisMonth(freezes: string[], today: string): number {
  const month = today.slice(0, 7);
  const used = freezes.filter((f) => f.startsWith(month)).length;
  return Math.max(0, 1 - used);
}

/** Is `date` a scheduled training day? Used by the nutrition interlock. */
export function isTrainingDay(date: string, scheduledDays: number[]): boolean {
  return scheduledDays.includes(weekdayIndex(date));
}

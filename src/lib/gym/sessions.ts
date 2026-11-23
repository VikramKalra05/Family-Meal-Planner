/**
 * Pure session-selection helpers. The database can contain an old skipped
 * session and a newer open one for the same day, so "today's session" must be
 * chosen by status, not by insertion order.
 */

export type SessionStatus = "in_progress" | "completed" | "skipped";

export interface SessionLike {
  session_date: string;
  status: SessionStatus;
  created_at: string;
}

const STATUS_RANK: Record<SessionStatus, number> = {
  in_progress: 0,
  completed: 1,
  skipped: 2,
};

/** The session that represents a date: open > completed > skipped. */
export function pickSessionForDate<T extends SessionLike>(
  sessions: T[],
  date: string,
): T | null {
  const todays = sessions.filter((s) => s.session_date === date);
  if (todays.length === 0) return null;
  todays.sort(
    (a, b) =>
      STATUS_RANK[a.status] - STATUS_RANK[b.status] ||
      b.created_at.localeCompare(a.created_at),
  );
  return todays[0];
}

/** Only completed sessions count toward the streak. */
export function completedSessionDates(sessions: Pick<SessionLike, "status" | "session_date">[]): string[] {
  return sessions.filter((s) => s.status === "completed").map((s) => s.session_date);
}

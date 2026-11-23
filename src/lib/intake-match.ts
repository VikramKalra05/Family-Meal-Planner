/**
 * Resolve a spoken food name ("soya aloo tikki") against the rows already in
 * the diary ("Soya Aloo Tikki (5 pieces)"). Pure and unit-tested: a wrong
 * match would move the wrong meal, so this must not depend on the model.
 */

export interface IntakeMatchRow {
  id: string;
  slot: string;
  description: string | null;
  kcal: number;
}

const STOPWORDS = new Set(["the", "and", "with", "from", "this", "that", "some"]);

export function normalizeFood(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export type IntakeMatch =
  | { row: IntakeMatchRow }
  | { ambiguous: IntakeMatchRow[] }
  | null;

/**
 * - exact substring beats token overlap
 * - `fromSlot` narrows the candidates when the user said "from lunch"
 * - a genuine tie is returned as ambiguous, never guessed
 */
export function findIntakeMatch(
  rows: IntakeMatchRow[],
  item: string,
  fromSlot?: string,
): IntakeMatch {
  const query = normalizeFood(item);
  if (!query) return null;

  const tokens = query.split(" ").filter((t) => t.length > 2 && !STOPWORDS.has(t));

  const scored = rows
    .filter((r) => !fromSlot || r.slot === fromSlot)
    .map((row) => {
      const haystack = normalizeFood(row.description ?? "");
      const exact = haystack.includes(query) || query.includes(haystack);
      const overlap =
        tokens.length > 0 ? tokens.filter((t) => haystack.includes(t)).length / tokens.length : 0;
      return { row, exact, overlap };
    })
    .filter((c) => c.exact || c.overlap >= 0.5)
    .sort((a, b) => Number(b.exact) - Number(a.exact) || b.overlap - a.overlap);

  if (scored.length === 0) return null;

  const top = scored[0];
  const tied = scored.filter((c) => c.exact === top.exact && c.overlap === top.overlap);
  if (tied.length > 1) return { ambiguous: tied.slice(0, 4).map((c) => c.row) };
  return { row: top.row };
}

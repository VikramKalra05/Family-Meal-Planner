/**
 * Member aliases for the AI boundary. Real display names never leave the
 * server toward an LLM provider; the model sees stable pseudonyms instead.
 *
 * Labels are deterministic per household (sorted by member id), so they are
 * consistent across turns, tools and conversations. "You" is the signed-in
 * member. The client receives the alias → real-name map separately and
 * de-pseudonymizes when rendering — the mapping itself never reaches the
 * provider.
 */

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

export interface MemberLabelInput {
  id: string;
  display_name: string;
}

/** id → alias ("You" for self, then Member-A, Member-B, … by sorted id). */
export function memberLabels(
  members: MemberLabelInput[],
  selfId: string,
): Map<string, string> {
  const sorted = [...members].sort((a, b) => a.id.localeCompare(b.id));
  const map = new Map<string, string>();
  if (selfId) map.set(selfId, "You");
  let n = 0;
  for (const m of sorted) {
    if (map.has(m.id)) continue;
    const letter = n < ALPHABET.length ? ALPHABET[n] : String(n + 1);
    map.set(m.id, `Member-${letter}`);
    n += 1;
  }
  return map;
}

/** Matches the aliases produced above, e.g. "Member-A", "Member-27". */
export const MEMBER_LABEL_RE = /\bMember-[A-Z0-9]+\b/g;

/** The user-facing alias for a member id (falls back to the alias itself). */
export function labelFor(map: Map<string, string>, id: string): string {
  return map.get(id) ?? "Unknown member";
}

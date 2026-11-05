import { describe, expect, it } from "vitest";
import { memberLabels, MEMBER_LABEL_RE } from "./labels";

const A = "aaaaaaaa-1111-4111-8111-111111111111";
const B = "bbbbbbbb-1111-4111-8111-111111111111";
const C = "cccccccc-1111-4111-8111-111111111111";

describe("memberLabels", () => {
  it("labels self as You and others as stable Member-X by sorted id", () => {
    const map = memberLabels(
      [
        { id: C, display_name: "Ma" },
        { id: A, display_name: "Vikram" },
        { id: B, display_name: "Priya" },
      ],
      A,
    );
    expect(map.get(A)).toBe("You");
    // B sorts before C → Member-A goes to B regardless of input order.
    expect(map.get(B)).toBe("Member-A");
    expect(map.get(C)).toBe("Member-B");
  });

  it("is stable across calls and input orderings", () => {
    const one = memberLabels([{ id: B, display_name: "Priya" }, { id: C, display_name: "Ma" }], A);
    const two = memberLabels([{ id: C, display_name: "Ma" }, { id: B, display_name: "Priya" }], A);
    expect(one.get(B)).toBe(two.get(B));
    expect(one.get(C)).toBe(two.get(C));
  });

  it("falls back to numbers beyond 26 members", () => {
    const many = Array.from({ length: 28 }, (_, i) => ({
      id: `id-${String(i).padStart(3, "0")}`,
      display_name: `m${i}`,
    }));
    const map = memberLabels(many, "someone-else");
    expect(map.get("id-026")).toBe("Member-27");
    expect(map.get("id-027")).toBe("Member-28");
  });

  it("aliases are matchable by the regex used for client de-aliasing", () => {
    const members = [
      { id: A, display_name: "Vikram" },
      { id: B, display_name: "Priya" },
    ];
    const labels = memberLabels(members, A);
    // The client inverts to label → real name (never sent to the provider).
    const labelToName = new Map(members.map((m) => [labels.get(m.id) ?? "", m.display_name]));
    const text = "Member-A logged 2 roti; You had dal.";
    const replaced = text.replace(MEMBER_LABEL_RE, (m) => labelToName.get(m) ?? m);
    expect(replaced).toBe("Priya logged 2 roti; You had dal.");
  });
});

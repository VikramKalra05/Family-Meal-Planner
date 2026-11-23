import { describe, expect, it } from "vitest";
import { findIntakeMatch, normalizeFood, type IntakeMatchRow } from "./intake-match";

const rows: IntakeMatchRow[] = [
  { id: "1", slot: "lunch", description: "Soya Aloo Tikki (5 pieces)", kcal: 400 },
  { id: "2", slot: "lunch", description: "Cooked rice (250 g)", kcal: 325 },
  { id: "3", slot: "lunch", description: "Chicken breast (50 g)", kcal: 82 },
  { id: "4", slot: "breakfast", description: "Soya Aloo Tikki (1 piece)", kcal: 120 },
];

describe("intake move matching", () => {
  it("matches the lunch tikki when the user names it and says lunch", () => {
    const match = findIntakeMatch(rows, "soya aloo tikki", "lunch");
    expect("row" in match! ? match.row.id : null).toBe("1");
  });

  it("matches a name that includes the quantity", () => {
    const match = findIntakeMatch(rows, "1 piece soya aloo tikki", "breakfast");
    expect("row" in match! ? match.row.id : null).toBe("4");
  });

  it("returns ambiguous rather than guessing when the name exists twice", () => {
    const match = findIntakeMatch(rows, "soya aloo tikki");
    expect("ambiguous" in match! ? match.ambiguous.map((r) => r.id).sort() : []).toEqual(["1", "4"]);
  });

  it("keeps a partial name ambiguous", () => {
    const match = findIntakeMatch(rows, "soya");
    expect("ambiguous" in match!).toBe(true);
  });

  it("matches a unique item", () => {
    const match = findIntakeMatch(rows, "the chicken breast");
    expect("row" in match! ? match.row.id : null).toBe("3");
  });

  it("returns null for something not in the diary", () => {
    expect(findIntakeMatch(rows, "paneer")).toBeNull();
  });

  it("normalizes punctuation and case", () => {
    expect(normalizeFood("  Soya-Aloo  Tikki! ")).toBe("soya aloo tikki");
  });
});

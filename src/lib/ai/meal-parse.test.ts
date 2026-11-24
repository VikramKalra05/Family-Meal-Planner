import { describe, expect, it } from "vitest";
import { mealCommandSchema, mealMoveCommandSchema } from "@/lib/ai/meal-parse";

describe("mealCommandSchema", () => {
  it("parses a log with quantity and macros", () => {
    const parsed = mealCommandSchema.parse({
      action: "log",
      items: [
        { name: "Roti", quantity: "2 pieces", kcal: 240, proteinG: 6, carbsG: 48, fatG: 2 },
      ],
    });
    expect(parsed.action).toBe("log");
  });

  it("parses a move that names only the source meal", () => {
    const parsed = mealMoveCommandSchema.parse({
      action: "move",
      item: "soya tikki",
      fromSlot: "lunch",
    });
    expect(parsed.toSlot).toBeUndefined();
  });

  it("parses a move that names a new day without a target meal", () => {
    const parsed = mealMoveCommandSchema.parse({ action: "move", item: "soya tikki" });
    expect(parsed.fromSlot).toBeUndefined();
    expect(parsed.toSlot).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { photoAnalysisSchema } from "./photo";

describe("photoAnalysisSchema", () => {
  it("accepts an itemized plate estimate", () => {
    const parsed = photoAnalysisSchema.parse({
      reply: "2 roti, dal and a spoon of ghee — about 520 kcal.",
      items: [
        { description: "Roti", grams: 80, kcal: 240, protein_g: 6, carbs_g: 40, fat_g: 6, fiber_g: 4 },
        { description: "Dal", grams: 150, kcal: 180, protein_g: 9, carbs_g: 20, fat_g: 6 },
      ],
    });
    expect(parsed.items).toHaveLength(2);
    expect(parsed.items[0].grams).toBe(80);
  });

  it("allows an empty list when the photo is not food", () => {
    expect(photoAnalysisSchema.safeParse({ reply: "That isn't food.", items: [] }).success).toBe(true);
  });

  it("rejects zero-gram items and missing macros", () => {
    expect(
      photoAnalysisSchema.safeParse({
        reply: "x",
        items: [{ description: "Roti", grams: 0, kcal: 100, protein_g: 1, carbs_g: 1, fat_g: 1 }],
      }).success,
    ).toBe(false);
    expect(
      photoAnalysisSchema.safeParse({
        reply: "x",
        items: [{ description: "Roti", grams: 80, kcal: 100 }],
      }).success,
    ).toBe(false);
  });
});

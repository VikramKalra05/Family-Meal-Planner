import { describe, expect, it } from "vitest";
import {
  assistantActionSchema,
  chatTurnSchema,
  isReadAction,
  summarizeAction,
} from "./schema";

const UUID = "9b2f5e1a-3c4d-4e5f-8a9b-0c1d2e3f4a5b";

describe("assistantActionSchema", () => {
  it("accepts a read action and classifies it", () => {
    const parsed = assistantActionSchema.parse({ action: "query_week" });
    expect(parsed.action).toBe("query_week");
    expect(isReadAction(parsed)).toBe(true);
  });

  it("classifies mutations as non-read", () => {
    const parsed = assistantActionSchema.parse({ action: "log_weight", weight_kg: 69.4 });
    expect(isReadAction(parsed)).toBe(false);
  });

  it("rejects unknown action names (the whitelist is the zod schema)", () => {
    const result = assistantActionSchema.safeParse({ action: "delete_everything" });
    expect(result.success).toBe(false);
  });

  it("rejects out-of-range params", () => {
    expect(assistantActionSchema.safeParse({ action: "log_weight", weight_kg: 900 }).success).toBe(false);
    expect(assistantActionSchema.safeParse({ action: "log_meal", text: "" }).success).toBe(false);
    expect(
      assistantActionSchema.safeParse({ action: "add_pantry_item", name: "rice", quantity: -1, unit: "kg" }).success,
    ).toBe(false);
  });

  it("validates the add_recipe draft deeply", () => {
    const good = {
      action: "add_recipe",
      draft: {
        title: "Kadhai Paneer",
        servings: 2,
        is_veg: true,
        ingredients: [{ name: "paneer", grams: 200 }],
        steps: ["Fry the paneer."],
      },
    };
    expect(assistantActionSchema.safeParse(good).success).toBe(true);
    expect(
      assistantActionSchema.safeParse({
        ...good,
        draft: { ...good.draft, ingredients: [] },
      }).success,
    ).toBe(false);
  });

  it("requires at least one field on set_weigh_in_reminder", () => {
    expect(assistantActionSchema.safeParse({ action: "set_weigh_in_reminder" }).success).toBe(false);
    expect(assistantActionSchema.safeParse({ action: "set_weigh_in_reminder", time_hhmm: "07:30" }).success).toBe(true);
  });

  it("rejects non-http(s) media urls", () => {
    expect(
      assistantActionSchema.safeParse({ action: "tag_recipe_media", recipe_id: UUID, kind: "video", url: "javascript:alert(1)" })
        .success,
    ).toBe(false);
  });
});

describe("chatTurnSchema", () => {
  it("accepts a plain reply with no actions", () => {
    expect(chatTurnSchema.safeParse({ reply: "Tonight is paneer butter masala." }).success).toBe(true);
  });

  it("accepts a turn with up to 3 actions", () => {
    const turn = {
      reply: "Checking.",
      actions: [{ action: "query_today" }, { action: "query_pantry" }, { action: "query_weight" }],
    };
    expect(chatTurnSchema.safeParse(turn).success).toBe(true);
  });

  it("rejects more than 3 actions or a missing reply", () => {
    const four = { reply: "x", actions: Array.from({ length: 4 }, () => ({ action: "query_today" })) };
    expect(chatTurnSchema.safeParse(four).success).toBe(false);
    expect(chatTurnSchema.safeParse({ actions: [] }).success).toBe(false);
  });
});

describe("summarizeAction", () => {
  it("renders human card titles", () => {
    expect(summarizeAction({ action: "log_weight", weight_kg: 69.4 } as never)).toContain("69.4 kg");
    expect(summarizeAction({ action: "log_meal", text: "2 roti and dal" } as never)).toContain("2 roti and dal");
    expect(summarizeAction({ action: "send_family_message", kind: "suggestion", title: "Less oil", body: "x" } as never)).toContain(
      "the whole family",
    );
  });

  it("names the member when a family message targets one", () => {
    const text = summarizeAction({
      action: "send_family_message",
      to_member: "Member-B",
      kind: "instruction",
      title: "Prep",
      body: "x",
    } as never);
    expect(text).toContain("Member-B");
  });
});

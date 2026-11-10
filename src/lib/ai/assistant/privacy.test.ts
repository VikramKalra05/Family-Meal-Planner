import { describe, expect, it } from "vitest";
import { applyAssistantPrivacy } from "./context";

const snapshot = {
  now: { today: "2026-11-11", today_label: "Wed", time_ist: "14:05", week_start: "2026-11-09" },
  me: {
    role: "owner",
    diet: "non_veg",
    allergies: ["peanuts"],
    budget_daily: 400,
    target_weight_kg: 72,
    targets: { kcal: 2995, protein_g: 160, carbs_g: 380, fat_g: 90, fiber_g: 30 },
  },
  family: [
    { member: "Member-A", role: "member", diet: "veg", allergies: ["dairy"] },
    { member: "Member-B", role: "member", diet: "non_veg", allergies: [] },
  ],
  today_plan: [{ slot: "dinner", dish: "Dal Tadka", who: "family (shared)", kcal: 224, status: "planned" }],
  eaten_today: { kcal: 450, protein_g: 20, items: ["2 roti"] },
  pantry_sample: ["atta (5 kg)"],
  weight: { latest_kg: 78.5, trend_kg_per_week: -0.25, logs: 12 },
  unread_family_messages: 2,
};

describe("applyAssistantPrivacy", () => {
  it("returns the snapshot untouched when privacy mode is off", () => {
    expect(applyAssistantPrivacy(snapshot, false)).toBe(snapshot);
  });

  it("strips weight blocks, own allergies and target weight when on", () => {
    const s = applyAssistantPrivacy(snapshot, true);
    expect("weight" in s).toBe(false);
    const me = s.me as Record<string, unknown>;
    expect("allergies" in me).toBe(false);
    expect("target_weight_kg" in me).toBe(false);
  });

  it("keeps planning-relevant fields (targets, diet, budget) when on", () => {
    const me = applyAssistantPrivacy(snapshot, true).me as Record<string, unknown>;
    expect(me.diet).toBe("non_veg");
    expect(me.budget_daily).toBe(400);
    expect(me.targets).toEqual(snapshot.me.targets);
  });

  it("strips allergies from every family member but keeps diet", () => {
    const family = applyAssistantPrivacy(snapshot, true).family as Record<string, unknown>[];
    expect(family).toHaveLength(2);
    for (const f of family) expect("allergies" in f).toBe(false);
    expect(family[0]).toEqual({ member: "Member-A", role: "member", diet: "veg" });
  });

  it("leaves plan, intake, pantry and message-count blocks intact", () => {
    const s = applyAssistantPrivacy(snapshot, true);
    expect(s.today_plan).toEqual(snapshot.today_plan);
    expect(s.eaten_today).toEqual(snapshot.eaten_today);
    expect(s.pantry_sample).toEqual(snapshot.pantry_sample);
    expect(s.unread_family_messages).toBe(2);
    expect(s.now).toEqual(snapshot.now);
  });

  it("does not mutate the original snapshot", () => {
    applyAssistantPrivacy(snapshot, true);
    expect(snapshot.me).toHaveProperty("allergies");
    expect(snapshot.me).toHaveProperty("target_weight_kg");
    expect(snapshot).toHaveProperty("weight");
    expect(snapshot.family[0]).toHaveProperty("allergies");
  });

  it("tolerates snapshots missing optional blocks", () => {
    const minimal = { now: { today: "2026-11-11" }, me: { role: "owner" } };
    const s = applyAssistantPrivacy(minimal, true);
    expect(s).toEqual({ now: { today: "2026-11-11" }, me: { role: "owner" } });
  });
});

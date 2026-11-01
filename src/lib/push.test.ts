import { describe, expect, it } from "vitest";
import { WEIGH_IN_POLICY, istMoment, shouldSendWeighInPush } from "./push";

describe("istMoment", () => {
  it("converts a UTC instant to the IST day and wall clock", () => {
    // 2026-11-01T18:30:00Z == 2026-11-02 00:00 IST (day rolls over)
    expect(istMoment(new Date("2026-11-01T18:30:00Z"))).toEqual({ day: "2026-11-02", time: "00:00" });
    // 2026-11-01T05:15:00Z == 10:45 IST same day
    expect(istMoment(new Date("2026-11-01T05:15:00Z"))).toEqual({ day: "2026-11-01", time: "10:45" });
  });

  it("pads single-digit hours and minutes", () => {
    expect(istMoment(new Date("2026-06-15T13:05:00Z")).time).toBe("18:35");
  });
});

describe("shouldSendWeighInPush", () => {
  const base = {
    now: { day: "2026-11-01", time: "08:00" } as const,
    weighInTime: "07:30",
    loggedToday: false,
    sentToday: [] as string[],
  };

  it("sends once the chosen time has passed", () => {
    expect(shouldSendWeighInPush(base)).toBe(true);
  });

  it("waits until the chosen time", () => {
    expect(shouldSendWeighInPush({ ...base, now: { day: base.now.day, time: "07:29" } })).toBe(false);
    expect(shouldSendWeighInPush({ ...base, now: { day: base.now.day, time: "07:30" } })).toBe(true);
  });

  it("never nags on a logged day", () => {
    expect(shouldSendWeighInPush({ ...base, loggedToday: true })).toBe(false);
  });

  it("respects the per-day cap", () => {
    const sent = ["2026-11-01T04:00:00+05:30", "2026-11-01T09:00:00+05:30"];
    expect(shouldSendWeighInPush({ ...base, sentToday: sent })).toBe(false);
  });

  it("enforces the gap between nudges", () => {
    // First push 2h ago at 06:00 — gap is 4h, so no second nudge yet.
    expect(shouldSendWeighInPush({ ...base, sentToday: ["2026-11-01T06:00:00+05:30"] })).toBe(false);
    // First push 5h ago at 03:00 — gap satisfied.
    expect(shouldSendWeighInPush({ ...base, sentToday: ["2026-11-01T03:00:00+05:30"] })).toBe(true);
  });

  it("uses the shared policy of 2 per day, 4h apart", () => {
    expect(WEIGH_IN_POLICY).toEqual({ maxPerDay: 2, gapHours: 4 });
  });
});

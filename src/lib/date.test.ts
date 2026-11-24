import { describe, expect, it } from "vitest";
import {
  formatIstDate,
  isDiaryDateISO,
  istDateISO,
  istHour,
  istTimeHHMM,
  parseDateHint,
  shiftDiaryDate,
} from "@/lib/date";

describe("IST date helpers", () => {
  it("keeps the IST day after midnight local time", () => {
    // 2026-11-04 00:30 IST === 2026-11-03 19:00 UTC
    expect(istDateISO(new Date("2026-11-03T19:00:00Z"))).toBe("2026-11-04");
  });

  it("rolls to the next IST day at 18:30 UTC", () => {
    expect(istDateISO(new Date("2026-11-03T18:29:59Z"))).toBe("2026-11-03");
    expect(istDateISO(new Date("2026-11-03T18:30:00Z"))).toBe("2026-11-04");
  });

  it("returns IST wall-clock hours and time", () => {
    const t = new Date("2026-11-04T02:15:00Z"); // 07:45 IST
    expect(istHour(t)).toBe(7);
    expect(istTimeHHMM(t)).toBe("07:45");
  });

  it("formats dates on the IST calendar", () => {
    // 2026-11-03 20:00 UTC === 2026-11-04 01:30 IST
    expect(formatIstDate(new Date("2026-11-03T20:00:00Z"), { day: "numeric", month: "short" })).toBe(
      "4 Nov",
    );
  });
});

describe("isDiaryDateISO", () => {
  it("accepts real calendar days in the past, today and the future", () => {
    expect(isDiaryDateISO("2026-11-24")).toBe(true);
    expect(isDiaryDateISO("2026-11-25")).toBe(true);
    expect(isDiaryDateISO("2026-11-26")).toBe(true);
    expect(isDiaryDateISO("2026-02-28")).toBe(true);
    expect(isDiaryDateISO("2028-02-29")).toBe(true);
  });

  it("rejects impossible days and malformed values", () => {
    expect(isDiaryDateISO("2026-02-30")).toBe(false);
    expect(isDiaryDateISO("2026-13-01")).toBe(false);
    expect(isDiaryDateISO("25-11-2026")).toBe(false);
    expect(isDiaryDateISO("2026-11-25T00:00:00Z")).toBe(false);
    expect(isDiaryDateISO("")).toBe(false);
  });

  it("rejects wildly out-of-range years", () => {
    expect(isDiaryDateISO("1999-12-31")).toBe(false);
    expect(isDiaryDateISO("2101-01-01")).toBe(false);
  });
});

describe("parseDateHint", () => {
  // 2026-11-25 is a Wednesday.
  const today = "2026-11-25";

  it("shifts calendar days across month and year boundaries", () => {
    expect(shiftDiaryDate("2026-11-30", 1)).toBe("2026-12-01");
    expect(shiftDiaryDate("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDiaryDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("resolves today, yesterday and tomorrow in freeform text", () => {
    expect(parseDateHint("log my breakfast", today)).toBeNull();
    expect(parseDateHint("2 roti and dal", today)).toBeNull();
    expect(parseDateHint("log yesterday's dinner: 2 roti", today)).toBe("2026-11-24");
    expect(parseDateHint("same food tomorrow", today)).toBe("2026-11-26");
    expect(parseDateHint("log this for today", today)).toBe(today);
    expect(parseDateHint("day before yesterday", today)).toBe("2026-11-23");
    expect(parseDateHint("day after tomorrow", today)).toBe("2026-11-27");
  });

  it("resolves relative day counts", () => {
    expect(parseDateHint("3 days ago", today)).toBe("2026-11-22");
    expect(parseDateHint("2 days later", today)).toBe("2026-11-27");
    expect(parseDateHint("in 4 days", today)).toBe("2026-11-29");
  });

  it("resolves explicit ISO dates and last/next weekdays", () => {
    expect(parseDateHint("log it on 2026-11-18", today)).toBe("2026-11-18");
    expect(parseDateHint("last friday", today)).toBe("2026-11-20");
    expect(parseDateHint("next friday", today)).toBe("2026-11-27");
    // Naming today's weekday as "last" means the previous week, not today.
    expect(parseDateHint("last wednesday", today)).toBe("2026-11-18");
    expect(parseDateHint("next wednesday", today)).toBe("2026-12-02");
  });

  it("ignores impossible explicit dates", () => {
    expect(parseDateHint("on 2026-02-30", today)).toBeNull();
  });
});

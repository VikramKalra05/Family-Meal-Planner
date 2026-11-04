import { describe, expect, it } from "vitest";
import { formatIstDate, istDateISO, istHour, istTimeHHMM } from "@/lib/date";

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

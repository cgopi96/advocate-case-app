import { describe, expect, it } from "vitest";
import { istDayStart, parseDateInput, toDateKey } from "../src/lib/dates";

describe("IST dates", () => {
  it("parses a form date as midnight IST", () => {
    expect(parseDateInput("2026-10-14").toISOString()).toBe("2026-10-13T18:30:00.000Z");
  });

  it("rejects malformed dates", () => {
    expect(() => parseDateInput("14/10/2026")).toThrow();
  });

  it("uses the IST calendar day, not UTC", () => {
    // 20:00 UTC on 13 Oct is 01:30 on 14 Oct in India.
    const lateUtc = new Date("2026-10-13T20:00:00Z");
    expect(toDateKey(lateUtc)).toBe("2026-10-14");
    expect(istDayStart(lateUtc).toISOString()).toBe("2026-10-13T18:30:00.000Z");
    expect(istDayStart(lateUtc, 1).toISOString()).toBe("2026-10-14T18:30:00.000Z");
  });
});

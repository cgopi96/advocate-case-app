import { describe, expect, it } from "vitest";
import { balanceDue, financialYear, formatINR, invoiceTotals, parseRupees, toRupeeInput } from "../src/lib/money";

describe("rupee parsing", () => {
  it("reads whole and decimal rupees as paise", () => {
    expect(parseRupees("1500")).toBe(150_000);
    expect(parseRupees("1,50,000.5")).toBe(15_000_050);
    expect(parseRupees("₹ 99.99")).toBe(9_999);
  });

  it("rejects bad amounts", () => {
    for (const bad of ["", "abc", "-5", "1.234", "1e5"]) expect(() => parseRupees(bad)).toThrow();
  });

  it("round-trips to form input", () => {
    expect(toRupeeInput(150_000)).toBe("1500");
    expect(toRupeeInput(9_999)).toBe("99.99");
    expect(toRupeeInput(null)).toBe("");
  });
});

describe("invoice totals", () => {
  it("adds 18% GST rounded to the paisa", () => {
    expect(invoiceTotals([2_500_000, 333], 18)).toEqual({ subtotal: 2_500_333, gstAmount: 450_060, total: 2_950_393 });
  });

  it("supports invoices without GST", () => {
    expect(invoiceTotals([100_000], 0)).toEqual({ subtotal: 100_000, gstAmount: 0, total: 100_000 });
  });

  it("never shows a negative balance", () => {
    expect(balanceDue(1000, 1500)).toBe(0);
  });

  it("formats in Indian digit grouping", () => {
    expect(formatINR(15_000_000)).toBe("₹1,50,000.00");
  });
});

describe("financial year", () => {
  it("starts on 1 April in IST", () => {
    expect(financialYear(new Date("2026-03-31T12:00:00Z"))).toBe("2025-26");
    expect(financialYear(new Date("2026-03-31T19:00:00Z"))).toBe("2026-27"); // 00:30 IST on 1 April
    expect(financialYear(new Date("2027-01-15T00:00:00Z"))).toBe("2026-27");
  });
});

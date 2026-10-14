// Money is handled in paise (integers) to avoid floating-point rounding.

/** Parse a rupee amount typed by a user ("1,500" or "1500.50") into paise. */
export function parseRupees(input: string): number {
  const clean = input.replace(/[,\s₹]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) throw new Error("Invalid amount");
  const [whole, frac = ""] = clean.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(paise / 100);
}

/** Paise as a plain rupee string for form inputs ("1500.50"). */
export function toRupeeInput(paise: number | null | undefined): string {
  if (paise == null) return "";
  return paise % 100 === 0 ? String(paise / 100) : (paise / 100).toFixed(2);
}

export function invoiceTotals(itemAmounts: number[], gstRatePercent: number) {
  const subtotal = itemAmounts.reduce((a, b) => a + b, 0);
  const gstAmount = Math.round((subtotal * gstRatePercent) / 100);
  return { subtotal, gstAmount, total: subtotal + gstAmount };
}

/** Indian financial year label for a date in IST, e.g. "2026-27". */
export function financialYear(d: Date): string {
  const ist = new Date(d.getTime() + 5.5 * 3600_000);
  const y = ist.getUTCFullYear();
  const start = ist.getUTCMonth() >= 3 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
}

export function balanceDue(total: number, paid: number) {
  return Math.max(0, total - paid);
}

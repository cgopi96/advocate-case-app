// Dates are entered and shown in Indian Standard Time.
export const TIME_ZONE = "Asia/Kolkata";

/** Parse a yyyy-mm-dd form value as midnight IST. */
export function parseDateInput(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Invalid date");
  const d = new Date(`${value}T00:00:00+05:30`);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

/** Format a Date as yyyy-mm-dd in IST, for date inputs and grouping. */
export function toDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(d);
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(d);
}

export function formatDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Start of the IST day containing `d`, plus `days` whole days. */
export function istDayStart(d: Date, days = 0): Date {
  const start = parseDateInput(toDateKey(d));
  return new Date(start.getTime() + days * 86_400_000);
}

import "server-only";
import type { Prisma } from "@prisma/client";
import { financialYear } from "./money";

export const GST_RATES = [18, 0];

export const PAYMENT_MODE_LABELS = {
  CASH: "Cash",
  UPI: "UPI",
  BANK_TRANSFER: "Bank transfer",
  CHEQUE: "Cheque",
  CARD: "Card",
} as const;

export function firmDetails() {
  return {
    name: process.env.FIRM_NAME ?? "Your Law Office",
    address: process.env.FIRM_ADDRESS ?? "",
    gstin: process.env.FIRM_GSTIN ?? "",
  };
}

/** Next number in the financial-year series, e.g. INV/2026-27/0007. */
export async function nextInvoiceNumber(tx: Prisma.TransactionClient, issueDate: Date) {
  const prefix = `INV/${financialYear(issueDate)}/`;
  const last = await tx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  const n = last ? Number(last.number.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(4, "0")}`;
}

export function paidAmount(payments: { amount: number }[]) {
  return payments.reduce((a, p) => a + p.amount, 0);
}

export type InvoiceState = "Cancelled" | "Paid" | "Part paid" | "Unpaid";

export function invoiceState(inv: { cancelled: boolean; total: number }, paid: number): InvoiceState {
  if (inv.cancelled) return "Cancelled";
  if (paid >= inv.total) return "Paid";
  return paid > 0 ? "Part paid" : "Unpaid";
}

"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { GST_RATES, nextInvoiceNumber, paidAmount } from "@/lib/billing";
import { getAccessibleCase } from "@/lib/cases";
import { db } from "@/lib/db";
import { dateField, firstError, formObject, optionalDate, optionalText } from "@/lib/forms";
import { invoiceTotals, parseRupees } from "@/lib/money";
import { can } from "@/lib/permissions";

const MAX_ITEMS = 6;

const invoiceSchema = z.object({
  caseId: z.string().min(1, "must be selected"),
  issueDate: dateField,
  dueDate: optionalDate,
  gstRate: z.coerce.number().refine((r) => GST_RATES.includes(r), "is not allowed"),
  notes: optionalText(1000),
});

/** Read the numbered item rows, skipping blank ones. */
function readItems(form: FormData): { items: { description: string; amount: number }[] } | { error: string } {
  const items = [];
  for (let i = 0; i < MAX_ITEMS; i++) {
    const description = String(form.get(`item${i}Description`) ?? "").trim();
    const rawAmount = String(form.get(`item${i}Amount`) ?? "").trim();
    if (!description && !rawAmount) continue;
    if (!description || !rawAmount) return { error: `Line ${i + 1} needs both a description and an amount.` };
    if (description.length > 300) return { error: `Line ${i + 1} description is too long.` };
    let amount: number;
    try {
      amount = parseRupees(rawAmount);
    } catch {
      return { error: `Line ${i + 1} amount must be a number like 15000 or 1500.50.` };
    }
    if (amount <= 0) return { error: `Line ${i + 1} amount must be more than zero.` };
    items.push({ description, amount });
  }
  if (items.length === 0) return { error: "Add at least one line item." };
  return { items };
}

export async function createInvoice(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.manageBilling(user)) return { error: "You don't have permission to create invoices." };
  const parsed = invoiceSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const read = readItems(form);
  if ("error" in read) return read;
  await getAccessibleCase(parsed.data.caseId, user);
  if (parsed.data.dueDate && parsed.data.dueDate < parsed.data.issueDate) {
    return { error: "The due date can't be before the invoice date." };
  }
  const totals = invoiceTotals(
    read.items.map((i) => i.amount),
    parsed.data.gstRate,
  );

  // Two people saving at once could pick the same number; retry on a clash.
  for (let attempt = 0; attempt < 3; attempt++) {
    let invoice;
    try {
      invoice = await db.$transaction(async (tx) =>
        tx.invoice.create({
          data: {
            ...parsed.data,
            ...totals,
            number: await nextInvoiceNumber(tx, parsed.data.issueDate),
            createdById: user.id,
            items: { create: read.items.map((it, position) => ({ ...it, position })) },
          },
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") continue;
      throw e;
    }
    await audit(user.id, "create", "Invoice", invoice.id, invoice.number);
    redirect(`/billing/${invoice.id}`);
  }
  return { error: "Couldn't assign an invoice number. Please try again." };
}

const paymentSchema = z.object({
  date: dateField,
  amount: z.string().transform((v, ctx) => {
    try {
      const p = parseRupees(v);
      if (p > 0) return p;
    } catch {}
    ctx.addIssue({ code: "custom", message: "must be a number like 15000 or 1500.50" });
    return z.NEVER;
  }),
  mode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "CARD"]),
  reference: optionalText(100),
});

export async function recordPayment(invoiceId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  if (!can.manageBilling(user)) return { error: "You don't have permission to record payments." };
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return { error: "Invoice not found." };
  await getAccessibleCase(invoice.caseId, user);
  if (invoice.cancelled) return { error: "This invoice is cancelled." };
  const parsed = paymentSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const due = invoice.total - paidAmount(invoice.payments);
  if (parsed.data.amount > due) return { error: "The payment is more than the balance due." };
  const p = await db.payment.create({ data: { ...parsed.data, invoiceId, recordedById: user.id } });
  await audit(user.id, "record_payment", "Payment", p.id, `${invoice.number}: ${parsed.data.amount / 100}`);
  revalidatePath(`/billing/${invoiceId}`);
  return { nonce: Date.now() };
}

export async function cancelInvoice(invoiceId: string) {
  const user = await requireUser();
  if (!can.cancelInvoice(user)) throw new Error("Not allowed");
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
  if (!invoice) return;
  if (invoice.payments.length > 0) redirect(`/billing/${invoiceId}?error=has-payments`);
  await db.invoice.update({ where: { id: invoiceId }, data: { cancelled: true } });
  await audit(user.id, "cancel", "Invoice", invoiceId, invoice.number);
  revalidatePath(`/billing/${invoiceId}`);
}

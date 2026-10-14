import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { PrintButton } from "@/components/print-button";
import { Empty, Field } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { PAYMENT_MODE_LABELS, firmDetails, invoiceState, paidAmount } from "@/lib/billing";
import { formatDate, toDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { balanceDue, formatINR, toRupeeInput } from "@/lib/money";
import { can, canAccessCase } from "@/lib/permissions";
import { cancelInvoice, recordPayment } from "../actions";

export default async function InvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: {
      items: { orderBy: { position: "asc" } },
      payments: { include: { recordedBy: { select: { name: true } } }, orderBy: { date: "asc" } },
      case: { include: { client: true } },
    },
  });
  if (!inv || !canAccessCase(user, inv.case.advocateId)) notFound();

  const paid = paidAmount(inv.payments);
  const due = inv.cancelled ? 0 : balanceDue(inv.total, paid);
  const state = invoiceState(inv, paid);
  const firm = firmDetails();
  const client = inv.case.client;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href="/billing" className="text-sm text-slate-500 hover:underline">
          ← Billing
        </Link>
        <PrintButton />
      </div>

      <article className="card mb-6 p-8 print:border-0 print:shadow-none">
        <header className="mb-6 flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold">{firm.name}</h1>
            {firm.address && <p className="whitespace-pre-line text-sm text-slate-600">{firm.address}</p>}
            {firm.gstin && <p className="text-sm text-slate-600">GSTIN: {firm.gstin}</p>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-semibold">{inv.gstRate > 0 ? "Tax Invoice" : "Invoice"}</div>
            <div className="text-sm">{inv.number}</div>
            <div className="text-sm text-slate-600">Date: {formatDate(inv.issueDate)}</div>
            {inv.dueDate && <div className="text-sm text-slate-600">Due: {formatDate(inv.dueDate)}</div>}
            {inv.cancelled && <div className="mt-1 font-semibold text-red-600">CANCELLED</div>}
          </div>
        </header>

        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          <div>
            <div className="text-xs uppercase text-slate-500">Bill to</div>
            <div className="font-medium">{client.name}</div>
            {client.address && <div className="text-sm text-slate-600">{client.address}</div>}
            <div className="text-sm text-slate-600">{client.phone}</div>
          </div>
          <div>
            <div className="text-xs uppercase text-slate-500">Matter</div>
            <div className="font-medium">{inv.case.caseNumber}</div>
            <div className="text-sm text-slate-600">
              {inv.case.title} · {inv.case.court}
            </div>
          </div>
        </div>

        <table className="table mb-4">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Description</th>
              <th className="text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={it.id}>
                <td>{i + 1}</td>
                <td>{it.description}</td>
                <td className="text-right">{formatINR(it.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{formatINR(inv.subtotal)}</span>
          </div>
          {inv.gstRate > 0 && (
            <>
              <div className="flex justify-between text-slate-600">
                <span>CGST {inv.gstRate / 2}%</span>
                <span>{formatINR(Math.floor(inv.gstAmount / 2))}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>SGST {inv.gstRate / 2}%</span>
                <span>{formatINR(inv.gstAmount - Math.floor(inv.gstAmount / 2))}</span>
              </div>
            </>
          )}
          <div className="flex justify-between border-t pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{formatINR(inv.total)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>Paid</span>
            <span>{formatINR(paid)}</span>
          </div>
          <div className="flex justify-between font-semibold">
            <span>Balance due</span>
            <span>{formatINR(due)}</span>
          </div>
        </div>

        {inv.notes && <p className="mt-6 whitespace-pre-line text-sm text-slate-600">{inv.notes}</p>}
      </article>

      <div className="grid gap-6 print:hidden lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">
            Payments <span className="text-sm font-normal text-slate-500">· {state}</span>
          </h2>
          {inv.payments.length === 0 ? (
            <Empty>No payments yet.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {inv.payments.map((p) => (
                  <tr key={p.id}>
                    <td>{formatDate(p.date)}</td>
                    <td>
                      {PAYMENT_MODE_LABELS[p.mode]}
                      {p.reference && <div className="text-xs text-slate-500">{p.reference}</div>}
                    </td>
                    <td className="text-xs text-slate-500">{p.recordedBy.name}</td>
                    <td className="text-right">{formatINR(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {can.manageBilling(user) && !inv.cancelled && due > 0 && (
          <section className="card">
            <h2 className="mb-3 font-semibold">Record payment</h2>
            <ActionForm
              action={recordPayment.bind(null, inv.id)}
              submitLabel="Record payment"
              className="grid gap-3 sm:grid-cols-2"
              resetOnSuccess
            >
              <Field label="Date *">
                <input name="date" type="date" required defaultValue={toDateKey(new Date())} className="input" />
              </Field>
              <Field label="Amount (₹) *">
                <input name="amount" required inputMode="decimal" defaultValue={toRupeeInput(due)} className="input" />
              </Field>
              <Field label="Mode">
                <select name="mode" className="input">
                  {Object.entries(PAYMENT_MODE_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Reference (UTR, cheque no.)">
                <input name="reference" className="input" />
              </Field>
            </ActionForm>
          </section>
        )}

        {can.cancelInvoice(user) && !inv.cancelled && (
          <section className="card lg:col-span-2">
            {error === "has-payments" && (
              <p className="mb-2 text-sm text-red-600">An invoice with payments can&apos;t be cancelled.</p>
            )}
            <form action={cancelInvoice.bind(null, inv.id)}>
              <ConfirmButton message="Cancel this invoice? The number stays used.">Cancel invoice</ConfirmButton>
            </form>
          </section>
        )}
      </div>
    </>
  );
}

import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { invoiceState, paidAmount } from "@/lib/billing";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { balanceDue, formatINR } from "@/lib/money";
import { can, caseScope } from "@/lib/permissions";

const STATE_STYLES = {
  Paid: "bg-green-100 text-green-800",
  "Part paid": "bg-amber-100 text-amber-800",
  Unpaid: "bg-red-100 text-red-800",
  Cancelled: "bg-slate-200 text-slate-600",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const user = await requireUser();
  const { show } = await searchParams;
  const invoices = await db.invoice.findMany({
    where: { case: caseScope(user) },
    include: {
      payments: { select: { amount: true } },
      case: { select: { id: true, caseNumber: true, client: { select: { id: true, name: true } } } },
    },
    orderBy: { issueDate: "desc" },
    take: 500,
  });
  const rows = invoices.map((inv) => {
    const paid = paidAmount(inv.payments);
    return { inv, paid, due: inv.cancelled ? 0 : balanceDue(inv.total, paid), state: invoiceState(inv, paid) };
  });
  const active = rows.filter((r) => !r.inv.cancelled);
  const billed = active.reduce((a, r) => a + r.inv.total, 0);
  const received = active.reduce((a, r) => a + r.paid, 0);
  const outstanding = active.reduce((a, r) => a + r.due, 0);

  const byClient = new Map<string, { id: string; name: string; due: number; count: number }>();
  for (const r of active.filter((r) => r.due > 0)) {
    const c = r.inv.case.client;
    const e = byClient.get(c.id) ?? { id: c.id, name: c.name, due: 0, count: 0 };
    e.due += r.due;
    e.count++;
    byClient.set(c.id, e);
  }
  const clientDues = [...byClient.values()].sort((a, b) => b.due - a.due);
  const shown = show === "unpaid" ? rows.filter((r) => r.due > 0) : rows;

  return (
    <>
      <PageHeader
        title="Billing"
        action={can.manageBilling(user) ? { href: "/billing/new", label: "New invoice" } : undefined}
      />
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: "Billed", value: billed },
          { label: "Received", value: received },
          { label: "Outstanding", value: outstanding },
        ].map((s) => (
          <div key={s.label} className="card">
            <div className="text-2xl font-semibold">{formatINR(s.value)}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="lg:col-span-2">
          <div className="mb-2 flex gap-2 text-sm">
            <Link href="/billing" className={show === "unpaid" ? "btn" : "btn-primary"}>
              All invoices
            </Link>
            <Link href="/billing?show=unpaid" className={show === "unpaid" ? "btn-primary" : "btn"}>
              With balance due
            </Link>
          </div>
          <div className="card overflow-x-auto p-0">
            {shown.length === 0 ? (
              <Empty>No invoices.</Empty>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Client / case</th>
                    <th className="text-right">Total</th>
                    <th className="text-right">Due</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map(({ inv, due, state }) => (
                    <tr key={inv.id}>
                      <td>
                        <Link href={`/billing/${inv.id}`} className="link whitespace-nowrap">
                          {inv.number}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                      <td>
                        {inv.case.client.name}
                        <div className="text-xs text-slate-500">{inv.case.caseNumber}</div>
                      </td>
                      <td className="text-right">{formatINR(inv.total)}</td>
                      <td className="text-right">{due ? formatINR(due) : "—"}</td>
                      <td>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATE_STYLES[state]}`}>
                          {state}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>

        <section className="card h-fit">
          <h2 className="mb-3 font-semibold">Outstanding by client</h2>
          {clientDues.length === 0 ? (
            <Empty>Nothing outstanding.</Empty>
          ) : (
            <table className="table">
              <tbody>
                {clientDues.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/clients/${c.id}`} className="link">
                        {c.name}
                      </Link>
                      <div className="text-xs text-slate-500">{c.count} invoice(s)</div>
                    </td>
                    <td className="text-right font-medium">{formatINR(c.due)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}

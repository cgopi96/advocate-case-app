import { redirect } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { Field, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GST_RATES } from "@/lib/billing";
import { toDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { toRupeeInput } from "@/lib/money";
import { can, caseScope } from "@/lib/permissions";
import { createInvoice } from "../actions";

const LINES = 6;

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ caseId?: string }>;
}) {
  const user = await requireUser();
  if (!can.manageBilling(user)) redirect("/billing");
  const { caseId } = await searchParams;
  const cases = await db.case.findMany({
    where: { ...caseScope(user), status: { not: "CLOSED" } },
    select: { id: true, caseNumber: true, agreedFee: true, client: { select: { name: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const selected = cases.find((c) => c.id === caseId);

  return (
    <>
      <PageHeader title="New invoice" />
      <div className="card">
        <ActionForm action={createInvoice} submitLabel="Create invoice">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Case *" className="sm:col-span-2">
              <select name="caseId" required defaultValue={selected?.id ?? ""} className="input">
                <option value="" disabled>
                  Select…
                </option>
                {cases.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.caseNumber} · {c.client.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Invoice date *">
              <input name="issueDate" type="date" required defaultValue={toDateKey(new Date())} className="input" />
            </Field>
            <Field label="Due date">
              <input name="dueDate" type="date" className="input" />
            </Field>
            <Field label="GST">
              <select name="gstRate" defaultValue="18" className="input">
                {GST_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "No GST (0%)" : `GST ${r}%`}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <fieldset>
            <legend className="label">Line items (amounts in ₹, before GST)</legend>
            <div className="space-y-2">
              {Array.from({ length: LINES }, (_, i) => (
                <div key={i} className="grid grid-cols-[1fr_9rem] gap-2">
                  <input
                    name={`item${i}Description`}
                    aria-label={`Line ${i + 1} description`}
                    placeholder={i === 0 ? "Professional fees" : ""}
                    defaultValue={i === 0 && selected?.agreedFee ? "Professional fees" : ""}
                    className="input"
                  />
                  <input
                    name={`item${i}Amount`}
                    aria-label={`Line ${i + 1} amount`}
                    inputMode="decimal"
                    placeholder={i === 0 ? "25000" : ""}
                    defaultValue={i === 0 ? toRupeeInput(selected?.agreedFee) : ""}
                    className="input text-right"
                  />
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-slate-500">Leave unused lines blank.</p>
          </fieldset>

          <Field label="Notes (shown on the invoice)">
            <textarea name="notes" rows={2} placeholder="Bank details, payment terms…" className="input" />
          </Field>
        </ActionForm>
      </div>
    </>
  );
}

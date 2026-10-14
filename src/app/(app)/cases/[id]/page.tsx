import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Empty, Field, STATUS_LABELS, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getAccessibleCase, listAdvocates } from "@/lib/cases";
import { formatDate, istDayStart, toDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import {
  addFollowUp,
  addHearing,
  deleteCase,
  deleteDocument,
  deleteHearing,
  recordOutcome,
  toggleFollowUp,
  updateCase,
  uploadDocument,
} from "../actions";
import { CaseFields } from "../case-fields";

const DOC_TYPES = ["Petition", "Order", "Judgment", "Evidence", "Affidavit", "Vakalat", "Correspondence", "Other"];
const FOLLOW_UP_LABELS = { CALL: "Call", MEETING: "Meeting", TASK: "Task" } as const;

export default async function CasePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  await getAccessibleCase(id, user);

  const [c, clients, advocates, users] = await Promise.all([
    db.case.findUniqueOrThrow({
      where: { id },
      include: {
        client: true,
        advocate: { select: { name: true } },
        hearings: { orderBy: { date: "desc" } },
        followUps: { include: { owner: { select: { name: true } } }, orderBy: [{ done: "asc" }, { dueDate: "asc" }] },
        documents: { include: { uploadedBy: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
      },
    }),
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listAdvocates(),
    db.user.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const today = istDayStart(new Date());

  return (
    <>
      <div className="mb-6">
        <Link href="/cases" className="text-sm text-slate-500 hover:underline">
          ← Cases
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">{c.caseNumber}</h1>
          <StatusBadge status={c.status} />
        </div>
        <p className="text-slate-600">
          {c.title} · {c.court} · {c.caseType}
        </p>
        <p className="text-sm text-slate-500">
          Client:{" "}
          <Link href={`/clients/${c.client.id}`} className="link">
            {c.client.name}
          </Link>{" "}
          ({c.client.phone}) · Advocate: {c.advocate?.name ?? "Unassigned"}
          {c.stage && <> · Stage: {c.stage}</>}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Hearings</h2>
          {c.hearings.length === 0 ? (
            <Empty>No hearings yet.</Empty>
          ) : (
            <ul className="divide-y">
              {c.hearings.map((h) => (
                <li key={h.id} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <span className="font-medium">{formatDate(h.date)}</span>
                      <span className="text-slate-600"> · {h.purpose}</span>
                      {h.date >= today && !h.outcome && (
                        <span className="ml-2 rounded bg-indigo-50 px-1.5 text-xs text-indigo-700">Upcoming</span>
                      )}
                    </div>
                    {can.deleteCase(user) && (
                      <form action={deleteHearing.bind(null, h.id)}>
                        <ConfirmButton message="Delete this hearing?" className="text-xs text-red-600 hover:underline">
                          Delete
                        </ConfirmButton>
                      </form>
                    )}
                  </div>
                  {h.outcome ? (
                    <p className="mt-1 text-sm text-slate-700">
                      Outcome: {h.outcome}
                      {h.nextDate && <> · Next date {formatDate(h.nextDate)}</>}
                    </p>
                  ) : (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm text-indigo-700">Record outcome</summary>
                      <ActionForm
                        action={recordOutcome.bind(null, h.id)}
                        submitLabel="Save outcome"
                        className="mt-2 grid gap-3 sm:grid-cols-2"
                      >
                        <Field label="Outcome *" className="sm:col-span-2">
                          <textarea name="outcome" required rows={2} className="input" />
                        </Field>
                        <Field label="Next hearing date">
                          <input name="nextDate" type="date" className="input" />
                        </Field>
                        <Field label="Next hearing purpose">
                          <input name="nextPurpose" placeholder="Arguments" className="input" />
                        </Field>
                        <Field label="Case status">
                          <select name="status" defaultValue={c.status} className="input">
                            {Object.entries(STATUS_LABELS).map(([k, label]) => (
                              <option key={k} value={k}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </Field>
                      </ActionForm>
                    </details>
                  )}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium text-indigo-700">Add hearing</summary>
            <ActionForm
              action={addHearing.bind(null, c.id)}
              submitLabel="Add hearing"
              className="mt-2 grid gap-3 sm:grid-cols-2"
              resetOnSuccess
            >
              <Field label="Date *">
                <input name="date" type="date" required className="input" />
              </Field>
              <Field label="Purpose *">
                <input name="purpose" required placeholder="Evidence" className="input" />
              </Field>
            </ActionForm>
          </details>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Follow-ups</h2>
          {c.followUps.length === 0 ? (
            <Empty>No follow-ups yet.</Empty>
          ) : (
            <ul className="divide-y">
              {c.followUps.map((f) => (
                <li key={f.id} className="flex items-start gap-3 py-2">
                  <form action={toggleFollowUp.bind(null, f.id)}>
                    <button
                      aria-label={f.done ? "Mark as not done" : "Mark as done"}
                      className={`mt-0.5 h-5 w-5 rounded border ${f.done ? "border-green-600 bg-green-600 text-white" : "border-slate-400"}`}
                    >
                      {f.done ? "✓" : ""}
                    </button>
                  </form>
                  <div className={f.done ? "text-slate-400 line-through" : ""}>
                    <div className="text-sm">{f.notes}</div>
                    <div className={`text-xs ${!f.done && f.dueDate < today ? "font-medium text-red-600" : "text-slate-500"}`}>
                      {FOLLOW_UP_LABELS[f.type]} · due {formatDate(f.dueDate)} · {f.owner.name}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium text-indigo-700">Add follow-up</summary>
            <ActionForm
              action={addFollowUp.bind(null, c.id)}
              submitLabel="Add follow-up"
              className="mt-2 grid gap-3 sm:grid-cols-2"
              resetOnSuccess
            >
              <Field label="Type">
                <select name="type" className="input">
                  {Object.entries(FOLLOW_UP_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Due date *">
                <input name="dueDate" type="date" required defaultValue={toDateKey(new Date())} className="input" />
              </Field>
              <Field label="Owner">
                <select name="ownerId" defaultValue={user.id} className="input">
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Notes *" className="sm:col-span-2">
                <textarea name="notes" required rows={2} className="input" />
              </Field>
            </ActionForm>
          </details>
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Documents</h2>
          {c.documents.length === 0 ? (
            <Empty>No documents yet.</Empty>
          ) : (
            <ul className="divide-y">
              {c.documents.map((d) => (
                <li key={d.id} className="flex items-start justify-between gap-2 py-2">
                  <div>
                    <a href={`/api/documents/${d.id}`} className="link text-sm" target="_blank" rel="noopener">
                      {d.name}
                    </a>
                    <div className="text-xs text-slate-500">
                      {d.docType} · {Math.max(1, Math.round(d.size / 1024))} KB · {d.uploadedBy.name} · {formatDate(d.createdAt)}
                    </div>
                  </div>
                  {can.deleteDocument(user) && (
                    <form action={deleteDocument.bind(null, d.id)}>
                      <ConfirmButton message="Delete this document?" className="text-xs text-red-600 hover:underline">
                        Delete
                      </ConfirmButton>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
          <details className="mt-3 border-t pt-3">
            <summary className="cursor-pointer text-sm font-medium text-indigo-700">Upload document</summary>
            <ActionForm
              action={uploadDocument.bind(null, c.id)}
              submitLabel="Upload"
              className="mt-2 grid gap-3 sm:grid-cols-2"
              resetOnSuccess
            >
              <Field label="Name *">
                <input name="name" required className="input" />
              </Field>
              <Field label="Type *">
                <select name="docType" className="input">
                  {DOC_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </Field>
              <Field label="File * (PDF, JPG, PNG, DOC, DOCX up to 10 MB)" className="sm:col-span-2">
                <input name="file" type="file" required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="input" />
              </Field>
            </ActionForm>
          </details>
        </section>

        <section className="card lg:col-span-2">
          <details>
            <summary className="cursor-pointer font-semibold">Edit case details</summary>
            <div className="mt-3">
              <ActionForm action={updateCase.bind(null, c.id)} submitLabel="Save changes">
                <CaseFields value={c} clients={clients} advocates={advocates} canAssign={can.assignCase(user)} />
              </ActionForm>
            </div>
          </details>
          {can.deleteCase(user) && (
            <form action={deleteCase.bind(null, c.id)} className="mt-4 border-t pt-4">
              <ConfirmButton message="Delete this case and all its hearings, follow-ups and documents?">
                Delete case
              </ConfirmButton>
            </form>
          )}
        </section>
      </div>
    </>
  );
}

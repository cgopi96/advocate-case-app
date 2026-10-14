import type { CaseStatus, Prisma } from "@prisma/client";
import Link from "next/link";
import { Empty, PageHeader, STATUS_LABELS, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/dates";
import { db } from "@/lib/db";
import { caseScope } from "@/lib/permissions";

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const user = await requireUser();
  const { q = "", status = "" } = await searchParams;
  const where: Prisma.CaseWhereInput = { ...caseScope(user) };
  if (status in STATUS_LABELS) where.status = status as CaseStatus;
  if (q) {
    where.OR = [
      { caseNumber: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { court: { contains: q, mode: "insensitive" } },
      { client: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  const now = new Date();
  const cases = await db.case.findMany({
    where,
    include: {
      client: { select: { name: true } },
      advocate: { select: { name: true } },
      hearings: { where: { date: { gte: now } }, orderBy: { date: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Cases" action={{ href: "/cases/new", label: "New case" }} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={q} placeholder="Search number, title, court or client" className="input max-w-sm" />
        <select name="status" defaultValue={status} className="input w-auto">
          <option value="">All statuses</option>
          {Object.entries(STATUS_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {cases.length === 0 ? (
          <Empty>No cases found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Case</th>
                <th>Client</th>
                <th>Court</th>
                <th>Advocate</th>
                <th>Next hearing</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/cases/${c.id}`} className="link">
                      {c.caseNumber}
                    </Link>
                    <div className="text-xs text-slate-500">{c.title}</div>
                  </td>
                  <td>{c.client.name}</td>
                  <td>{c.court}</td>
                  <td>{c.advocate?.name ?? "—"}</td>
                  <td>{formatDate(c.hearings[0]?.date) || "—"}</td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, istDayStart } from "@/lib/dates";
import { db } from "@/lib/db";
import { caseScope } from "@/lib/permissions";
import { toggleFollowUp } from "../cases/actions";

export default async function FollowUpsPage({
  searchParams,
}: {
  searchParams: Promise<{ mine?: string }>;
}) {
  const user = await requireUser();
  const { mine } = await searchParams;
  const today = istDayStart(new Date());
  const followUps = await db.followUp.findMany({
    where: { done: false, case: caseScope(user), ...(mine ? { ownerId: user.id } : {}) },
    include: { case: { select: { id: true, caseNumber: true, title: true } }, owner: { select: { name: true } } },
    orderBy: { dueDate: "asc" },
    take: 300,
  });

  return (
    <>
      <PageHeader title="Open follow-ups" />
      <div className="mb-4 flex gap-2 text-sm">
        <Link href="/follow-ups" className={mine ? "btn" : "btn-primary"}>
          All
        </Link>
        <Link href="/follow-ups?mine=1" className={mine ? "btn-primary" : "btn"}>
          Mine
        </Link>
      </div>
      <div className="card overflow-x-auto p-0">
        {followUps.length === 0 ? (
          <Empty>No open follow-ups.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Due</th>
                <th>Case</th>
                <th>Notes</th>
                <th>Owner</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((f) => (
                <tr key={f.id}>
                  <td className={f.dueDate < today ? "font-medium text-red-600" : ""}>{formatDate(f.dueDate)}</td>
                  <td>
                    <Link href={`/cases/${f.case.id}`} className="link">
                      {f.case.caseNumber}
                    </Link>
                  </td>
                  <td>{f.notes}</td>
                  <td>{f.owner.name}</td>
                  <td>
                    <form action={toggleFollowUp.bind(null, f.id)}>
                      <button className="btn">Mark done</button>
                    </form>
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

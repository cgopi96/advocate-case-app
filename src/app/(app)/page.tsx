import Link from "next/link";
import { Empty } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate, istDayStart } from "@/lib/dates";
import { db } from "@/lib/db";
import { caseScope } from "@/lib/permissions";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const user = await requireUser();
  const { denied } = await searchParams;
  const scope = caseScope(user);
  const today = istDayStart(new Date());
  const tomorrow = istDayStart(new Date(), 1);
  const weekEnd = istDayStart(new Date(), 8);

  const [todays, upcoming, overdue, openCases] = await Promise.all([
    db.hearing.findMany({
      where: { date: { gte: today, lt: tomorrow }, case: scope },
      include: { case: { include: { client: { select: { name: true } } } } },
      orderBy: { date: "asc" },
    }),
    db.hearing.findMany({
      where: { date: { gte: tomorrow, lt: weekEnd }, case: scope },
      include: { case: { select: { id: true, caseNumber: true, court: true } } },
      orderBy: { date: "asc" },
    }),
    db.followUp.findMany({
      where: { done: false, dueDate: { lt: tomorrow }, case: scope },
      include: { case: { select: { id: true, caseNumber: true } }, owner: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 50,
    }),
    db.case.count({ where: { ...scope, status: { in: ["OPEN", "ADJOURNED", "RESERVED"] } } }),
  ]);

  const stats = [
    { label: "Hearings today", value: todays.length },
    { label: "Hearings in next 7 days", value: upcoming.length },
    { label: "Follow-ups due or overdue", value: overdue.length },
    { label: "Active cases", value: openCases },
  ];

  return (
    <>
      {denied && (
        <p className="mb-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          You don&apos;t have permission to open that page.
        </p>
      )}
      <h1 className="mb-4 text-2xl font-semibold">Good day, {user.name}</h1>
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card">
            <div className="text-3xl font-semibold">{s.value}</div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Today&apos;s hearings</h2>
          {todays.length === 0 ? (
            <Empty>No hearings today.</Empty>
          ) : (
            <ul className="divide-y">
              {todays.map((h) => (
                <li key={h.id} className="py-2">
                  <Link href={`/cases/${h.case.id}`} className="link font-medium">
                    {h.case.caseNumber}
                  </Link>{" "}
                  · {h.case.client.name}
                  <div className="text-sm text-slate-500">
                    {h.case.court} · {h.purpose}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card">
          <h2 className="mb-3 font-semibold">Follow-ups due</h2>
          {overdue.length === 0 ? (
            <Empty>Nothing due. Well done.</Empty>
          ) : (
            <ul className="divide-y">
              {overdue.map((f) => (
                <li key={f.id} className="py-2">
                  <div className="text-sm">{f.notes}</div>
                  <div className={`text-xs ${f.dueDate < today ? "text-red-600" : "text-slate-500"}`}>
                    <Link href={`/cases/${f.case.id}`} className="link">
                      {f.case.caseNumber}
                    </Link>{" "}
                    · due {formatDate(f.dueDate)} · {f.owner.name}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="card lg:col-span-2">
          <h2 className="mb-3 font-semibold">Next 7 days</h2>
          {upcoming.length === 0 ? (
            <Empty>No hearings in the next 7 days.</Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Case</th>
                  <th>Court</th>
                  <th>Purpose</th>
                </tr>
              </thead>
              <tbody>
                {upcoming.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.date)}</td>
                    <td>
                      <Link href={`/cases/${h.case.id}`} className="link">
                        {h.case.caseNumber}
                      </Link>
                    </td>
                    <td>{h.case.court}</td>
                    <td>{h.purpose}</td>
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

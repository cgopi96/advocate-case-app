import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { parseDateInput, toDateKey } from "@/lib/dates";
import { db } from "@/lib/db";
import { caseScope } from "@/lib/permissions";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function monthKey(year: number, month: number) {
  const d = new Date(Date.UTC(year, month, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month } = await searchParams;
  const current = /^\d{4}-\d{2}$/.test(month ?? "") ? month! : toDateKey(new Date()).slice(0, 7);
  const [year, mon] = current.split("-").map(Number);
  const first = parseDateInput(`${current}-01`);
  const next = parseDateInput(`${monthKey(year, mon)}-01`);
  const daysInMonth = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const leading = (new Date(Date.UTC(year, mon - 1, 1)).getUTCDay() + 6) % 7;

  const hearings = await db.hearing.findMany({
    where: { date: { gte: first, lt: next }, case: caseScope(user) },
    include: { case: { select: { id: true, caseNumber: true } } },
    orderBy: { date: "asc" },
  });
  const byDay = new Map<string, typeof hearings>();
  for (const h of hearings) {
    const k = toDateKey(h.date);
    byDay.set(k, [...(byDay.get(k) ?? []), h]);
  }
  const todayKey = toDateKey(new Date());
  const title = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, mon - 1, 1)),
  );

  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{title}</h1>
        <div className="flex gap-2">
          <Link href={`/calendar?month=${monthKey(year, mon - 2)}`} className="btn">
            ← Previous
          </Link>
          <Link href="/calendar" className="btn">
            Today
          </Link>
          <Link href={`/calendar?month=${monthKey(year, mon)}`} className="btn">
            Next →
          </Link>
        </div>
      </div>
      <div className="card overflow-x-auto p-0">
        <div className="grid min-w-[700px] grid-cols-7">
          {WEEKDAYS.map((d) => (
            <div key={d} className="border-b bg-slate-50 px-2 py-1 text-xs font-medium text-slate-500">
              {d}
            </div>
          ))}
          {cells.map((day, i) => {
            const key = day ? `${current}-${String(day).padStart(2, "0")}` : `blank-${i}`;
            const items = day ? (byDay.get(key) ?? []) : [];
            return (
              <div key={key} className="min-h-24 border-b border-r p-1.5">
                {day && (
                  <div className={`mb-1 text-xs ${key === todayKey ? "font-bold text-indigo-700" : "text-slate-500"}`}>
                    {day}
                  </div>
                )}
                {items.map((h) => (
                  <Link
                    key={h.id}
                    href={`/cases/${h.case.id}`}
                    className="mb-1 block truncate rounded bg-indigo-50 px-1 text-xs text-indigo-800 hover:bg-indigo-100"
                    title={`${h.case.caseNumber} · ${h.purpose}`}
                  >
                    {h.case.caseNumber}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

import { Empty, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ userId?: string }>;
}) {
  await requireRole("ADMIN");
  const { userId = "" } = await searchParams;
  const [users, logs] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.auditLog.findMany({
      where: userId ? { userId } : undefined,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 300,
    }),
  ]);

  return (
    <>
      <PageHeader title="Audit log" />
      <form className="mb-4 flex gap-2">
        <select name="userId" defaultValue={userId} className="input w-auto">
          <option value="">All users</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button className="btn">Filter</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {logs.length === 0 ? (
          <Empty>No activity yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Record</th>
                <th>Details</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td>{l.user?.name ?? "—"}</td>
                  <td>{l.action.replace(/_/g, " ")}</td>
                  <td>{l.entity}</td>
                  <td className="max-w-xs truncate">{l.details}</td>
                  <td className="text-xs text-slate-500">{l.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

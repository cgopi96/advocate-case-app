import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { caseScope } from "@/lib/permissions";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireUser();
  const { q = "" } = await searchParams;
  const clients = await db.client.findMany({
    where: q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { cases: { where: caseScope(user) } } } },
    orderBy: { name: "asc" },
    take: 200,
  });

  return (
    <>
      <PageHeader title="Clients" action={{ href: "/clients/new", label: "New client" }} />
      <form className="mb-4 flex gap-2">
        <input name="q" defaultValue={q} placeholder="Search name, phone or email" className="input max-w-sm" />
        <button className="btn">Search</button>
      </form>
      <div className="card overflow-x-auto p-0">
        {clients.length === 0 ? (
          <Empty>No clients found.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Email</th>
                <th>Cases</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/clients/${c.id}`} className="link">
                      {c.name}
                    </Link>
                  </td>
                  <td>{c.phone}</td>
                  <td>{c.email}</td>
                  <td>{c._count.cases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

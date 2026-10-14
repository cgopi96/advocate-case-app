import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { ConfirmButton } from "@/components/confirm-button";
import { Empty, PageHeader, StatusBadge } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { can, caseScope } from "@/lib/permissions";
import { deleteClient, updateClient } from "../actions";
import { ClientFields } from "../client-fields";

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { error } = await searchParams;
  const client = await db.client.findUnique({
    where: { id },
    include: { cases: { where: caseScope(user), orderBy: { updatedAt: "desc" } } },
  });
  if (!client) notFound();

  return (
    <>
      <PageHeader title={client.name} action={{ href: `/cases/new?clientId=${client.id}`, label: "New case" }} />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="mb-3 font-semibold">Details</h2>
          <ActionForm action={updateClient.bind(null, client.id)} submitLabel="Save changes">
            <ClientFields client={client} />
          </ActionForm>
          {can.deleteClient(user) && (
            <form action={deleteClient.bind(null, client.id)} className="mt-4 border-t pt-4">
              {error === "has-cases" && (
                <p className="mb-2 text-sm text-red-600">Delete or move this client&apos;s cases first.</p>
              )}
              <ConfirmButton message="Delete this client permanently?">Delete client</ConfirmButton>
            </form>
          )}
        </section>
        <section className="card">
          <h2 className="mb-3 font-semibold">Cases</h2>
          {client.cases.length === 0 ? (
            <Empty>No cases yet.</Empty>
          ) : (
            <ul className="divide-y">
              {client.cases.map((c) => (
                <li key={c.id} className="flex items-center justify-between py-2">
                  <Link href={`/cases/${c.id}`} className="link">
                    {c.caseNumber} · {c.title}
                  </Link>
                  <StatusBadge status={c.status} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

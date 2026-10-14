import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { listAdvocates } from "@/lib/cases";
import { db } from "@/lib/db";
import { can } from "@/lib/permissions";
import { createCase } from "../actions";
import { CaseFields } from "../case-fields";

export default async function NewCasePage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const user = await requireUser();
  const { clientId } = await searchParams;
  const [clients, advocates] = await Promise.all([
    db.client.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    listAdvocates(),
  ]);

  return (
    <>
      <PageHeader title="New case" />
      <div className="card">
        {clients.length === 0 ? (
          <p className="text-sm">
            Add a client first. <Link href="/clients/new" className="link">New client</Link>
          </p>
        ) : (
          <ActionForm action={createCase} submitLabel="Create case">
            <CaseFields
              clients={clients}
              advocates={advocates}
              canAssign={can.assignCase(user)}
              defaultClientId={clientId}
            />
          </ActionForm>
        )}
      </div>
    </>
  );
}

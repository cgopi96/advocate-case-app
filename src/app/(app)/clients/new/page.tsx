import { ActionForm } from "@/components/action-form";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { createClient } from "../actions";
import { ClientFields } from "../client-fields";

export default async function NewClientPage() {
  await requireUser();
  return (
    <>
      <PageHeader title="New client" />
      <div className="card">
        <ActionForm action={createClient} submitLabel="Create client">
          <ClientFields />
        </ActionForm>
      </div>
    </>
  );
}

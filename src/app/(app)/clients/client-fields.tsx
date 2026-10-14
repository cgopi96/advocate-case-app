import type { Client } from "@prisma/client";
import { Field } from "@/components/ui";

export function ClientFields({ client }: { client?: Client }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Name *">
        <input name="name" required defaultValue={client?.name} className="input" />
      </Field>
      <Field label="Phone *">
        <input name="phone" required defaultValue={client?.phone} className="input" />
      </Field>
      <Field label="Email">
        <input name="email" type="email" defaultValue={client?.email ?? ""} className="input" />
      </Field>
      <Field label="Address">
        <input name="address" defaultValue={client?.address ?? ""} className="input" />
      </Field>
      <Field label="Notes" className="sm:col-span-2">
        <textarea name="notes" rows={3} defaultValue={client?.notes ?? ""} className="input" />
      </Field>
    </div>
  );
}

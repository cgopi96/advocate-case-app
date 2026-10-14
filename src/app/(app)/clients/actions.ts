"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { firstError, formObject, ok, optionalText, phone, requiredText } from "@/lib/forms";
import { can } from "@/lib/permissions";

const clientSchema = z.object({
  name: requiredText(),
  phone,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => v || null)
    .pipe(z.string().email().nullable()),
  address: optionalText(500),
  notes: optionalText(2000),
});

export async function createClient(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const client = await db.client.create({ data: parsed.data });
  await audit(user.id, "create", "Client", client.id, client.name);
  redirect(`/clients/${client.id}`);
}

export async function updateClient(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = clientSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  await db.client.update({ where: { id }, data: parsed.data });
  await audit(user.id, "update", "Client", id);
  revalidatePath(`/clients/${id}`);
  return ok();
}

export async function deleteClient(id: string) {
  const user = await requireUser();
  if (!can.deleteClient(user)) throw new Error("Not allowed");
  const caseCount = await db.case.count({ where: { clientId: id } });
  if (caseCount > 0) redirect(`/clients/${id}?error=has-cases`);
  await db.client.delete({ where: { id } });
  await audit(user.id, "delete", "Client", id);
  redirect("/clients");
}

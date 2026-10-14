"use server";

import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { getAccessibleCase } from "@/lib/cases";
import { db } from "@/lib/db";
import { dateField, firstError, formObject, ok, optionalDate, optionalText, requiredText } from "@/lib/forms";
import { parseRupees } from "@/lib/money";
import { assignableAdvocateId, can } from "@/lib/permissions";
import { ALLOWED_TYPES, MAX_UPLOAD_BYTES, deleteStoredFile, saveFile, sniffMatches } from "@/lib/storage";

const caseSchema = z.object({
  caseNumber: requiredText(100),
  title: requiredText(200),
  court: requiredText(200),
  caseType: requiredText(50),
  opposingParty: optionalText(200),
  filingDate: optionalDate,
  stage: optionalText(100),
  agreedFee: z
    .string()
    .optional()
    .transform((v, ctx) => {
      if (!v?.trim()) return null;
      try {
        return parseRupees(v);
      } catch {
        ctx.addIssue({ code: "custom", message: "must be a number like 25000" });
        return z.NEVER;
      }
    }),
  status: z.enum(["OPEN", "ADJOURNED", "RESERVED", "DISPOSED", "CLOSED"]),
  clientId: z.string().min(1, "must be selected"),
  advocateId: z
    .string()
    .optional()
    .transform((v) => v || null),
});

function duplicateCase(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

async function validAdvocate(id: string | null) {
  if (!id) return true;
  const u = await db.user.findUnique({ where: { id } });
  return !!u && u.active && u.role !== "CLERK";
}

export async function createCase(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = caseSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const advocateId = assignableAdvocateId(user, parsed.data.advocateId);
  if (!(await validAdvocate(advocateId))) return { error: "Choose a valid advocate." };
  let id: string;
  try {
    const created = await db.case.create({ data: { ...parsed.data, advocateId } });
    id = created.id;
  } catch (e) {
    if (duplicateCase(e)) return { error: "A case with this number already exists in this court." };
    throw e;
  }
  await audit(user.id, "create", "Case", id, parsed.data.caseNumber);
  redirect(`/cases/${id}`);
}

export async function updateCase(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const existing = await getAccessibleCase(id, user);
  const parsed = caseSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const advocateId = can.assignCase(user) ? parsed.data.advocateId : existing.advocateId;
  if (!(await validAdvocate(advocateId))) return { error: "Choose a valid advocate." };
  try {
    await db.case.update({ where: { id }, data: { ...parsed.data, advocateId } });
  } catch (e) {
    if (duplicateCase(e)) return { error: "A case with this number already exists in this court." };
    throw e;
  }
  await audit(user.id, "update", "Case", id);
  revalidatePath(`/cases/${id}`);
  return ok();
}

export async function deleteCase(id: string) {
  const user = await requireUser();
  if (!can.deleteCase(user)) throw new Error("Not allowed");
  await getAccessibleCase(id, user);
  const docs = await db.document.findMany({ where: { caseId: id }, select: { storageKey: true } });
  await db.case.delete({ where: { id } });
  await Promise.all(docs.map((d) => deleteStoredFile(d.storageKey)));
  await audit(user.id, "delete", "Case", id);
  redirect("/cases");
}

// Hearings

const hearingSchema = z.object({
  date: dateField,
  purpose: requiredText(200),
});

export async function addHearing(caseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  await getAccessibleCase(caseId, user);
  const parsed = hearingSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const h = await db.hearing.create({ data: { caseId, ...parsed.data } });
  await audit(user.id, "create", "Hearing", h.id);
  revalidatePath(`/cases/${caseId}`);
  return ok();
}

const outcomeSchema = z.object({
  outcome: requiredText(1000),
  nextDate: optionalDate,
  nextPurpose: optionalText(200),
  status: z.enum(["OPEN", "ADJOURNED", "RESERVED", "DISPOSED", "CLOSED"]),
});

/** Record what happened at a hearing; a next date schedules the next hearing. */
export async function recordOutcome(hearingId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const hearing = await db.hearing.findUnique({ where: { id: hearingId } });
  if (!hearing) return { error: "Hearing not found." };
  await getAccessibleCase(hearing.caseId, user);
  const parsed = outcomeSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const { outcome, nextDate, nextPurpose, status } = parsed.data;
  if (nextDate && nextDate <= hearing.date) return { error: "The next date must be after this hearing." };

  await db.$transaction([
    db.hearing.update({ where: { id: hearingId }, data: { outcome, nextDate } }),
    db.case.update({ where: { id: hearing.caseId }, data: { status } }),
    ...(nextDate
      ? [db.hearing.create({ data: { caseId: hearing.caseId, date: nextDate, purpose: nextPurpose ?? "Next hearing" } })]
      : []),
  ]);
  await audit(user.id, "record_outcome", "Hearing", hearingId);
  revalidatePath(`/cases/${hearing.caseId}`);
  return ok();
}

export async function deleteHearing(hearingId: string) {
  const user = await requireUser();
  if (!can.deleteCase(user)) throw new Error("Not allowed");
  const hearing = await db.hearing.delete({ where: { id: hearingId } });
  await audit(user.id, "delete", "Hearing", hearingId);
  revalidatePath(`/cases/${hearing.caseId}`);
}

// Follow-ups

const followUpSchema = z.object({
  type: z.enum(["CALL", "MEETING", "TASK"]),
  dueDate: dateField,
  notes: requiredText(1000),
  ownerId: z.string().min(1, "must be selected"),
});

export async function addFollowUp(caseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  await getAccessibleCase(caseId, user);
  const parsed = followUpSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const owner = await db.user.findUnique({ where: { id: parsed.data.ownerId } });
  if (!owner?.active) return { error: "Choose an active owner." };
  const f = await db.followUp.create({ data: { caseId, ...parsed.data } });
  await audit(user.id, "create", "FollowUp", f.id);
  revalidatePath(`/cases/${caseId}`);
  return ok();
}

export async function toggleFollowUp(id: string) {
  const user = await requireUser();
  const f = await db.followUp.findUnique({ where: { id } });
  if (!f) return;
  await getAccessibleCase(f.caseId, user);
  await db.followUp.update({ where: { id }, data: { done: !f.done } });
  await audit(user.id, f.done ? "reopen" : "complete", "FollowUp", id);
  revalidatePath(`/cases/${f.caseId}`);
  revalidatePath("/follow-ups");
  revalidatePath("/");
}

// Documents

const documentSchema = z.object({
  name: requiredText(200),
  docType: requiredText(50),
});

export async function uploadDocument(caseId: string, _prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  await getAccessibleCase(caseId, user);
  const parsed = documentSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a file to upload." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Files must be 10 MB or smaller." };
  if (!ALLOWED_TYPES[file.type]) return { error: "Only PDF, JPG, PNG, DOC and DOCX files are allowed." };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!sniffMatches(file.type, bytes)) return { error: "The file content doesn't match its type." };

  const storageKey = await saveFile(file.type, bytes);
  const doc = await db.document.create({
    data: {
      caseId,
      ...parsed.data,
      storageKey,
      mimeType: file.type,
      size: file.size,
      uploadedById: user.id,
    },
  });
  await audit(user.id, "upload", "Document", doc.id, doc.name);
  revalidatePath(`/cases/${caseId}`);
  return ok();
}

export async function deleteDocument(id: string) {
  const user = await requireUser();
  if (!can.deleteDocument(user)) throw new Error("Not allowed");
  const doc = await db.document.delete({ where: { id } });
  await deleteStoredFile(doc.storageKey);
  await audit(user.id, "delete", "Document", id, doc.name);
  revalidatePath(`/cases/${doc.caseId}`);
}

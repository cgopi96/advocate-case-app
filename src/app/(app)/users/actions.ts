"use server";

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { firstError, formObject, ok, optionalText, requiredText } from "@/lib/forms";
import { passwordSchema } from "@/lib/password";

const roleSchema = z.enum(["ADMIN", "ADVOCATE", "CLERK"]);

const createSchema = z.object({
  name: requiredText(),
  email: z.string().trim().toLowerCase().email(),
  phone: optionalText(20),
  role: roleSchema,
  password: passwordSchema,
});

export async function createUser(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = createSchema.safeParse(formObject(form));
  if (!parsed.success) return firstError(parsed.error);
  const { password, ...data } = parsed.data;
  try {
    const u = await db.user.create({ data: { ...data, passwordHash: await bcrypt.hash(password, 12) } });
    await audit(admin.id, "create", "User", u.id, `${u.email} as ${u.role}`);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { error: "A user with this email already exists." };
    }
    throw e;
  }
  revalidatePath("/users");
  return ok();
}

export async function changeRole(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = roleSchema.safeParse(form.get("role"));
  if (!parsed.success) return { error: "Choose a role." };
  if (id === admin.id && parsed.data !== "ADMIN") return { error: "You can't remove your own admin role." };
  await db.user.update({ where: { id }, data: { role: parsed.data } });
  await audit(admin.id, "change_role", "User", id, parsed.data);
  revalidatePath("/users");
  return ok();
}

export async function setActive(id: string, active: boolean) {
  const admin = await requireRole("ADMIN");
  if (id === admin.id) return;
  await db.user.update({ where: { id }, data: { active, failedLogins: 0, lockedUntil: null } });
  await audit(admin.id, active ? "activate" : "deactivate", "User", id);
  revalidatePath("/users");
}

export async function resetPassword(id: string, _prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const parsed = passwordSchema.safeParse(form.get("password"));
  if (!parsed.success) return { error: `The password ${parsed.error.issues[0].message}.` };
  await db.user.update({
    where: { id },
    data: { passwordHash: await bcrypt.hash(parsed.data, 12), failedLogins: 0, lockedUntil: null },
  });
  await audit(admin.id, "reset_password", "User", id);
  return ok();
}

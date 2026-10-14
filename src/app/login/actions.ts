"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/session";

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;
// Compared against when the email is unknown, so timing doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync("unused-password", 12);

const schema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(200),
});

export type LoginState = { error?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const parsed = schema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: "Enter your email and password." };
  const { email, password } = parsed.data;

  const user = await db.user.findUnique({ where: { email } });
  const now = new Date();

  if (user?.lockedUntil && user.lockedUntil > now) {
    await audit(user.id, "login_blocked", "User", user.id, "Account locked");
    return { error: `Too many failed attempts. Try again after ${LOCK_MINUTES} minutes.` };
  }

  const ok = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !ok || !user.active) {
    if (user) {
      const failed = user.failedLogins + 1;
      const lock = failed >= MAX_FAILED;
      await db.user.update({
        where: { id: user.id },
        data: {
          failedLogins: lock ? 0 : failed,
          lockedUntil: lock ? new Date(now.getTime() + LOCK_MINUTES * 60_000) : null,
        },
      });
      await audit(user.id, lock ? "account_locked" : "login_failed", "User", user.id);
    }
    return { error: "Incorrect email or password." };
  }

  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
  await audit(user.id, "login", "User", user.id);

  (await cookies()).set(
    SESSION_COOKIE,
    await signSession({ uid: user.id, role: user.role }),
    sessionCookieOptions,
  );
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

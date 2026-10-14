"use server";

import { revalidatePath } from "next/cache";
import type { FormState } from "@/components/action-form";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/auth";
import { runDailyReminders } from "@/lib/reminders";

export async function sendRemindersNow(_prev: FormState, _form: FormData): Promise<FormState> {
  const admin = await requireRole("ADMIN");
  const r = await runDailyReminders();
  await audit(admin.id, "send_reminders", "Reminder", null, JSON.stringify(r));
  revalidatePath("/reminders");
  return {
    nonce: Date.now(),
    message: `Sent ${r.sent}, failed ${r.failed}, skipped ${r.skipped} (nothing due, no phone, or already sent today).`,
  };
}

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { runDailyReminders } from "@/lib/reminders";

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Called once a day by the scheduler (see .github/workflows/reminders.yml). */
export async function POST(req: Request) {
  if (!authorized(req)) return new NextResponse("Unauthorized", { status: 401 });
  const result = await runDailyReminders();
  await db.auditLog.create({
    data: { action: "send_reminders", entity: "Reminder", details: JSON.stringify(result) },
  });
  return NextResponse.json(result);
}

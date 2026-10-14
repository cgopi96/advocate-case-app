import "server-only";
import { Prisma } from "@prisma/client";
import { formatDate, istDayStart, toDateKey } from "./dates";
import { db } from "./db";
import { emailConfigured, sendEmail, sendWhatsAppTemplate, whatsappConfigured } from "./notify";
import { caseScope } from "./permissions";

export type DigestHearing = { caseNumber: string; title: string; court: string; purpose: string; date: Date };
export type DigestFollowUp = { caseNumber: string; notes: string; dueDate: Date; overdue: boolean };
export type Digest = { hearings: DigestHearing[]; followUps: DigestFollowUp[] };

const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function digestSummary(d: Digest) {
  return `${d.hearings.length} hearing(s) tomorrow, ${d.followUps.length} follow-up(s) due`;
}

export function renderDigestEmail(name: string, forDate: Date, d: Digest) {
  const day = formatDate(forDate);
  const hearingLines = d.hearings.map(
    (h) => `${h.caseNumber} (${h.title}) at ${h.court}: ${h.purpose}`,
  );
  const followLines = d.followUps.map(
    (f) => `${f.caseNumber}: ${f.notes} (due ${formatDate(f.dueDate)}${f.overdue ? ", overdue" : ""})`,
  );
  const text = [
    `Hello ${name},`,
    "",
    `Hearings tomorrow (${day}):`,
    ...(hearingLines.length ? hearingLines.map((l) => `- ${l}`) : ["- None"]),
    "",
    "Follow-ups due:",
    ...(followLines.length ? followLines.map((l) => `- ${l}`) : ["- None"]),
  ].join("\n");
  const list = (items: string[]) =>
    items.length ? `<ul>${items.map((i) => `<li>${escape(i)}</li>`).join("")}</ul>` : "<p>None</p>";
  const html =
    `<p>Hello ${escape(name)},</p>` +
    `<h3>Hearings tomorrow (${escape(day)})</h3>${list(hearingLines)}` +
    `<h3>Follow-ups due</h3>${list(followLines)}`;
  return { subject: `Case reminders: ${digestSummary(d)}`, text, html };
}

/** What one user needs to hear about: hearings tomorrow and follow-ups due by today. */
export async function buildDigest(user: { id: string; role: "ADMIN" | "ADVOCATE" | "CLERK" }, now: Date): Promise<Digest> {
  const tomorrow = istDayStart(now, 1);
  const dayAfter = istDayStart(now, 2);
  const today = istDayStart(now);
  const [hearings, followUps] = await Promise.all([
    db.hearing.findMany({
      where: { date: { gte: tomorrow, lt: dayAfter }, case: caseScope(user) },
      include: { case: { select: { caseNumber: true, title: true, court: true } } },
      orderBy: { date: "asc" },
    }),
    db.followUp.findMany({
      where: { ownerId: user.id, done: false, dueDate: { lt: tomorrow } },
      include: { case: { select: { caseNumber: true } } },
      orderBy: { dueDate: "asc" },
    }),
  ]);
  return {
    hearings: hearings.map((h) => ({ ...h.case, purpose: h.purpose, date: h.date })),
    followUps: followUps.map((f) => ({
      caseNumber: f.case.caseNumber,
      notes: f.notes,
      dueDate: f.dueDate,
      overdue: f.dueDate < today,
    })),
  };
}

/**
 * Claim today's slot for a user and channel before sending, so two
 * overlapping runs can't both send. A slot that failed earlier is retried.
 */
async function claimSlot(userId: string, channel: "EMAIL" | "WHATSAPP", forDate: string, summary: string) {
  try {
    await db.reminderLog.create({ data: { userId, channel, forDate, status: "SENT", summary } });
    return true;
  } catch (e) {
    if (!(e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")) throw e;
  }
  const retried = await db.reminderLog.updateMany({
    where: { userId, channel, forDate, status: "FAILED" },
    data: { status: "SENT", error: null, summary },
  });
  return retried.count === 1;
}

export type RunResult = { sent: number; failed: number; skipped: number; forDate: string };

/**
 * Send each active staff member one daily digest per channel. Safe to run
 * more than once a day: the ReminderLog unique key stops duplicates.
 */
export async function runDailyReminders(now = new Date()): Promise<RunResult> {
  const forDate = toDateKey(now);
  const result: RunResult = { sent: 0, failed: 0, skipped: 0, forDate };
  const channels = [
    ...(emailConfigured() ? (["EMAIL"] as const) : []),
    ...(whatsappConfigured() ? (["WHATSAPP"] as const) : []),
  ];
  if (channels.length === 0) return result;

  const users = await db.user.findMany({ where: { active: true } });
  for (const user of users) {
    const digest = await buildDigest(user, now);
    if (digest.hearings.length === 0 && digest.followUps.length === 0) {
      result.skipped++;
      continue;
    }
    const summary = digestSummary(digest);
    for (const channel of channels) {
      if (channel === "WHATSAPP" && !user.phone) {
        result.skipped++;
        continue;
      }
      if (!(await claimSlot(user.id, channel, forDate, summary))) {
        result.skipped++;
        continue;
      }
      try {
        if (channel === "EMAIL") {
          const mail = renderDigestEmail(user.name, istDayStart(now, 1), digest);
          await sendEmail(user.email, mail.subject, mail.text, mail.html);
        } else {
          await sendWhatsAppTemplate(user.phone!, [
            user.name,
            String(digest.hearings.length),
            String(digest.followUps.length),
          ]);
        }
        result.sent++;
      } catch (e) {
        result.failed++;
        await db.reminderLog.update({
          where: { userId_channel_forDate: { userId: user.id, channel, forDate } },
          data: { status: "FAILED", error: e instanceof Error ? e.message.slice(0, 500) : String(e) },
        });
      }
    }
  }
  return result;
}

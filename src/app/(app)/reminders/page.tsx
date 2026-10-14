import { ActionForm } from "@/components/action-form";
import { Empty, PageHeader } from "@/components/ui";
import { requireRole } from "@/lib/auth";
import { formatDateTime } from "@/lib/dates";
import { db } from "@/lib/db";
import { emailConfigured, whatsappConfigured } from "@/lib/notify";
import { sendRemindersNow } from "./actions";

export default async function RemindersPage() {
  await requireRole("ADMIN");
  const [logs, usersWithoutPhone] = await Promise.all([
    db.reminderLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    db.user.findMany({ where: { active: true, phone: null }, select: { name: true } }),
  ]);
  const channels = [
    { name: "Email", on: emailConfigured(), setup: "Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and SMTP_FROM." },
    {
      name: "WhatsApp",
      on: whatsappConfigured(),
      setup: "Set WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_TEMPLATE.",
    },
  ];

  return (
    <>
      <PageHeader title="Reminders" />
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <section className="card">
          <h2 className="mb-2 font-semibold">How reminders work</h2>
          <p className="text-sm text-slate-600">
            Every morning each staff member gets one message listing tomorrow&apos;s hearings on their cases and
            their follow-ups that are due or overdue. Nobody is sent the same day&apos;s reminder twice.
          </p>
          <ul className="mt-3 space-y-1 text-sm">
            {channels.map((c) => (
              <li key={c.name}>
                <span className={c.on ? "text-green-700" : "text-slate-500"}>
                  {c.name}: {c.on ? "On" : "Off"}
                </span>
                {!c.on && <span className="text-slate-500"> · {c.setup}</span>}
              </li>
            ))}
          </ul>
          {usersWithoutPhone.length > 0 && (
            <p className="mt-2 text-sm text-amber-700">
              No phone number for WhatsApp: {usersWithoutPhone.map((u) => u.name).join(", ")}.
            </p>
          )}
        </section>
        <section className="card">
          <h2 className="mb-2 font-semibold">Send now</h2>
          <p className="mb-3 text-sm text-slate-600">
            Sends today&apos;s reminders immediately, for example to test the setup.
          </p>
          <ActionForm action={sendRemindersNow} submitLabel="Send today's reminders">
            <span />
          </ActionForm>
        </section>
      </div>
      <div className="card overflow-x-auto p-0">
        {logs.length === 0 ? (
          <Empty>No reminders sent yet.</Empty>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>When</th>
                <th>To</th>
                <th>Channel</th>
                <th>Contents</th>
                <th>Result</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td className="whitespace-nowrap">{formatDateTime(l.createdAt)}</td>
                  <td>{l.user.name}</td>
                  <td>{l.channel === "EMAIL" ? "Email" : "WhatsApp"}</td>
                  <td>{l.summary}</td>
                  <td className={l.status === "FAILED" ? "text-red-600" : "text-green-700"}>
                    {l.status === "FAILED" ? `Failed: ${l.error}` : "Sent"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

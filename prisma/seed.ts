// Creates the first admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
// Pass --demo to also load sample users, clients and cases for testing.
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();
const day = (offset: number) => {
  const ist = new Date(Date.now() + 5.5 * 3600_000);
  const key = ist.toISOString().slice(0, 10);
  return new Date(new Date(`${key}T00:00:00+05:30`).getTime() + offset * 86_400_000);
};

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");

  const admin = await db.user.upsert({
    where: { email },
    update: {},
    create: { name: "Admin", email, role: "ADMIN", passwordHash: await bcrypt.hash(password, 12) },
  });
  console.log(`Admin ready: ${admin.email}`);

  if (!process.argv.includes("--demo")) return;
  if (await db.case.count()) {
    console.log("Cases already exist; skipping demo data.");
    return;
  }

  const hash = await bcrypt.hash(password, 12);
  const advocate = await db.user.create({
    data: { name: "Priya Advocate", email: "advocate@example.com", role: "ADVOCATE", passwordHash: hash },
  });
  const clerk = await db.user.create({
    data: { name: "Kumar Clerk", email: "clerk@example.com", role: "CLERK", passwordHash: hash },
  });

  const ravi = await db.client.create({ data: { name: "Ravi Shankar", phone: "+91 98400 11111", email: "ravi@example.com" } });
  const meena = await db.client.create({ data: { name: "Meena Traders", phone: "+91 98400 22222", address: "T. Nagar, Chennai" } });

  const c1 = await db.case.create({
    data: {
      caseNumber: "O.S. 412/2025", title: "Ravi Shankar vs. Suresh", court: "District Munsif Court, Chennai",
      caseType: "Civil", opposingParty: "Suresh", stage: "Evidence", clientId: ravi.id, advocateId: advocate.id,
    },
  });
  const c2 = await db.case.create({
    data: {
      caseNumber: "C.C. 88/2026", title: "Meena Traders vs. ABC Pvt Ltd", court: "Metropolitan Magistrate Court, Egmore",
      caseType: "Criminal", opposingParty: "ABC Pvt Ltd", stage: "Summons", status: "ADJOURNED",
      clientId: meena.id, advocateId: admin.id,
    },
  });

  await db.hearing.createMany({
    data: [
      { caseId: c1.id, date: day(-14), purpose: "Framing of issues", outcome: "Issues framed", nextDate: day(0) },
      { caseId: c1.id, date: day(0), purpose: "Plaintiff evidence" },
      { caseId: c2.id, date: day(3), purpose: "Appearance of accused" },
    ],
  });
  await db.followUp.createMany({
    data: [
      { caseId: c1.id, type: "CALL", dueDate: day(-1), notes: "Call client to confirm witness availability", ownerId: advocate.id },
      { caseId: c2.id, type: "TASK", dueDate: day(1), notes: "Collect bank return memo copy", ownerId: clerk.id },
    ],
  });
  console.log("Demo data loaded. Demo users share the admin password.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

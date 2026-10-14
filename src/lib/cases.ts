import "server-only";
import { notFound } from "next/navigation";
import type { CurrentUser } from "./auth";
import { db } from "./db";
import { canAccessCase } from "./permissions";

export const CASE_TYPES = [
  "Civil",
  "Criminal",
  "Writ",
  "Family",
  "Consumer",
  "Labour",
  "Arbitration",
  "Revenue",
  "Other",
];

/** Load a case the user may access, or 404 (never reveal that it exists). */
export async function getAccessibleCase(caseId: string, user: CurrentUser) {
  const found = await db.case.findUnique({ where: { id: caseId } });
  if (!found || !canAccessCase(user, found.advocateId)) notFound();
  return found;
}

export async function listAdvocates() {
  return db.user.findMany({
    where: { active: true, role: { in: ["ADVOCATE", "ADMIN"] } },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

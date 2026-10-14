// Pure role rules, kept free of database access so they are easy to test.
import type { Role } from "@prisma/client";

export type Actor = { id: string; role: Role };

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Admin",
  ADVOCATE: "Advocate",
  CLERK: "Clerk",
};

export const can = {
  manageUsers: (a: Actor) => a.role === "ADMIN",
  viewAuditLog: (a: Actor) => a.role === "ADMIN",
  deleteCase: (a: Actor) => a.role === "ADMIN",
  deleteClient: (a: Actor) => a.role === "ADMIN",
  deleteDocument: (a: Actor) => a.role === "ADMIN",
  createCase: (_a: Actor) => true,
  // Who a case can be assigned to is restricted for advocates in assignableAdvocateId.
  assignCase: (a: Actor) => a.role !== "ADVOCATE",
  // Advocates can view invoices on their cases but not create or change them.
  manageBilling: (a: Actor) => a.role !== "ADVOCATE",
  cancelInvoice: (a: Actor) => a.role === "ADMIN",
  sendReminders: (a: Actor) => a.role === "ADMIN",
};

/** Whether the actor may see or work on a case assigned to `advocateId`. */
export function canAccessCase(actor: Actor, advocateId: string | null) {
  if (actor.role === "ADMIN" || actor.role === "CLERK") return true;
  return advocateId === actor.id;
}

/** Prisma `where` filter that limits a case query to what the actor may see. */
export function caseScope(actor: Actor) {
  return actor.role === "ADVOCATE" ? { advocateId: actor.id } : {};
}

/** Advocates always own the cases they create; others may assign anyone (or no one). */
export function assignableAdvocateId(actor: Actor, requested: string | null) {
  return actor.role === "ADVOCATE" ? actor.id : requested;
}

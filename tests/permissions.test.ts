import { describe, expect, it } from "vitest";
import { assignableAdvocateId, can, canAccessCase, caseScope } from "../src/lib/permissions";

const admin = { id: "a", role: "ADMIN" as const };
const advocate = { id: "v", role: "ADVOCATE" as const };
const clerk = { id: "c", role: "CLERK" as const };

describe("case access", () => {
  it("lets admin and clerk see every case", () => {
    expect(canAccessCase(admin, "v")).toBe(true);
    expect(canAccessCase(clerk, null)).toBe(true);
    expect(caseScope(admin)).toEqual({});
  });

  it("limits advocates to their own cases", () => {
    expect(canAccessCase(advocate, "v")).toBe(true);
    expect(canAccessCase(advocate, "other")).toBe(false);
    expect(canAccessCase(advocate, null)).toBe(false);
    expect(caseScope(advocate)).toEqual({ advocateId: "v" });
  });

  it("forces advocates to own the cases they create", () => {
    expect(assignableAdvocateId(advocate, "other")).toBe("v");
    expect(assignableAdvocateId(clerk, "other")).toBe("other");
  });
});

describe("role rules", () => {
  it("only admins manage users, view the audit log or delete", () => {
    for (const rule of [can.manageUsers, can.viewAuditLog, can.deleteCase, can.deleteDocument, can.deleteClient]) {
      expect(rule(admin)).toBe(true);
      expect(rule(advocate)).toBe(false);
      expect(rule(clerk)).toBe(false);
    }
  });
});

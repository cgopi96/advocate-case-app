import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/lib/db", () => ({ db: {} }));
const { renderDigestEmail } = await import("../src/lib/reminders");
const { normalizeWhatsAppNumber } = await import("../src/lib/notify");

describe("reminder email", () => {
  const digest = {
    hearings: [
      { caseNumber: "O.S. 1/2026", title: "A <script> vs B", court: "City Civil Court", purpose: "Evidence", date: new Date() },
    ],
    followUps: [{ caseNumber: "C.C. 2/2026", notes: "Call client", dueDate: new Date("2026-10-10T00:00:00+05:30"), overdue: true }],
  };

  it("lists hearings and follow-ups with counts in the subject", () => {
    const mail = renderDigestEmail("Priya", new Date("2026-10-15T00:00:00+05:30"), digest);
    expect(mail.subject).toBe("Case reminders: 1 hearing(s) tomorrow, 1 follow-up(s) due");
    expect(mail.text).toContain("Hearings tomorrow (15 Oct 2026):");
    expect(mail.text).toContain("C.C. 2/2026: Call client (due 10 Oct 2026, overdue)");
  });

  it("escapes HTML from case data", () => {
    const mail = renderDigestEmail("Priya", new Date(), digest);
    expect(mail.html).toContain("A &lt;script&gt; vs B");
    expect(mail.html).not.toContain("<script>");
  });
});

describe("WhatsApp numbers", () => {
  it("adds India's country code", () => {
    expect(normalizeWhatsAppNumber("98400 11111")).toBe("919840011111");
    expect(normalizeWhatsAppNumber("+91 98400 11111")).toBe("919840011111");
    expect(normalizeWhatsAppNumber("098400 11111")).toBe("919840011111");
  });

  it("rejects numbers it can't place", () => {
    expect(normalizeWhatsAppNumber("12345")).toBeNull();
  });
});

import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../src/lib/db", () => ({ db: {} }));
const { sniffMatches } = await import("../src/lib/storage");

describe("upload content checks", () => {
  it("accepts a real PDF header", () => {
    expect(sniffMatches("application/pdf", new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d]))).toBe(true);
  });

  it("rejects a file renamed to look like a PDF", () => {
    expect(sniffMatches("application/pdf", new Uint8Array([0x4d, 0x5a, 0x90, 0x00]))).toBe(false);
  });

  it("rejects types that are not allowed", () => {
    expect(sniffMatches("text/html", new Uint8Array([0x3c, 0x68]))).toBe(false);
  });
});

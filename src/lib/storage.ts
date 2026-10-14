import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "./db";

// Document contents live in the StoredFile table, never in the web root, and
// are only served through the authenticated /api/documents/[id] route.
// Keeping them in PostgreSQL means the app has no local disk state, so it runs
// unchanged on a VPS or on Catalyst AppSail, and one database backup covers
// the files too.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function checkKey(key: string) {
  if (!/^[a-f0-9-]+\.[a-z]+$/.test(key)) throw new Error("Invalid storage key");
  return key;
}

/** Check the first bytes so a renamed executable can't pass as a PDF. */
export function sniffMatches(mime: string, bytes: Uint8Array): boolean {
  const starts = (...sig: number[]) => sig.every((b, i) => bytes[i] === b);
  switch (mime) {
    case "application/pdf":
      return starts(0x25, 0x50, 0x44, 0x46);
    case "image/jpeg":
      return starts(0xff, 0xd8, 0xff);
    case "image/png":
      return starts(0x89, 0x50, 0x4e, 0x47);
    case "application/msword":
      return starts(0xd0, 0xcf, 0x11, 0xe0);
    case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      return starts(0x50, 0x4b, 0x03, 0x04);
    default:
      return false;
  }
}

export async function saveFile(mime: string, bytes: Uint8Array): Promise<string> {
  const ext = ALLOWED_TYPES[mime];
  if (!ext) throw new Error("File type not allowed");
  const key = `${randomUUID()}.${ext}`;
  await db.storedFile.create({ data: { key, data: Buffer.from(bytes) } });
  return key;
}

export async function readStoredFile(key: string): Promise<Uint8Array> {
  const file = await db.storedFile.findUnique({ where: { key: checkKey(key) } });
  if (!file) throw new Error("Stored file missing");
  return file.data;
}

export async function deleteStoredFile(key: string) {
  await db.storedFile.deleteMany({ where: { key: checkKey(key) } });
}

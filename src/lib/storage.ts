import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

// Documents are stored on disk outside the web root and only served through
// the authenticated /api/documents/[id] route. Swap this module for an
// S3-compatible store in production without changing callers.

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

function root() {
  return path.resolve(process.env.UPLOAD_DIR ?? "./uploads");
}

function resolveKey(key: string) {
  if (!/^[a-f0-9-]+\.[a-z]+$/.test(key)) throw new Error("Invalid storage key");
  return path.join(root(), key);
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
  await mkdir(root(), { recursive: true });
  await writeFile(resolveKey(key), bytes, { mode: 0o600 });
  return key;
}

export async function readStoredFile(key: string) {
  return readFile(resolveKey(key));
}

export async function deleteStoredFile(key: string) {
  await unlink(resolveKey(key)).catch(() => undefined);
}

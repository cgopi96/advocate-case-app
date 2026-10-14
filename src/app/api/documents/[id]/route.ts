import { NextResponse } from "next/server";
import { audit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { canAccessCase } from "@/lib/permissions";
import { readStoredFile } from "@/lib/storage";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id }, include: { case: { select: { advocateId: true } } } });
  if (!doc || !canAccessCase(user, doc.case.advocateId)) return new NextResponse("Not found", { status: 404 });

  const bytes = await readStoredFile(doc.storageKey);
  await audit(user.id, "download", "Document", doc.id, doc.name);
  const inline = doc.mimeType === "application/pdf" || doc.mimeType.startsWith("image/");
  const filename = encodeURIComponent(`${doc.name}.${doc.storageKey.split(".").pop()}`);
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${filename}`,
      "Cache-Control": "private, no-store",
      "Content-Security-Policy": "sandbox",
    },
  });
}

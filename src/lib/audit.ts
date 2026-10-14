import { headers } from "next/headers";
import { db } from "./db";

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string | null,
  details?: string,
) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? null;
  await db.auditLog.create({
    data: { userId, action, entity, entityId: entityId ?? null, details, ip },
  });
}

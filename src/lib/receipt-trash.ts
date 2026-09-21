import { z } from "zod";
import { db } from "./db";
import { AppError } from "./http";

export const receiptTrashSchema = z.strictObject({ version: z.number().int().min(0).max(2147483646) });

export async function setReceiptTrashed(userId: string, id: string, version: number, trashed: boolean) {
  return db().$transaction(async tx => {
    const current = await tx.receipt.findFirst({ where: { id, userId, intakeState: "ACCEPTED" } });
    if (!current) throw new AppError("NOT_FOUND", 404);
    if (current.version !== version || Boolean(current.deletedAt) === trashed) throw new AppError("RECEIPT_CHANGED", 409);
    const changed = await tx.receipt.updateMany({
      where: { id, userId, intakeState: "ACCEPTED", version, deletedAt: trashed ? null : { not: null } },
      data: { deletedAt: trashed ? new Date() : null, version: { increment: 1 } },
    });
    if (!changed.count) throw new AppError("RECEIPT_CHANGED", 409);
    // Do not reset attempts or repeat completed cloud work. The normal scheduler is the fallback.
    if (!trashed) await tx.job.updateMany({ where: { receiptId: id, state: "PENDING" }, data: { enqueuedAt: null } });
    return { id, version: version + 1, trashed };
  });
}

export async function listTrashedReceipts(userId: string, cursor: string | null) {
  const where = { userId, intakeState: "ACCEPTED" as const, deletedAt: { not: null } };
  if (cursor && !await db().receipt.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) throw new AppError("INVALID_CURSOR");
  const rows = await db().receipt.findMany({
    where, orderBy: [{ deletedAt: "desc" }, { id: "desc" }], take: 31,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    select: { id: true, version: true, merchant: true, transactionDate: true, totalYen: true, deletedAt: true },
  });
  return { receipts: rows.slice(0, 30).map(row => ({ ...row, deletedAt: row.deletedAt!.toISOString() })), nextCursor: rows.length > 30 ? rows[29].id : null };
}

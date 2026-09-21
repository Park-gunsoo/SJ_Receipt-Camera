import type { Prisma } from "@/generated/prisma/client";
export async function requestMetadata(tx: Prisma.TransactionClient, receiptId: string) {
  const existing = await tx.job.findUnique({ where: { receiptId_kind: { receiptId, kind: "METADATA" } }, select: { id: true, state: true } });
  // Never steal or wait on a running metadata lease while holding the receipt row.
  // That worker compares the receipt version at completion and reschedules itself.
  if (existing?.state === "RUNNING") return;
  if (!existing) { await tx.job.create({ data: { receiptId, kind: "METADATA" } }); return; }
  await tx.job.updateMany({ where: { id: existing.id, state: { not: "RUNNING" } }, data: { state: "PENDING", attempts: 0, nextRunAt: new Date(), enqueuedAt: null, completedAt: null, lastError: null, leaseToken: null, leaseUntil: null } });
}

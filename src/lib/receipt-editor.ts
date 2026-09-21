import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { ReceiptValues } from "./contracts";
import { db } from "./db";
import { AppError } from "./http";
import { validDate } from "./extraction";
import { requestMetadata } from "./metadata-job";
const amount = z.number().int().min(0).max(999999999).nullable();
const nullableText = (max: number) => z.string().trim().max(max).transform(value => value || null).nullable();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const [year, month, day] = value.split("-").map(Number);
  return validDate(year, month, day) === value;
}).nullable();
export const receiptEditSchema = z.strictObject({
  version: z.number().int().min(0),
  values: z.strictObject({
    merchant: nullableText(100), transactionDate: date, totalYen: amount,
    taxes: z.array(z.strictObject({ rate: z.number().min(0).max(100).nullable(), taxableYen: amount, taxYen: amount })).max(8),
    paymentMethod: nullableText(80), registrationNumber: z.string().regex(/^T\d{13}$/).nullable(), category: nullableText(80), summary: nullableText(2000),
  }),
});
export type ReceiptEdit = z.infer<typeof receiptEditSchema>;
export async function saveReceiptEdit(userId: string, id: string, input: ReceiptEdit) {
  return db().$transaction(async tx => {
    const receipt = await tx.receipt.findFirst({ where: { id, userId, deletedAt: null, intakeState: "ACCEPTED" } });
    if (!receipt) throw new AppError("NOT_FOUND", 404);
    if (["PENDING", "PROCESSING"].includes(receipt.ocrState)) throw new AppError("ANALYSIS_PENDING", 409);
    const previous = receipt.values as ReceiptValues | null;
    const values = { ...input.values, items: previous?.items ?? [] };
    const changed = await tx.receipt.updateMany({ where: { id, userId, version: input.version, deletedAt: null }, data: {
      values: values as Prisma.InputJsonValue, merchant: values.merchant, transactionDate: values.transactionDate, totalYen: values.totalYen, userEdited: true, version: { increment: 1 },
    } });
    if (!changed.count) throw new AppError("EDIT_CONFLICT", 409);
    const updated = await tx.receipt.findUniqueOrThrow({ where: { id } });
    await tx.receiptRevision.create({ data: { receiptId: id, actorId: userId, version: updated.version, values: values as Prisma.InputJsonValue } });
    if (updated.driveFileId && updated.archiveState === "SAVED") {
      await requestMetadata(tx, id);
    }
    return updated;
  });
}

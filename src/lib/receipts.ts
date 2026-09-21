import { createHash } from "node:crypto";
import type { Receipt } from "@/generated/prisma/client";
import { db } from "./db";
import { AppError } from "./http";
import { setting } from "./config";
import { imageExists, incomingInfo, incomingKey, readImage, saveImage } from "./storage";
import { validateImage } from "./image";
import type { ReceiptValues, ReceiptView } from "./contracts";

export function jstDay(date = new Date()) { return new Date(date.getTime() + 9 * 60 * 60000).toISOString().slice(0, 10); }
export async function acceptStoredReceipt(id: string) {
  return db().$transaction(async tx => {
    const receipt = await tx.receipt.update({ where: { id }, data: { intakeState: "ACCEPTED", intakeError: null, acceptedAt: (await tx.receipt.findUniqueOrThrow({ where: { id } })).acceptedAt ?? new Date() } });
    for (const kind of ["ARCHIVE", "OCR"] as const) await tx.job.upsert({ where: { receiptId_kind: { receiptId: id, kind } }, create: { receiptId: id, kind }, update: {} });
    return receipt;
  });
}
export async function beginIntake(userId: string, captureId: string, capturedAt: Date, checksum: string, byteLength: number, mimeType: string) {
  return db().$transaction(async tx => {
    // Serialize per-user intake: repeated captures do not consume quota twice.
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const previous = await tx.receipt.findUnique({ where: { userId_captureId: { userId, captureId } } });
    if (previous) {
      if (previous.deletedAt || previous.checksum !== checksum || previous.byteLength !== byteLength || previous.mimeType !== mimeType) throw new AppError("CAPTURE_ID_CONFLICT", 409);
      return previous.intakeError ? tx.receipt.update({ where: { id: previous.id }, data: { intakeError: null } }) : previous;
    }
    const day = jstDay();
    const usage = await tx.usageDay.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} });
    if (usage.intake >= setting("DAILY_RECEIPT_LIMIT", 100)) throw new AppError("INTAKE_LIMIT", 429);
    await tx.usageDay.update({ where: { userId_day: { userId, day } }, data: { intake: { increment: 1 } } });
    return tx.receipt.create({ data: { userId, captureId, capturedAt, objectKey: `receipts/${userId}/${captureId}/original`, checksum, byteLength, mimeType } });
  });
}
export async function intake(userId: string, captureId: string, capturedAt: Date, bytes: Buffer, mimeType: string) {
  const checksum = createHash("sha256").update(bytes).digest("hex");
  const existing = await db().receipt.findUnique({ where: { userId_captureId: { userId, captureId } } });
  if (existing && (existing.deletedAt || existing.checksum !== checksum || existing.mimeType !== mimeType)) throw new AppError("CAPTURE_ID_CONFLICT", 409);
  if (existing?.intakeState === "ACCEPTED") return existing;
  await validateImage(bytes, mimeType);
  const receipt = await beginIntake(userId, captureId, capturedAt, checksum, bytes.length, mimeType);
  if (receipt.intakeState === "ACCEPTED") return receipt;
  await saveImage(receipt.objectKey, bytes, mimeType, checksum);
  return acceptStoredReceipt(receipt.id);
}
export async function finishUpload(receipt: Receipt): Promise<Receipt | null> {
  if (receipt.deletedAt) throw new AppError("NOT_FOUND", 404);
  if (receipt.intakeState === "ACCEPTED") return receipt;
  // Only the server can write the immutable final original.
  if (await imageExists(receipt.objectKey, receipt.checksum, receipt.byteLength)) return acceptStoredReceipt(receipt.id);
  const staging = incomingKey(receipt.objectKey);
  const info = await incomingInfo(receipt.objectKey);
  if (!info || receipt.intakeError?.endsWith(`:${info.generation}`)) return null;
  let bytes: Buffer;
  try {
    if (info.checksum !== receipt.checksum || info.byteLength !== receipt.byteLength) throw new AppError("UPLOAD_CHECKSUM_MISMATCH", 422);
    bytes = await readImage(staging, info.generation);
    if (bytes.length !== receipt.byteLength || createHash("sha256").update(bytes).digest("hex") !== receipt.checksum) throw new AppError("UPLOAD_CHECKSUM_MISMATCH", 422);
    await validateImage(bytes, receipt.mimeType);
  } catch (error) {
    if (error instanceof AppError) await db().receipt.updateMany({ where: { id: receipt.id, intakeState: "UPLOADING" }, data: { intakeError: `${error.code}:${info.generation}` } });
    throw error;
  }
  await saveImage(receipt.objectKey, bytes, receipt.mimeType, receipt.checksum);
  return acceptStoredReceipt(receipt.id);
}
export function receiptView(receipt: Receipt): ReceiptView {
  return { version: receipt.version, userEdited: receipt.userEdited, id: receipt.id, captureId: receipt.captureId, capturedAt: receipt.capturedAt.toISOString(), createdAt: receipt.createdAt.toISOString(), acceptedAt: receipt.acceptedAt?.toISOString() ?? null, intakeState: receipt.intakeState, archiveState: receipt.archiveState, ocrState: receipt.ocrState, reviewState: receipt.reviewState, merchant: receipt.merchant, transactionDate: receipt.transactionDate, totalYen: receipt.totalYen, values: receipt.values as ReceiptValues | null, reviewReasons: receipt.reviewReasons, archiveError: receipt.archiveError, ocrError: receipt.ocrError, driveUrl: receipt.archiveState === "SAVED" && receipt.driveFileId ? `https://drive.google.com/file/d/${receipt.driveFileId}/view` : null };
}
export async function ownedReceipt(userId: string, id: string) {
  const receipt = await db().receipt.findFirst({ where: { id, userId, deletedAt: null, intakeState: "ACCEPTED" } });
  if (!receipt) throw new AppError("NOT_FOUND", 404);
  return receipt;
}

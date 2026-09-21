import { randomUUID } from "node:crypto";
import { ImageAnnotatorClient } from "@google-cloud/vision";
import type { JobKind, Prisma } from "@/generated/prisma/client";
import { db } from "./db";
import { setting } from "./config";
import { readImage } from "./storage";
import { finishUpload, jstDay } from "./receipts";
import { createPdf, normalizedImage } from "./image";
import { archivePdf, updatePdfMetadata } from "./drive";
import { extractReceipt } from "./extraction";
import { googleError } from "./http";
import { dispatchPending } from "./queue";
import { googleCloudOptions } from "./google-cloud";
import { requestMetadata } from "./metadata-job";

type ReceiptPatch = Prisma.ReceiptUpdateManyMutationInput;
const asJson = (data: unknown) => JSON.parse(JSON.stringify(data)) as Prisma.InputJsonValue;
export async function claimJob(id: string, now = new Date()) {
  const token = randomUUID();
  const result = await db().job.updateMany({ where: { id, attempts: { lt: setting("MAX_JOB_ATTEMPTS", 5, 20) }, nextRunAt: { lte: now }, OR: [{ state: "PENDING" }, { state: "RUNNING", leaseUntil: { lt: now } }], receipt: { intakeState: "ACCEPTED", deletedAt: null } }, data: { state: "RUNNING", attempts: { increment: 1 }, leaseToken: token, leaseUntil: new Date(now.getTime() + 10 * 60000), enqueuedAt: null } });
  return result.count ? db().job.findUniqueOrThrow({ where: { id }, include: { receipt: true } }) : null;
}
async function patchWithLease(id: string, token: string, patch: ReceiptPatch) {
  return db().$transaction(async tx => {
    const fenced = await tx.job.updateMany({ where: { id, state: "RUNNING", leaseToken: token, leaseUntil: { gt: new Date() } }, data: { updatedAt: new Date() } });
    if (!fenced.count) throw new Error("LOST_LEASE");
    const job = await tx.job.findUniqueOrThrow({ where: { id } });
    await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null }, data: patch });
  });
}
export async function completeJob(id: string, token: string, patch: ReceiptPatch = {}, expectedVersion?: number) {
  return db().$transaction(async tx => {
    const completed = await tx.job.updateMany({ where: { id, state: "RUNNING", leaseToken: token, leaseUntil: { gt: new Date() } }, data: { state: "DONE", completedAt: new Date(), lastError: null, leaseToken: null, leaseUntil: null } });
    if (!completed.count) return false;
    const job = await tx.job.findUniqueOrThrow({ where: { id } });
    await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null }, data: patch });
    const receipt = await tx.receipt.findUniqueOrThrow({ where: { id: job.receiptId } });
    if (job.kind === "METADATA" && expectedVersion !== undefined && receipt.version !== expectedVersion) await tx.job.update({ where: { id }, data: { state: "PENDING", attempts: 0, enqueuedAt: null, completedAt: null, nextRunAt: new Date() } });
    if (job.kind !== "METADATA" && receipt.archiveState === "SAVED" && receipt.ocrState === "DONE") await requestMetadata(tx, receipt.id);
    return true;
  });
}
async function reserveOcr(userId: string) {
  await db().$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const day = jstDay();
    const usage = await tx.usageDay.upsert({ where: { userId_day: { userId, day } }, create: { userId, day }, update: {} });
    if (usage.ocr >= setting("DAILY_OCR_LIMIT", 100)) throw new Error("OCR_LIMIT");
    await tx.usageDay.update({ where: { userId_day: { userId, day } }, data: { ocr: { increment: 1 } } });
  });
}
async function processOcr(job: NonNullable<Awaited<ReturnType<typeof claimJob>>>) {
  await patchWithLease(job.id, job.leaseToken!, { ocrState: "PROCESSING", ocrError: null });
  let raw = job.receipt.rawOcr as { text?: string; pages?: unknown[] } | null;
  if (!raw) {
    const original = await readImage(job.receipt.objectKey);
    let content = original;
    try { content = await normalizedImage(original); } catch { /* Original remains valid and is preserved. */ }
    await reserveOcr(job.receipt.userId);
    const client = new ImageAnnotatorClient(googleCloudOptions());
    try {
      const [batch] = await client.batchAnnotateImages({ requests: [{ image: { content }, imageContext: { languageHints: ["ja"] }, features: [{ type: "DOCUMENT_TEXT_DETECTION" }] }] }, { timeout: 60000 });
      const result = batch.responses?.[0];
      if (!result || result.error?.code) throw new Error("OCR_PROVIDER_ERROR");
      raw = { text: result.fullTextAnnotation?.text ?? "", pages: result.fullTextAnnotation?.pages ?? [] };
      await patchWithLease(job.id, job.leaseToken!, { rawOcr: asJson(raw) });
    } finally { await client.close(); }
  }
  if (!raw.text?.trim()) throw new Error("OCR_EMPTY");
  const extraction = extractReceipt(raw.text, raw.pages);
  // A future PC edit may have happened during the paid call. Preserve it atomically.
  await db().$transaction(async tx => {
    const lock = await tx.job.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken: job.leaseToken, leaseUntil: { gt: new Date() } }, data: { updatedAt: new Date() } });
    if (!lock.count) throw new Error("LOST_LEASE");
    await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null }, data: { extraction: asJson(extraction), extractionVersion: extraction.version } });
    await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null, userEdited: false }, data: { values: asJson(extraction.values), merchant: extraction.values.merchant, transactionDate: extraction.values.transactionDate, totalYen: extraction.values.totalYen, reviewReasons: extraction.reasons, reviewState: "NEEDS_REVIEW", version: { increment: 1 } } });
  });
  await completeJob(job.id, job.leaseToken!, { ocrState: "DONE", ocrError: null });
}
function statusPatch(kind: JobKind, blocked: boolean, terminal: boolean, error: string): ReceiptPatch {
  if (kind === "ARCHIVE") return { archiveState: blocked ? "BLOCKED" : terminal ? "FAILED" : "PENDING", archiveError: error };
  if (kind === "OCR") return { ocrState: error === "OCR_LIMIT" ? "LIMIT_REACHED" : terminal ? "FAILED" : "PENDING", ocrError: error, reviewState: "NEEDS_REVIEW" };
  return { archiveError: error };
}
export async function runJob(id: string) {
  const job = await claimJob(id);
  if (!job) return { skipped: true };
  try {
    if (job.kind === "ARCHIVE") {
      await patchWithLease(job.id, job.leaseToken!, { archiveState: "PROCESSING", archiveError: null });
      const pdf = await createPdf(await readImage(job.receipt.objectKey), job.receipt.mimeType);
      await archivePdf(job.receiptId, pdf);
      await completeJob(job.id, job.leaseToken!, { archiveState: "SAVED", archiveError: null });
    } else if (job.kind === "OCR") await processOcr(job);
    else { await updatePdfMetadata(job.receiptId); await completeJob(job.id, job.leaseToken!, { archiveError: null }, job.receipt.version); }
  } catch (error) {
    if ((error as Error).message === "LOST_LEASE") return { skipped: true };
    const explicit = ["OCR_LIMIT", "OCR_EMPTY", "DRIVE_RECONNECT", "DRIVE_FILE_TRASHED"].includes((error as Error).message) ? (error as Error).message : null;
    const code = explicit ?? (job.kind === "OCR" ? "OCR_ERROR" : googleError(error));
    const blocked = ["DRIVE_RECONNECT", "DRIVE_PERMISSION", "DRIVE_FULL", "DRIVE_FILE_TRASHED", "OCR_LIMIT"].includes(code);
    const terminal = job.attempts >= setting("MAX_JOB_ATTEMPTS", 5, 20) || code === "OCR_EMPTY";
    const nextRunAt = code === "OCR_LIMIT" ? new Date(new Date(`${jstDay()}T00:00:00+09:00`).getTime() + 86400000) : new Date(Date.now() + Math.min(3600, 30 * 2 ** job.attempts) * 1000);
    await db().$transaction(async tx => {
      const update = await tx.job.updateMany({ where: { id, state: "RUNNING", leaseToken: job.leaseToken }, data: { state: blocked ? "BLOCKED" : terminal ? "FAILED" : "PENDING", nextRunAt, lastError: code, leaseToken: null, leaseUntil: null, enqueuedAt: null } });
      if (!update.count) return;
      await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null }, data: statusPatch(job.kind, blocked, terminal, code) });
      if (["DRIVE_RECONNECT", "DRIVE_PERMISSION", "DRIVE_FULL"].includes(code)) await tx.driveConnection.updateMany({ where: { userId: job.receipt.userId }, data: { status: code } });
    });
  }
  return { processed: true };
}
export async function reconcile() {
  const uploads = await db().receipt.findMany({ where: { intakeState: "UPLOADING", deletedAt: null }, orderBy: { updatedAt: "asc" }, take: 50 });
  let recovered = 0;
  for (const receipt of uploads) {
    try {
      if (await finishUpload(receipt)) recovered++;
      else await db().receipt.update({ where: { id: receipt.id }, data: { updatedAt: new Date() } });
    } catch {
      // One damaged upload must not stop recovery of every other receipt.
      await db().receipt.update({ where: { id: receipt.id }, data: { updatedAt: new Date() } });
    }
  }
  const exhausted = await db().job.findMany({ where: { state: "RUNNING", leaseUntil: { lt: new Date() }, attempts: { gte: setting("MAX_JOB_ATTEMPTS", 5, 20) } }, take: 50 });
  for (const job of exhausted) await db().$transaction(async tx => {
    const changed = await tx.job.updateMany({ where: { id: job.id, state: "RUNNING", leaseToken: job.leaseToken, leaseUntil: { lt: new Date() } }, data: { state: "FAILED", lastError: "WORKER_INTERRUPTED", leaseToken: null, leaseUntil: null } });
    if (changed.count) await tx.receipt.updateMany({ where: { id: job.receiptId, deletedAt: null }, data: statusPatch(job.kind, false, true, "WORKER_INTERRUPTED") });
  });
  await db().job.updateMany({ where: { state: "RUNNING", leaseUntil: { lt: new Date() }, attempts: { lt: setting("MAX_JOB_ATTEMPTS", 5, 20) } }, data: { state: "PENDING", leaseToken: null, leaseUntil: null, enqueuedAt: null, nextRunAt: new Date() } });
  await db().job.updateMany({ where: { state: "BLOCKED", lastError: "OCR_LIMIT", nextRunAt: { lte: new Date() } }, data: { state: "PENDING", attempts: 0, enqueuedAt: null } });
  await dispatchPending();
  return { recovered };
}

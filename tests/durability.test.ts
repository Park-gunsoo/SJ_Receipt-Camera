import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ save: vi.fn(), exists: vi.fn(), read: vi.fn(), info: vi.fn(), archive: vi.fn(), metadata: vi.fn(), dispatch: vi.fn(), pdfExists: vi.fn(), savePdf: vi.fn(), vision: vi.fn() }));
vi.mock("@google-cloud/vision", () => ({ ImageAnnotatorClient: class { batchAnnotateImages = mocks.vision; async close() {} } }));
vi.mock("@/lib/storage", () => ({ saveImage: mocks.save, imageExists: mocks.exists, readImage: mocks.read, incomingInfo: mocks.info, incomingKey: (key: string) => `${key}.incoming`, pdfKey: (key: string) => `${key}.pdf`, pdfExists: mocks.pdfExists, savePdf: mocks.savePdf }));
vi.mock("@/lib/drive", () => ({ archivePdf: mocks.archive, updatePdfMetadata: mocks.metadata }));
vi.mock("@/lib/queue", () => ({ dispatchPending: mocks.dispatch }));
import { db } from "../src/lib/db";
import { beginIntake, finishUpload, intake, ownedReceipt } from "../src/lib/receipts";
import { claimJob, completeJob, reconcile, runJob } from "../src/lib/jobs";
import { saveReceiptEdit } from "../src/lib/receipt-editor";
import { listTrashedReceipts, setReceiptTrashed } from "../src/lib/receipt-trash";

let pg: PGlite, server: PGLiteSocketServer, image: Buffer;
let userId: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5447/postgres"); vi.stubEnv("DB_POOL_SIZE", "1");
  vi.stubEnv("GCP_PROJECT_ID", "unit-test-only");
  pg = await PGlite.create();
  await pg.exec(await readFile("prisma/migrations/202609210001_initial/migration.sql", "utf8"));
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await pg.exec(await readFile("prisma/migrations/202609210002_private_access/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/202609210003_direct_upload/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/202609210004_app_pdf/migration.sql", "utf8"));
  server = new PGLiteSocketServer({ db: pg, port: 5447, host: "127.0.0.1" }); await server.start();
  image = await sharp({ create: { width: 20, height: 40, channels: 3, background: "white" } }).jpeg().toBuffer();
});
afterAll(async () => { await db().$disconnect(); await server.stop(); await pg.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.clearAllMocks(); mocks.save.mockResolvedValue(undefined); mocks.exists.mockResolvedValue(true); mocks.read.mockResolvedValue(image); mocks.info.mockResolvedValue(null); mocks.archive.mockResolvedValue("drive-file"); mocks.dispatch.mockResolvedValue(undefined); mocks.pdfExists.mockResolvedValue(false); mocks.savePdf.mockResolvedValue(undefined);
  userId = (await db().user.create({ data: { googleSub: randomUUID(), email: `${randomUUID()}@example.test` } })).id;
});
describe("durable intake and jobs (real SQL, stubbed cloud boundaries)", () => {
  it("moves owned receipts to trash and restores every stored value and revision", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { ocrState: "DONE", pdfState: "SAVED", archiveState: "SAVED", driveFileId: "existing-test-drive-id", rawOcr: { text: "test evidence" } } });
    const values = { merchant: "Trash test", transactionDate: "2026-09-21", totalYen: 100, taxes: [], paymentMethod: null, registrationNumber: null, category: null, summary: null };
    const before = await saveReceiptEdit(userId, receipt.id, { version: 0, values });
    await setReceiptTrashed(userId, receipt.id, before.version, true);
    await expect(ownedReceipt(userId, receipt.id)).rejects.toThrow("NOT_FOUND");
    await expect(saveReceiptEdit(userId, receipt.id, { version: before.version, values })).rejects.toThrow("NOT_FOUND");
    await expect(intake(userId, receipt.captureId, new Date(), image, "image/jpeg")).rejects.toThrow("CAPTURE_ID_CONFLICT");
    const trash = await listTrashedReceipts(userId, null);
    expect(trash.receipts).toHaveLength(1);
    expect(Object.keys(trash.receipts[0]).sort()).toEqual(["deletedAt", "id", "merchant", "totalYen", "transactionDate", "version"]);
    await setReceiptTrashed(userId, receipt.id, trash.receipts[0].version, false);
    const restored = await ownedReceipt(userId, receipt.id);
    for (const key of ["objectKey", "checksum", "byteLength", "driveFileId", "rawOcr", "values", "userEdited", "pdfState", "ocrState", "archiveState"] as const) expect(restored[key]).toEqual(before[key]);
    expect(restored.version).toBe(before.version + 2);
    expect(await db().receiptRevision.count({ where: { receiptId: receipt.id } })).toBe(1);
    expect((await db().usageDay.findFirstOrThrow({ where: { userId } })).intake).toBe(1);
    await expect(saveReceiptEdit(userId, receipt.id, { version: before.version, values })).rejects.toThrow("EDIT_CONFLICT");
    expect((await listTrashedReceipts(userId, null)).receipts).toHaveLength(0);
  });
  it("refuses other owners and stale or duplicate trash transitions atomically", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await expect(setReceiptTrashed("other", receipt.id, 0, true)).rejects.toThrow("NOT_FOUND");
    await expect(setReceiptTrashed(userId, receipt.id, 99, true)).rejects.toThrow("RECEIPT_CHANGED");
    const deleted = await Promise.allSettled([setReceiptTrashed(userId, receipt.id, 0, true), setReceiptTrashed(userId, receipt.id, 0, true)]);
    expect(deleted.filter(result => result.status === "fulfilled")).toHaveLength(1);
    await expect(setReceiptTrashed("other", receipt.id, 1, false)).rejects.toThrow("NOT_FOUND");
    expect((await listTrashedReceipts("other", null)).receipts).toHaveLength(0);
    const restored = await Promise.allSettled([setReceiptTrashed(userId, receipt.id, 1, false), setReceiptTrashed(userId, receipt.id, 1, false)]);
    expect(restored.filter(result => result.status === "fulfilled")).toHaveLength(1);
    await expect(setReceiptTrashed(userId, receipt.id, 0, true)).rejects.toThrow("RECEIPT_CHANGED");
  });
  it("bounds trash pagination and refuses foreign or restored cursors", async () => {
    for (let i = 0; i < 31; i++) await db().receipt.create({ data: { userId, captureId: randomUUID(), capturedAt: new Date(), objectKey: `unit-test-${randomUUID()}`, checksum: "unit-test", byteLength: 1, mimeType: "image/jpeg", intakeState: "ACCEPTED", deletedAt: new Date() } });
    const first = await listTrashedReceipts(userId, null);
    expect(first.receipts).toHaveLength(30); expect(first.nextCursor).toBeTruthy();
    const second = await listTrashedReceipts(userId, first.nextCursor);
    expect(second.receipts).toHaveLength(1); expect(second.nextCursor).toBeNull();
    expect(first.receipts.some(row => row.id === second.receipts[0].id)).toBe(false);
    await expect(listTrashedReceipts("other", first.nextCursor)).rejects.toThrow("INVALID_CURSOR");
    await setReceiptTrashed(userId, first.nextCursor!, 0, false);
    await expect(listTrashedReceipts(userId, first.nextCursor)).rejects.toThrow("INVALID_CURSOR");
  });
  it("pauses pending work in trash and resumes the same jobs without duplicate intake", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const pdf = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    await db().job.update({ where: { id: pdf.id }, data: { enqueuedAt: new Date() } });
    await setReceiptTrashed(userId, receipt.id, 0, true);
    expect(await claimJob(pdf.id)).toBeNull();
    await setReceiptTrashed(userId, receipt.id, 1, false);
    expect((await db().job.findUniqueOrThrow({ where: { id: pdf.id } })).enqueuedAt).toBeNull();
    await runJob(pdf.id);
    expect((await ownedReceipt(userId, receipt.id)).pdfState).toBe("SAVED");
    expect(await db().job.count({ where: { receiptId: receipt.id } })).toBe(2);
    expect(mocks.savePdf).toHaveBeenCalledOnce();
  });
  it("retains an in-flight PDF completion when the receipt is trashed during storage", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const pdf = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    mocks.savePdf.mockImplementationOnce(async () => { await setReceiptTrashed(userId, receipt.id, 0, true); });
    await runJob(pdf.id);
    const trashed = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(trashed.deletedAt).not.toBeNull(); expect(trashed.pdfState).toBe("SAVED");
    expect((await db().job.findUniqueOrThrow({ where: { id: pdf.id } })).state).toBe("DONE");
    await setReceiptTrashed(userId, receipt.id, trashed.version, false);
    await runJob(pdf.id); expect(mocks.savePdf).toHaveBeenCalledOnce();
  });
  it("retains OCR evidence and extracted values if trashed during the provider call", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    mocks.vision.mockImplementationOnce(async () => {
      await setReceiptTrashed(userId, receipt.id, 0, true);
      return [{ responses: [{ fullTextAnnotation: { text: "合計 1100円", pages: [] } }] }];
    });
    const ocr = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "OCR" } });
    await runJob(ocr.id);
    const trashed = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(trashed.deletedAt).not.toBeNull(); expect(trashed.ocrState).toBe("DONE"); expect(trashed.totalYen).toBe(1100); expect(trashed.rawOcr).toBeTruthy();
    await setReceiptTrashed(userId, receipt.id, trashed.version, false);
    await runJob(ocr.id); expect(mocks.vision).toHaveBeenCalledOnce();
  });
  it("retains in-flight failure state in trash so restoration can retry coherently", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const pdf = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    mocks.savePdf.mockImplementationOnce(async () => { await setReceiptTrashed(userId, receipt.id, 0, true); throw new Error("storage unavailable"); });
    await runJob(pdf.id);
    const trashed = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(trashed.pdfState).toBe("PENDING"); expect(trashed.pdfError).toBe("PDF_ERROR");
    await setReceiptTrashed(userId, receipt.id, trashed.version, false);
    const retry = await db().job.findUniqueOrThrow({ where: { id: pdf.id } });
    expect(retry.state).toBe("PENDING"); expect(retry.attempts).toBe(1);
  });
  it("stores PDF and OCR results without a Drive connection", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    expect(receipt.archiveState).toBe("NOT_REQUESTED");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "合計 1100円" } } });
    const jobs = await db().job.findMany({ where: { receiptId: receipt.id } });
    expect(jobs.map(job => job.kind).sort()).toEqual(["OCR", "PDF"]);
    await runJob(jobs.find(job => job.kind === "PDF")!.id); await runJob(jobs.find(job => job.kind === "OCR")!.id);
    const saved = await ownedReceipt(userId, receipt.id);
    expect(saved.pdfState).toBe("SAVED"); expect(saved.ocrState).toBe("DONE"); expect(saved.archiveState).toBe("NOT_REQUESTED");
    expect(mocks.savePdf.mock.calls[0][1].subarray(0, 5).toString()).toBe("%PDF-");
    expect(mocks.archive).not.toHaveBeenCalled();
  });
  it("snapshots the optional backup choice once, while later captures use the new setting", async () => {
    await db().driveConnection.create({ data: { userId, encryptedRefreshToken: "unit-test-only", backupEnabled: false } });
    const captureId = randomUUID(); const first = await intake(userId, captureId, new Date(), image, "image/jpeg");
    await db().driveConnection.update({ where: { userId }, data: { backupEnabled: true } });
    const repeated = await intake(userId, captureId, new Date(), image, "image/jpeg");
    expect(repeated.archiveState).toBe("NOT_REQUESTED");
    expect(await db().job.count({ where: { receiptId: first.id, kind: "ARCHIVE" } })).toBe(0);
    const next = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    expect(next.archiveState).toBe("PENDING"); expect(await db().job.count({ where: { receiptId: next.id } })).toBe(3);
  });
  it("waits for the app PDF before attempting a Drive backup", async () => {
    await db().driveConnection.create({ data: { userId, encryptedRefreshToken: "unit-test-only" } });
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const archive = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "ARCHIVE" } });
    const pdf = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    expect(await claimJob(archive.id)).toBeNull();
    expect((await db().job.findUniqueOrThrow({ where: { id: archive.id } })).attempts).toBe(0);
    await runJob(pdf.id); await runJob(archive.id);
    expect(mocks.read).toHaveBeenCalledWith(`${receipt.objectKey}.pdf`);
    expect((await ownedReceipt(userId, receipt.id)).archiveState).toBe("SAVED");
  });
  it("keeps the app PDF and OCR available when Drive is full", async () => {
    await db().driveConnection.create({ data: { userId, encryptedRefreshToken: "unit-test-only" } });
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "合計 1100円" } } });
    mocks.archive.mockRejectedValue({ response: { status: 403, data: { error: { errors: [{ reason: "storageQuotaExceeded" }] } } } });
    const jobs = await db().job.findMany({ where: { receiptId: receipt.id } });
    for (const kind of ["PDF", "ARCHIVE", "OCR"] as const) await runJob(jobs.find(job => job.kind === kind)!.id);
    const saved = await ownedReceipt(userId, receipt.id);
    expect(saved.pdfState).toBe("SAVED"); expect(saved.ocrState).toBe("DONE"); expect(saved.archiveState).toBe("BLOCKED"); expect(saved.archiveError).toBe("DRIVE_FULL");
  });
  it("recovers a lost PDF storage response without writing a second object", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const job = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    mocks.savePdf.mockRejectedValueOnce(new Error("response lost after durable write"));
    await runJob(job.id);
    expect((await ownedReceipt(userId, receipt.id)).pdfState).toBe("PENDING");
    mocks.pdfExists.mockResolvedValue(true);
    await db().job.update({ where: { id: job.id }, data: { nextRunAt: new Date(0) } });
    await runJob(job.id);
    expect(mocks.savePdf).toHaveBeenCalledTimes(1); expect((await ownedReceipt(userId, receipt.id)).pdfState).toBe("SAVED");
  });
  it("backfills a legacy app PDF without replacing its Drive ID or human edits", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const driveId = randomUUID();
    await db().receipt.update({ where: { id: receipt.id }, data: { archiveState: "SAVED", driveFileId: driveId, userEdited: true, totalYen: 55, version: 2 } });
    await db().job.deleteMany({ where: { receiptId: receipt.id, kind: "PDF" } });
    await reconcile();
    const pdf = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    await runJob(pdf.id);
    const saved = await ownedReceipt(userId, receipt.id);
    expect(saved.pdfState).toBe("SAVED"); expect(saved.driveFileId).toBe(driveId); expect(saved.totalYen).toBe(55); expect(saved.version).toBe(2); expect(saved.userEdited).toBe(true);
    expect(mocks.archive).not.toHaveBeenCalled(); expect(mocks.metadata).not.toHaveBeenCalled();
  });
  it("saves owned edits and revision atomically, rejecting stale or different-owner writes", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { ocrState: "DONE", rawOcr: { text: "private original evidence" } } });
    const values = { merchant: "Edited store", transactionDate: "2026-04-05", totalYen: 0, taxes: [], paymentMethod: null, registrationNumber: null, category: null, summary: null };
    await expect(saveReceiptEdit("different-owner", receipt.id, { version: 0, values })).rejects.toThrow("NOT_FOUND");
    const result = await saveReceiptEdit(userId, receipt.id, { version: 0, values });
    expect(result.totalYen).toBe(0); expect(result.version).toBe(1); expect(result.userEdited).toBe(true);
    expect(result.rawOcr).toEqual({ text: "private original evidence" });
    expect(await db().receiptRevision.count({ where: { receiptId: receipt.id, actorId: userId } })).toBe(1);
    await expect(saveReceiptEdit(userId, receipt.id, { version: 0, values: { ...values, totalYen: 999 } })).rejects.toThrow("EDIT_CONFLICT");
    expect((await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } })).totalYen).toBe(0);
    expect(await db().receiptRevision.count({ where: { receiptId: receipt.id } })).toBe(1);
  });
  it("waits for initial analysis before accepting manual edits", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await expect(saveReceiptEdit(userId, receipt.id, { version: 0, values: { merchant: null, transactionDate: null, totalYen: null, taxes: [], paymentMethod: null, registrationNumber: null, category: null, summary: null } })).rejects.toThrow("ANALYSIS_PENDING");
  });
  it("requeues metadata when values change during an existing metadata lease", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { ocrState: "DONE", archiveState: "SAVED", driveFileId: randomUUID() } });
    const job = await db().job.create({ data: { receiptId: receipt.id, kind: "METADATA" } });
    const lease = await claimJob(job.id);
    await saveReceiptEdit(userId, receipt.id, { version: 0, values: { merchant: "Corrected", transactionDate: null, totalYen: null, taxes: [], paymentMethod: null, registrationNumber: null, category: null, summary: null } });
    expect((await db().job.findUniqueOrThrow({ where: { id: job.id } })).leaseToken).toBe(lease!.leaseToken);
    await completeJob(job.id, lease!.leaseToken!, {}, 0);
    expect((await db().job.findUniqueOrThrow({ where: { id: job.id } })).state).toBe("PENDING");
  });
  it("recovers a direct upload without the browser's completion call", async () => {
    const checksum = createHash("sha256").update(image).digest("hex");
    const receipt = await beginIntake(userId, randomUUID(), new Date(), checksum, image.length, "image/jpeg");
    mocks.exists.mockImplementation(async (key: string) => key.endsWith(".incoming"));
    mocks.info.mockResolvedValue({ checksum, byteLength: image.length, generation: "1" });
    await reconcile();
    expect((await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } })).intakeState).toBe("ACCEPTED");
    expect(mocks.save).toHaveBeenCalledWith(receipt.objectKey, image, "image/jpeg", checksum);
    expect(await db().job.count({ where: { receiptId: receipt.id } })).toBe(2);
  });
  it("rejects a staged image whose bytes differ from the signed intake metadata", async () => {
    const receipt = await beginIntake(userId, randomUUID(), new Date(), createHash("sha256").update(image).digest("hex"), image.length, "image/jpeg");
    mocks.exists.mockImplementation(async (key: string) => key.endsWith(".incoming")); mocks.read.mockResolvedValue(Buffer.alloc(image.length));
    mocks.info.mockResolvedValue({ checksum: receipt.checksum, byteLength: image.length, generation: "1" });
    await expect(finishUpload(receipt)).rejects.toThrow("UPLOAD_CHECKSUM_MISMATCH");
    const result = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    expect(result.intakeState).toBe("UPLOADING"); expect(result.intakeError).toBe("UPLOAD_CHECKSUM_MISMATCH:1");
    expect(await db().job.count({ where: { receiptId: receipt.id } })).toBe(0); expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reconsiders a repaired staging generation even if the browser closes before completion", async () => {
    const receipt = await beginIntake(userId, randomUUID(), new Date(), createHash("sha256").update(image).digest("hex"), image.length, "image/jpeg");
    mocks.exists.mockResolvedValue(false); mocks.info.mockResolvedValue({ checksum: receipt.checksum, byteLength: image.length, generation: "1" }); mocks.read.mockResolvedValue(Buffer.alloc(image.length));
    await expect(finishUpload(receipt)).rejects.toThrow("UPLOAD_CHECKSUM_MISMATCH");
    const failed = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } });
    mocks.read.mockClear(); expect(await finishUpload(failed)).toBeNull(); expect(mocks.read).not.toHaveBeenCalled();
    mocks.info.mockResolvedValue({ checksum: receipt.checksum, byteLength: image.length, generation: "2" }); mocks.read.mockResolvedValue(image);
    await reconcile(); expect((await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } })).intakeState).toBe("ACCEPTED");
  });
  it("denies anonymous SQL access and keeps RLS active even with an accidental read grant", async () => {
    const state = await pg.query<{ enabled: boolean }>(`SELECT relrowsecurity AS enabled FROM pg_class WHERE relname = 'Receipt'`);
    expect(state.rows[0].enabled).toBe(true);
    await pg.exec('SET ROLE anon;');
    try { await expect(pg.query('SELECT * FROM "Receipt"')).rejects.toThrow(/permission denied/); } finally { await pg.exec('RESET ROLE;'); }
    await pg.exec('GRANT SELECT ON "Receipt" TO anon; SET ROLE anon;');
    try { expect((await pg.query('SELECT * FROM "Receipt"')).rows).toEqual([]); } finally { await pg.exec('RESET ROLE; REVOKE SELECT ON "Receipt" FROM anon;'); }
  });
  it("deduplicates a lost intake response and creates exactly two jobs", async () => {
    const captureId = randomUUID();
    const a = await intake(userId, captureId, new Date(), image, "image/jpeg");
    const b = await intake(userId, captureId, new Date(), image, "image/jpeg");
    expect(a.id).toBe(b.id); expect(a.intakeState).toBe("ACCEPTED"); expect(mocks.save).toHaveBeenCalledTimes(1);
    expect(await db().job.count({ where: { receiptId: a.id } })).toBe(2);
    expect((await db().usageDay.findFirstOrThrow({ where: { userId } })).intake).toBe(1);
  });
  it("does not merge a separate capture of the same photo", async () => {
    const a = await intake(userId, randomUUID(), new Date(), image, "image/jpeg"); const b = await intake(userId, randomUUID(), new Date(), image, "image/jpeg"); expect(a.id).not.toBe(b.id);
  });
  it("refuses changed bytes under the same capture ID", async () => {
    const captureId = randomUUID(); await intake(userId, captureId, new Date(), image, "image/jpeg");
    await expect(intake(userId, captureId, new Date(), Buffer.from("different"), "image/jpeg")).rejects.toThrow("CAPTURE_ID_CONFLICT");
  });
  it("denies another owner's image/receipt lookup", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg"); await expect(ownedReceipt("another-user", receipt.id)).rejects.toThrow("NOT_FOUND");
  });
  it("recovers a stored image when the original upload request never finalized", async () => {
    mocks.save.mockRejectedValueOnce(new Error("RESPONSE_LOST_AFTER_STORAGE"));
    await expect(intake(userId, randomUUID(), new Date(), image, "image/jpeg")).rejects.toThrow();
    expect((await db().receipt.findFirstOrThrow({ where: { userId } })).intakeState).toBe("UPLOADING");
    await reconcile(); const receipt = await db().receipt.findFirstOrThrow({ where: { userId } });
    expect(receipt.intakeState).toBe("ACCEPTED"); expect(await db().job.count({ where: { receiptId: receipt.id } })).toBe(2);
  });
  it("never acknowledges a missing object during reconciliation", async () => {
    mocks.save.mockRejectedValueOnce(new Error("STORAGE_DOWN")); mocks.exists.mockResolvedValue(false);
    await expect(intake(userId, randomUUID(), new Date(), image, "image/jpeg")).rejects.toThrow(); await reconcile();
    expect((await db().receipt.findFirstOrThrow({ where: { userId } })).intakeState).toBe("UPLOADING");
  });
  it("claims once and rejects completion from a stale worker after restart", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    const job = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "PDF" } });
    const [a, b] = await Promise.all([claimJob(job.id), claimJob(job.id)]); const first = a ?? b;
    expect([a, b].filter(Boolean)).toHaveLength(1);
    await db().job.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    await reconcile(); const next = await claimJob(job.id); expect(next?.leaseToken).not.toBe(first?.leaseToken);
    expect(await completeJob(job.id, first!.leaseToken!, { pdfState: "SAVED" })).toBe(false);
    expect(await completeJob(job.id, next!.leaseToken!, { pdfState: "SAVED" })).toBe(true);
  });
  it("archives even when OCR cannot read text", async () => {
    await db().driveConnection.create({ data: { userId, encryptedRefreshToken: "unit-test-only" } });
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "", pages: [] } } });
    const jobs = await db().job.findMany({ where: { receiptId: receipt.id } });
    await runJob(jobs.find(j => j.kind === "OCR")!.id); await runJob(jobs.find(j => j.kind === "PDF")!.id); await runJob(jobs.find(j => j.kind === "ARCHIVE")!.id);
    const result = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } }); expect(result.ocrState).toBe("FAILED"); expect(result.archiveState).toBe("SAVED");
  });
  it("preserves a user's edited values during subsequent OCR", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "合計 3300円" }, userEdited: true, values: { totalYen: 4000 }, totalYen: 4000, version: 2 } });
    const job = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "OCR" } }); await runJob(job.id);
    const result = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } }); expect(result.totalYen).toBe(4000); expect(result.version).toBe(2); expect(result.ocrState).toBe("DONE"); expect(result.extraction).toBeTruthy();
  });
});

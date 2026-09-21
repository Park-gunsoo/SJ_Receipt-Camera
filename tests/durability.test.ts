import { beforeAll, afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import sharp from "sharp";

const mocks = vi.hoisted(() => ({ save: vi.fn(), exists: vi.fn(), read: vi.fn(), info: vi.fn(), archive: vi.fn(), metadata: vi.fn(), dispatch: vi.fn() }));
vi.mock("@/lib/storage", () => ({ saveImage: mocks.save, imageExists: mocks.exists, readImage: mocks.read, incomingInfo: mocks.info, incomingKey: (key: string) => `${key}.incoming` }));
vi.mock("@/lib/drive", () => ({ archivePdf: mocks.archive, updatePdfMetadata: mocks.metadata }));
vi.mock("@/lib/queue", () => ({ dispatchPending: mocks.dispatch }));
import { db } from "../src/lib/db";
import { beginIntake, finishUpload, intake, ownedReceipt } from "../src/lib/receipts";
import { claimJob, completeJob, reconcile, runJob } from "../src/lib/jobs";

let pg: PGlite, server: PGLiteSocketServer, image: Buffer;
let userId: string;
beforeAll(async () => {
  vi.stubEnv("DATABASE_URL", "postgresql://postgres:postgres@127.0.0.1:5447/postgres"); vi.stubEnv("DB_POOL_SIZE", "1");
  pg = await PGlite.create();
  await pg.exec(await readFile("prisma/migrations/202609210001_initial/migration.sql", "utf8"));
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
  await pg.exec(await readFile("prisma/migrations/202609210002_private_access/migration.sql", "utf8"));
  await pg.exec(await readFile("prisma/migrations/202609210003_direct_upload/migration.sql", "utf8"));
  server = new PGLiteSocketServer({ db: pg, port: 5447, host: "127.0.0.1" }); await server.start();
  image = await sharp({ create: { width: 20, height: 40, channels: 3, background: "white" } }).jpeg().toBuffer();
});
afterAll(async () => { await db().$disconnect(); await server.stop(); await pg.close(); vi.unstubAllEnvs(); });
beforeEach(async () => {
  vi.clearAllMocks(); mocks.save.mockResolvedValue(undefined); mocks.exists.mockResolvedValue(true); mocks.read.mockResolvedValue(image); mocks.info.mockResolvedValue(null); mocks.archive.mockResolvedValue("drive-file"); mocks.dispatch.mockResolvedValue(undefined);
  userId = (await db().user.create({ data: { googleSub: randomUUID(), email: `${randomUUID()}@example.test` } })).id;
});
describe("durable intake and jobs (real SQL, stubbed cloud boundaries)", () => {
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
    const job = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "ARCHIVE" } });
    const [a, b] = await Promise.all([claimJob(job.id), claimJob(job.id)]); const first = a ?? b;
    expect([a, b].filter(Boolean)).toHaveLength(1);
    await db().job.update({ where: { id: job.id }, data: { leaseUntil: new Date(Date.now() - 1000) } });
    await reconcile(); const next = await claimJob(job.id); expect(next?.leaseToken).not.toBe(first?.leaseToken);
    expect(await completeJob(job.id, first!.leaseToken!, { archiveState: "SAVED" })).toBe(false);
    expect(await completeJob(job.id, next!.leaseToken!, { archiveState: "SAVED" })).toBe(true);
  });
  it("archives even when OCR cannot read text", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "", pages: [] } } });
    const jobs = await db().job.findMany({ where: { receiptId: receipt.id } });
    await runJob(jobs.find(j => j.kind === "OCR")!.id); await runJob(jobs.find(j => j.kind === "ARCHIVE")!.id);
    const result = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } }); expect(result.ocrState).toBe("FAILED"); expect(result.archiveState).toBe("SAVED");
  });
  it("preserves a user's edited values during subsequent OCR", async () => {
    const receipt = await intake(userId, randomUUID(), new Date(), image, "image/jpeg");
    await db().receipt.update({ where: { id: receipt.id }, data: { rawOcr: { text: "合計 3300円" }, userEdited: true, values: { totalYen: 4000 }, totalYen: 4000, version: 2 } });
    const job = await db().job.findFirstOrThrow({ where: { receiptId: receipt.id, kind: "OCR" } }); await runJob(job.id);
    const result = await db().receipt.findUniqueOrThrow({ where: { id: receipt.id } }); expect(result.totalYen).toBe(4000); expect(result.version).toBe(2); expect(result.ocrState).toBe("DONE"); expect(result.extraction).toBeTruthy();
  });
});

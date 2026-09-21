import { drive_v3 } from "googleapis/build/src/apis/drive/v3";
import { OAuth2Client } from "googleapis-common";
import { Readable } from "node:stream";
import { db } from "./db";
import { decrypt } from "./crypto";
import { appUrl, env } from "./config";
import type { ReceiptValues } from "./contracts";

export function oauthClient() { return new OAuth2Client(env("GOOGLE_CLIENT_ID"), env("GOOGLE_CLIENT_SECRET"), `${appUrl()}/api/drive/callback`); }
export async function driveClient(userId: string) {
  const connection = await db().driveConnection.findUnique({ where: { userId } });
  if (!connection) throw new Error("DRIVE_RECONNECT");
  const auth = oauthClient();
  auth.setCredentials({ refresh_token: decrypt(connection.encryptedRefreshToken) });
  return new drive_v3.Drive({ auth });
}
async function newFileId(drive: drive_v3.Drive) {
  const response = await drive.files.generateIds({ count: 1, space: "drive" }, { timeout: 30000 });
  const id = response.data.ids?.[0];
  if (!id) throw new Error("DRIVE_ID_FAILED");
  return id;
}
async function fileExists(drive: drive_v3.Drive, id: string) {
  try {
    const result = await drive.files.get({ fileId: id, fields: "id,trashed" }, { timeout: 30000 });
    if (result.data.trashed) throw new Error("DRIVE_FILE_TRASHED");
    return true;
  } catch (error) { if ((error as { response?: { status?: number } }).response?.status === 404) return false; throw error; }
}
export async function ensureFolder(drive: drive_v3.Drive, userId: string, path: string, name: string, parent?: string) {
  let folder = await db().driveFolder.findUnique({ where: { userId_path: { userId, path } } });
  if (!folder) folder = await db().driveFolder.upsert({ where: { userId_path: { userId, path } }, update: {}, create: { userId, path, fileId: await newFileId(drive) } });
  if (!await fileExists(drive, folder.fileId)) {
    try { await drive.files.create({ requestBody: { id: folder.fileId, name, mimeType: "application/vnd.google-apps.folder", parents: parent ? [parent] : undefined }, fields: "id" }, { timeout: 30000 }); }
    catch (error) { if ((error as { response?: { status?: number } }).response?.status !== 409 || !await fileExists(drive, folder.fileId)) throw error; }
  }
  return folder.fileId;
}
export async function ensureRoot(drive: drive_v3.Drive, userId: string) {
  const root = await ensureFolder(drive, userId, "root", "SJ レシートカメラ");
  await db().driveConnection.update({ where: { userId }, data: { rootFolderId: root } });
  return ensureFolder(drive, userId, "receipts", "領収書", root);
}
export async function destination(drive: drive_v3.Drive, userId: string, date: string | null) {
  const base = await ensureRoot(drive, userId);
  if (!date) return ensureFolder(drive, userId, "unknown", "日付未確認", base);
  const [year, month] = date.split("-");
  const yearId = await ensureFolder(drive, userId, year, year, base);
  return ensureFolder(drive, userId, `${year}/${month}`, month, yearId);
}
export function pdfName(id: string, capturedAt: Date, values: ReceiptValues | null) {
  const suffix = id.slice(0, 8);
  if (values?.transactionDate && values.merchant && values.totalYen !== null) return `${values.transactionDate}_${values.merchant.replace(/[\\/\x00-\x1f]/g, "_").slice(0, 60)}_${values.totalYen}円_${suffix}.pdf`;
  return `${capturedAt.toISOString().replace(/[:.]/g, "-")}_${suffix}.pdf`;
}
export async function archivePdf(receiptId: string, pdf: Buffer) {
  let receipt = await db().receipt.findUniqueOrThrow({ where: { id: receiptId } });
  const drive = await driveClient(receipt.userId);
  if (!receipt.driveFileId) {
    const candidate = await newFileId(drive);
    await db().receipt.updateMany({ where: { id: receiptId, driveFileId: null }, data: { driveFileId: candidate } });
    receipt = await db().receipt.findUniqueOrThrow({ where: { id: receiptId } });
  }
  const id = receipt.driveFileId!;
  if (await fileExists(drive, id)) return id;
  const values = receipt.values as ReceiptValues | null;
  const parent = await destination(drive, receipt.userId, values?.transactionDate ?? null);
  try {
    await drive.files.create({ requestBody: { id, name: pdfName(receipt.id, receipt.capturedAt, values), mimeType: "application/pdf", parents: [parent], appProperties: { sjReceiptId: receipt.id } }, media: { mimeType: "application/pdf", body: Readable.from(pdf) }, fields: "id" }, { timeout: 60000 });
  } catch (error) { if ((error as { response?: { status?: number } }).response?.status !== 409 || !await fileExists(drive, id)) throw error; }
  await db().receipt.update({ where: { id: receipt.id }, data: { driveFolderId: parent } });
  return id;
}
export async function updatePdfMetadata(receiptId: string) {
  const receipt = await db().receipt.findUniqueOrThrow({ where: { id: receiptId } });
  if (!receipt.driveFileId) throw new Error("ARCHIVE_PENDING");
  const drive = await driveClient(receipt.userId);
  const values = receipt.values as ReceiptValues | null;
  const parent = await destination(drive, receipt.userId, values?.transactionDate ?? null);
  const current = await drive.files.get({ fileId: receipt.driveFileId, fields: "parents,trashed" }, { timeout: 30000 });
  if (current.data.trashed) throw new Error("DRIVE_FILE_TRASHED");
  const old = current.data.parents ?? [];
  await drive.files.update({ fileId: receipt.driveFileId, requestBody: { name: pdfName(receipt.id, receipt.capturedAt, values) }, addParents: old.includes(parent) ? undefined : parent, removeParents: old.filter(id => id !== parent).join(",") || undefined }, { timeout: 30000 });
  await db().receipt.update({ where: { id: receipt.id }, data: { driveFolderId: parent } });
}
export async function readPdf(userId: string, fileId: string) {
  const drive = await driveClient(userId);
  const response = await drive.files.get({ fileId, alt: "media" }, { responseType: "arraybuffer", timeout: 30000 });
  return Buffer.from(response.data as ArrayBuffer);
}

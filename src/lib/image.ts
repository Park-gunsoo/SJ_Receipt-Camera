import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { AppError } from "./http";

export async function validateImage(bytes: Buffer, mime: string) {
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[mime]) throw new AppError("UNSUPPORTED_IMAGE", 415);
  try {
    const metadata = await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" }).metadata();
    if (metadata.format !== formats[mime] || !metadata.width || !metadata.height || (metadata.pages ?? 1) !== 1 || metadata.width > 20000 || metadata.height > 20000) throw new Error();
    // Decode fully before acknowledging receipt; catches truncated/invalid payloads.
    await sharp(bytes, { limitInputPixels: 40_000_000, failOn: "error" }).stats();
  } catch { throw new AppError("INVALID_IMAGE", 415); }
}
export async function normalizedImage(bytes: Buffer) {
  return sharp(bytes, { limitInputPixels: 40_000_000 }).rotate().flatten({ background: "#ffffff" }).jpeg({ quality: 94, mozjpeg: true }).toBuffer();
}
export async function createPdf(bytes: Buffer, mime: string) {
  const doc = await PDFDocument.create();
  let image;
  try { image = await doc.embedJpg(await normalizedImage(bytes)); }
  catch {
    if (mime === "image/png") image = await doc.embedPng(bytes);
    else if (mime === "image/jpeg") image = await doc.embedJpg(bytes);
    else throw new Error("PDF_IMAGE_DECODE_FAILED");
  }
  const scale = Math.min(1, 595 / image.width, 14000 / image.height);
  const width = image.width * scale, height = image.height * scale;
  const page = doc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });
  doc.setCreator("SJ Receipt Camera");
  return Buffer.from(await doc.save());
}

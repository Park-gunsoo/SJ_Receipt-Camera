import { expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { validateImage, createPdf } from "../src/lib/image";
it("builds a real one-page PDF without cropping a long image", async () => {
  const bytes = await sharp({ create: { width: 200, height: 1800, channels: 3, background: "white" } }).png().toBuffer();
  await expect(validateImage(bytes, "image/png")).resolves.toBeUndefined();
  const pdf = await PDFDocument.load(await createPdf(bytes, "image/png"));
  expect(pdf.getPageCount()).toBe(1); expect(pdf.getPage(0).getHeight() / pdf.getPage(0).getWidth()).toBeCloseTo(9);
});
it("rejects mismatched and corrupt files before accepting them", async () => {
  const bytes = await sharp({ create: { width: 10, height: 10, channels: 3, background: "white" } }).png().toBuffer();
  await expect(validateImage(bytes, "image/jpeg")).rejects.toThrow("INVALID_IMAGE");
  await expect(validateImage(Buffer.from("not-a-photo"), "image/png")).rejects.toThrow("INVALID_IMAGE");
  await expect(validateImage(bytes, "image/heic")).rejects.toThrow("UNSUPPORTED_IMAGE");
});

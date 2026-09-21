import { createPdf } from "./image";
import { pdfExists, readImage, savePdf } from "./storage";

export async function ensureAppPdf(receipt: { objectKey: string; checksum: string; mimeType: string }) {
  if (await pdfExists(receipt.objectKey, receipt.checksum)) return;
  const bytes = await createPdf(await readImage(receipt.objectKey), receipt.mimeType);
  await savePdf(receipt.objectKey, bytes, receipt.checksum);
}

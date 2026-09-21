import type { PendingCapture } from "./offline";
import type { ReceiptView } from "./contracts";

async function responseJson(response: Response) {
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "UPLOAD_ERROR");
  return data;
}
export async function uploadCapture(item: PendingCapture): Promise<ReceiptView> {
  const checksum = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", await item.blob.arrayBuffer()))).map(byte => byte.toString(16).padStart(2, "0")).join("");
  const headers = { "Content-Type": "application/json", "X-SJ-Owner": item.ownerId };
  const initialized = await responseJson(await fetch("/api/uploads", { method: "POST", headers, body: JSON.stringify({ captureId: item.captureId, capturedAt: item.capturedAt, checksum, byteLength: item.blob.size, mimeType: item.blob.type }), signal: AbortSignal.timeout(90000) }));
  if (initialized.receipt?.intakeState === "ACCEPTED") return initialized.receipt;
  const form = new FormData();
  for (const [key, value] of Object.entries(initialized.upload.fields as Record<string, string>)) form.append(key, value);
  form.append("file", item.blob, "receipt"); // GCS requires the file to be the final field.
  const upload = await fetch(initialized.upload.url, { method: "POST", body: form, credentials: "omit", signal: AbortSignal.timeout(120000) });
  if (!upload.ok) throw new Error("UPLOAD_ERROR");
  const completed = await responseJson(await fetch(`/api/uploads/${initialized.receiptId}/complete`, { method: "POST", headers, signal: AbortSignal.timeout(90000) }));
  if (completed.receipt?.intakeState !== "ACCEPTED") throw new Error("UPLOAD_PENDING");
  return completed.receipt;
}

import { z } from "zod";
import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { configuration, setting } from "@/lib/config";
import { beginIntake, finishUpload, receiptView } from "@/lib/receipts";
import { uploadPolicy } from "@/lib/storage";
import { dispatchPending } from "@/lib/queue";
import { apiError, AppError, json, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    if (!configuration().ready) throw new AppError("NOT_CONFIGURED", 503);
    if (Number(request.headers.get("content-length")) > 8192) throw new AppError("INVALID_UPLOAD");
    const body = await request.text();
    if (body.length > 8192) throw new AppError("INVALID_UPLOAD");
    let parsed: unknown;
    try { parsed = JSON.parse(body); } catch { throw new AppError("INVALID_UPLOAD"); }
    const input = z.object({ captureId: z.uuid(), capturedAt: z.iso.datetime(), checksum: z.string().regex(/^[a-f0-9]{64}$/), byteLength: z.number().int().min(1).max(setting("MAX_UPLOAD_MB", 12, 20) * 1024 * 1024), mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]) }).safeParse(parsed);
    if (!input.success) throw new AppError("INVALID_UPLOAD");
    const { captureId, capturedAt, checksum, byteLength, mimeType } = input.data;
    // Existing accepted captures can be acknowledged even if Drive needs reconnecting.
    const receipt = await beginIntake(user.id, captureId, new Date(capturedAt), checksum, byteLength, mimeType);
    let completed;
    try { completed = await finishUpload(receipt); }
    catch (error) {
      if (!(error instanceof AppError) || !["UPLOAD_CHECKSUM_MISMATCH", "INVALID_IMAGE", "UNSUPPORTED_IMAGE"].includes(error.code)) throw error;
      // A bad/partial staging object can be replaced by the original local Blob.
      completed = null;
    }
    if (completed) { after(() => dispatchPending(completed.id)); return json({ receipt: receiptView(completed) }); }
    return json({ receiptId: receipt.id, upload: await uploadPolicy(receipt.objectKey, mimeType, checksum, byteLength) });
  } catch (error) { return apiError(error); }
}

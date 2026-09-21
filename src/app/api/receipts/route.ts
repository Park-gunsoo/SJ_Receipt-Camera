import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { configuration, setting } from "@/lib/config";
import { db } from "@/lib/db";
import { apiError, AppError, boundedFormData, json, sameOrigin } from "@/lib/http";
import { intake, receiptView } from "@/lib/receipts";
import { dispatchPending } from "@/lib/queue";
import { after } from "next/server";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    if (!configuration().ready) throw new AppError("NOT_CONFIGURED", 503);
    const max = setting("MAX_UPLOAD_MB", 12, 20) * 1024 * 1024;
    const form = await boundedFormData(request, max + 65536);
    const input = z.object({ captureId: z.uuid(), capturedAt: z.iso.datetime() }).safeParse({ captureId: form.get("captureId"), capturedAt: form.get("capturedAt") });
    const file = form.get("image");
    if (!input.success || !(file instanceof File) || !file.size) throw new AppError("INVALID_UPLOAD");
    if (file.size > max) throw new AppError("FILE_TOO_LARGE", 413);
    const receipt = await intake(user.id, input.data.captureId, new Date(input.data.capturedAt), Buffer.from(await file.arrayBuffer()), file.type);
    // Durable jobs exist already. Scheduler can dispatch if this request ends here.
    // Do not wait for Google queue/OCR/Drive on the receipt acceptance response.
    after(() => dispatchPending(receipt.id));
    return json({ receipt: receiptView(receipt) }, 202);
  } catch (error) { return apiError(error); }
}
export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const p = new URL(request.url).searchParams;
    const q = (p.get("q") ?? "").trim().slice(0, 100);
    const from = p.get("from"), to = p.get("to"), cursor = p.get("cursor");
    if ([from, to].some(value => value && !/^\d{4}-\d{2}-\d{2}$/.test(value))) throw new AppError("INVALID_DATE");
    const where = { userId: user.id, deletedAt: null, intakeState: "ACCEPTED" as const, ...(q ? { merchant: { contains: q, mode: "insensitive" as const } } : {}), ...((from || to) ? { transactionDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}) };
    if (cursor && !await db().receipt.findFirst({ where: { ...where, id: cursor }, select: { id: true } })) throw new AppError("INVALID_CURSOR");
    const rows = await db().receipt.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 31, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
    return json({ receipts: rows.slice(0, 30).map(receiptView), nextCursor: rows.length > 30 ? rows[29].id : null });
  } catch (error) { return apiError(error); }
}

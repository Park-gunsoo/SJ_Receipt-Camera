import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { finishUpload, receiptView } from "@/lib/receipts";
import { dispatchPending } from "@/lib/queue";
import { apiError, AppError, json, sameOrigin } from "@/lib/http";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const receipt = await db().receipt.findFirst({ where: { id: (await params).id, userId: user.id, deletedAt: null } });
    if (!receipt) throw new AppError("NOT_FOUND", 404);
    const completed = await finishUpload(receipt);
    if (!completed) throw new AppError("UPLOAD_PENDING", 409);
    after(() => dispatchPending(completed.id));
    return json({ receipt: receiptView(completed) }, 202);
  } catch (error) { return apiError(error); }
}

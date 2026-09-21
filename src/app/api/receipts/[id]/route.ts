import { requireUser } from "@/lib/auth";
import { ownedReceipt, receiptView } from "@/lib/receipts";
import { apiError, AppError, boundedJson, json, sameOrigin } from "@/lib/http";
import { receiptEditSchema, saveReceiptEdit } from "@/lib/receipt-editor";
import { dispatchPending } from "@/lib/queue";
import { after } from "next/server";
import { receiptTrashSchema, setReceiptTrashed } from "@/lib/receipt-trash";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return json({ receipt: receiptView(await ownedReceipt(user.id, (await params).id)) }); }
  catch (error) { return apiError(error); }
}
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const input = receiptEditSchema.safeParse(await boundedJson(request));
    if (!input.success) throw new AppError("INVALID_INPUT", 422);
    const receipt = await saveReceiptEdit(user.id, (await params).id, input.data);
    after(() => dispatchPending(receipt.id));
    return json({ receipt: receiptView(receipt) });
  } catch (error) { return apiError(error); }
}
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const input = receiptTrashSchema.safeParse(await boundedJson(request, 1024));
    if (!input.success) throw new AppError("INVALID_INPUT", 422);
    return json(await setReceiptTrashed(user.id, (await params).id, input.data.version, true));
  } catch (error) { return apiError(error); }
}

import { after } from "next/server";
import { requireUser } from "@/lib/auth";
import { apiError, AppError, boundedJson, json, sameOrigin } from "@/lib/http";
import { dispatchPending } from "@/lib/queue";
import { receiptTrashSchema, setReceiptTrashed } from "@/lib/receipt-trash";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const input = receiptTrashSchema.safeParse(await boundedJson(request, 1024));
    if (!input.success) throw new AppError("INVALID_INPUT", 422);
    const result = await setReceiptTrashed(user.id, (await params).id, input.data.version, false);
    after(() => dispatchPending(result.id));
    return json(result);
  } catch (error) { return apiError(error); }
}

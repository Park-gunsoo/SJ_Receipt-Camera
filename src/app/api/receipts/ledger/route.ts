import { requireUser } from "@/lib/auth";
import { apiError, AppError, json } from "@/lib/http";
import { parseLedgerQuery } from "@/lib/ledger-query";
import { listReceiptLedger } from "@/lib/receipt-ledger";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const input = parseLedgerQuery(new URL(request.url).searchParams);
    if (!input.success) throw new AppError("INVALID_FILTER", 422);
    return json(await listReceiptLedger(user.id, input.data));
  } catch (error) { return apiError(error); }
}

import { requireUser } from "@/lib/auth";
import { apiError, AppError, boundedJson, sameOrigin } from "@/lib/http";
import { defaultLedgerQuery, parseLedgerQuery } from "@/lib/ledger-query";
import { exportReceiptLedger } from "@/lib/receipt-ledger";
import { createReceiptWorkbook, receiptExportSchema } from "@/lib/receipt-export";

export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    sameOrigin(request);
    const user = await requireUser();
    if (request.headers.get("x-sj-owner") !== user.id) throw new AppError("ACCOUNT_CHANGED", 409);
    const input = receiptExportSchema.safeParse(await boundedJson(request, 8192));
    if (!input.success) throw new AppError("INVALID_INPUT", 422);
    const parsed = parseLedgerQuery(new URLSearchParams(input.data.query));
    if (!parsed.success) throw new AppError("INVALID_FILTER", 422);
    const rows = await exportReceiptLedger(user.id, input.data.scope === "all" ? defaultLedgerQuery : parsed.data);
    const now = new Date();
    const bytes = await createReceiptWorkbook(rows, input.data.locale, input.data.scope, now);
    const stamp = new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString().replace(/[-:]/g, "").slice(0, 15).replace("T", "_");
    return new Response(bytes, { headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="SJ_receipts_${stamp}_${input.data.locale}.xlsx"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-SJ-Receipt-Count": String(rows.length),
    } });
  } catch (error) { return apiError(error); }
}

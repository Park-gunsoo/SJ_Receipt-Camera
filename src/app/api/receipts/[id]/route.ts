import { requireUser } from "@/lib/auth";
import { ownedReceipt, receiptView } from "@/lib/receipts";
import { apiError, json } from "@/lib/http";
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); return json({ receipt: receiptView(await ownedReceipt(user.id, (await params).id)) }); }
  catch (error) { return apiError(error); }
}

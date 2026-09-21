import { requireUser } from "@/lib/auth";
import { apiError, json } from "@/lib/http";
import { listTrashedReceipts } from "@/lib/receipt-trash";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    return json(await listTrashedReceipts(user.id, new URL(request.url).searchParams.get("cursor")));
  } catch (error) { return apiError(error); }
}

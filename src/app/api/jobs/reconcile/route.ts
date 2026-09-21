import { requireWorker } from "@/lib/queue";
import { reconcile } from "@/lib/jobs";
import { apiError, json } from "@/lib/http";
export async function POST(request: Request) {
  try { await requireWorker(request); return json(await reconcile()); }
  catch (error) { return apiError(error); }
}

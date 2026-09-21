import { z } from "zod";
import { requireWorker } from "@/lib/queue";
import { runJob } from "@/lib/jobs";
import { apiError, AppError, json } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    await requireWorker(request);
    const input = z.object({ jobId: z.uuid() }).safeParse(await request.json());
    if (!input.success) throw new AppError("INVALID_JOB");
    return json(await runJob(input.data.jobId));
  } catch (error) { return apiError(error); }
}

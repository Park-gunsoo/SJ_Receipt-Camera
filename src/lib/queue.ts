import { CloudTasksClient } from "@google-cloud/tasks";
import { OAuth2Client } from "google-auth-library";
import { db } from "./db";
import { env, workerUrl } from "./config";
import { AppError } from "./http";
import { googleCloudOptions } from "./google-cloud";

let tasks: CloudTasksClient | undefined;
export async function dispatchPending(receiptId?: string) {
  tasks ??= new CloudTasksClient(googleCloudOptions());
  const stale = new Date(Date.now() - 15 * 60000);
  const eligible = { state: "PENDING" as const, nextRunAt: { lte: new Date() }, AND: [{ OR: [{ enqueuedAt: null }, { enqueuedAt: { lt: stale } }] }, { OR: [{ kind: { not: "ARCHIVE" as const } }, { receipt: { pdfState: "SAVED" as const } }] }], ...(receiptId ? { receiptId } : {}) };
  const jobs = await db().job.findMany({ where: eligible, select: { id: true }, take: 40, orderBy: { nextRunAt: "asc" } });
  for (const job of jobs) {
    const claimed = await db().job.updateMany({ where: { id: job.id, ...eligible }, data: { enqueuedAt: new Date() } });
    if (!claimed.count) continue;
    try {
      await tasks.createTask({ parent: tasks.queuePath(env("GCP_PROJECT_ID"), env("TASKS_LOCATION"), env("TASKS_QUEUE")), task: { dispatchDeadline: { seconds: 600 }, httpRequest: { httpMethod: "POST", url: `${workerUrl()}/api/jobs/run`, headers: { "Content-Type": "application/json" }, body: Buffer.from(JSON.stringify({ jobId: job.id })).toString("base64"), oidcToken: { serviceAccountEmail: env("TASK_SERVICE_ACCOUNT_EMAIL"), audience: workerUrl() } } } }, { timeout: 10000 });
    } catch {
      await db().job.updateMany({ where: { id: job.id, state: "PENDING" }, data: { enqueuedAt: null } });
      console.error(JSON.stringify({ event: "queue_dispatch_failed", jobId: job.id }));
    }
  }
}
export async function requireWorker(request: Request) {
  const token = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw new AppError("UNAUTHORIZED", 401);
  try {
    const ticket = await new OAuth2Client().verifyIdToken({ idToken: token, audience: workerUrl() });
    const payload = ticket.getPayload();
    if (!payload?.email_verified || payload.email !== env("TASK_SERVICE_ACCOUNT_EMAIL")) throw new Error();
  } catch { throw new AppError("UNAUTHORIZED", 401); }
}

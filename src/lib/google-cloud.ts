import { env } from "./config";

/** Cloud Run uses its attached identity; Vercel receives a server-only encrypted secret. */
export function googleCloudOptions() {
  const projectId = env("GCP_PROJECT_ID");
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return { projectId };
  let value: { type?: string; client_email?: string; private_key?: string; project_id?: string };
  try { value = JSON.parse(raw); } catch { throw new Error("INVALID_GOOGLE_CREDENTIALS"); }
  if (value.type !== "service_account" || !value.client_email || !value.private_key || value.project_id !== projectId) throw new Error("INVALID_GOOGLE_CREDENTIALS");
  return { projectId, credentials: { client_email: value.client_email, private_key: value.private_key } };
}

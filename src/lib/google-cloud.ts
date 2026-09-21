import { env } from "./config";
import { getVercelOidcToken } from "@vercel/oidc";

/** Cloud Run uses its attached identity; Vercel exchanges short-lived OIDC tokens. */
export function googleCloudOptions() {
  const projectId = env("GCP_PROJECT_ID");
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw && (process.env.VERCEL || process.env.GOOGLE_USE_VERCEL_OIDC === "true")) {
    return {
      projectId,
      credentials: {
        type: "external_account" as const,
        audience: `//iam.googleapis.com/projects/${env("GCP_PROJECT_NUMBER")}/locations/global/workloadIdentityPools/${env("GCP_WORKLOAD_IDENTITY_POOL_ID")}/providers/${env("GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID")}`,
        subject_token_type: "urn:ietf:params:oauth:token-type:jwt",
        token_url: "https://sts.googleapis.com/v1/token",
        service_account_impersonation_url: `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${env("GCP_SERVICE_ACCOUNT_EMAIL")}:generateAccessToken`,
        subject_token_supplier: { getSubjectToken: async () => getVercelOidcToken() },
      },
    };
  }
  if (!raw) return { projectId };
  let value: { type?: string; client_email?: string; private_key?: string; project_id?: string };
  try { value = JSON.parse(raw); } catch { throw new Error("INVALID_GOOGLE_CREDENTIALS"); }
  if (value.type !== "service_account" || !value.client_email || !value.private_key || value.project_id !== projectId) throw new Error("INVALID_GOOGLE_CREDENTIALS");
  return { projectId, credentials: { client_email: value.client_email, private_key: value.private_key } };
}

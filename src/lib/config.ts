const required = ["DATABASE_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TOKEN_ENCRYPTION_KEY", "TESTER_EMAILS", "GCP_PROJECT_ID", "GCS_BUCKET", "TASKS_LOCATION", "TASKS_QUEUE", "TASK_SERVICE_ACCOUNT_EMAIL", "APP_URL", "WORKER_BASE_URL"] as const;

export function configuration() {
  const missing: string[] = required.filter((key) => !process.env[key]?.trim());
  if (process.env.VERCEL && !process.env.GOOGLE_SERVICE_ACCOUNT_JSON?.trim()) {
    for (const key of ["GCP_PROJECT_NUMBER", "GCP_SERVICE_ACCOUNT_EMAIL", "GCP_WORKLOAD_IDENTITY_POOL_ID", "GCP_WORKLOAD_IDENTITY_POOL_PROVIDER_ID"]) if (!process.env[key]?.trim()) missing.push(key);
  }
  return { ready: missing.length === 0, missing, loginReady: ["DATABASE_URL", "NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "TESTER_EMAILS"].every(key => !!process.env[key]?.trim()) };
}
export function env(key: string) {
  const value = process.env[key]?.trim();
  if (!value) throw new Error(`CONFIG_MISSING:${key}`);
  return value;
}
export function setting(key: string, fallback: number, max = 100000) {
  const n = Number(process.env[key] ?? fallback);
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(`CONFIG_INVALID:${key}`);
  return n;
}
export function appUrl() { return env("APP_URL").replace(/\/$/, ""); }
export function workerUrl() { return env("WORKER_BASE_URL").replace(/\/$/, ""); }
export function allowedEmail(email: string) {
  return (process.env.TESTER_EMAILS ?? "").split(",").map(s => s.trim().toLowerCase()).filter(Boolean).includes(email.toLowerCase());
}

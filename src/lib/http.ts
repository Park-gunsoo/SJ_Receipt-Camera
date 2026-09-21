export class AppError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "private, no-store" } });
}
export function apiError(error: unknown) {
  if (error instanceof AppError) return json({ error: error.code }, error.status);
  // Intentionally do not log exception bodies, tokens, OCR or user documents.
  console.error(JSON.stringify({ event: "api_error", code: "INTERNAL_ERROR" }));
  return json({ error: "INTERNAL_ERROR" }, 500);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(process.env.APP_URL ?? request.url).origin;
  if (!origin || origin !== expected) throw new AppError("INVALID_ORIGIN", 403);
}
export async function boundedJson(request: Request, limit = 32768): Promise<unknown> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get("content-type") ?? "") || Number(request.headers.get("content-length")) > limit || !request.body) throw new AppError("INVALID_INPUT");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AppError("INVALID_INPUT"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return JSON.parse(new TextDecoder().decode(bytes)); } catch { throw new AppError("INVALID_INPUT"); }
}
export async function boundedFormData(request: Request, maxBytes: number) {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new AppError("FILE_TOO_LARGE", 413);
  if (!request.body) throw new AppError("INVALID_UPLOAD");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new AppError("FILE_TOO_LARGE", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return await new Response(bytes, { headers: { "Content-Type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new AppError("INVALID_UPLOAD"); }
}
export function googleError(error: unknown): string {
  const e = error as { code?: number | string; response?: { status?: number; data?: { error?: string | { errors?: { reason?: string }[] } } } };
  const detail = e?.response?.data?.error;
  const reason = typeof detail === "string" ? detail : detail?.errors?.[0]?.reason;
  if (reason === "invalid_grant" || e?.response?.status === 401) return "DRIVE_RECONNECT";
  if (reason === "storageQuotaExceeded") return "DRIVE_FULL";
  if (e?.response?.status === 403 && reason !== "rateLimitExceeded" && reason !== "userRateLimitExceeded") return "DRIVE_PERMISSION";
  return "PROCESSING_ERROR";
}

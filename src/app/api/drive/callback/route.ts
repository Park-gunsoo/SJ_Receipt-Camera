import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";
import { db } from "@/lib/db";
import { oauthClient, ensureRoot, driveClient } from "@/lib/drive";
import { appUrl, env } from "@/lib/config";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const jar = await cookies();
  const cookie = jar.get("sj-drive-state")?.value;
  jar.set("sj-drive-state", "", { path: "/api/drive", maxAge: 0 });
  try {
    const user = await requireUser();
    if (!cookie || !url.searchParams.get("code")) throw new Error("CONSENT_FAILED");
    const state = JSON.parse(decrypt(cookie)) as { state: string; userId: string; expires: number };
    if (state.state !== url.searchParams.get("state") || state.userId !== user.id || state.expires < Date.now()) throw new Error("INVALID_STATE");
    const oauth = oauthClient();
    const { tokens } = await oauth.getToken(url.searchParams.get("code")!);
    if (!tokens.id_token || !tokens.scope?.split(" ").includes("https://www.googleapis.com/auth/drive.file")) throw new Error("MISSING_SCOPE");
    const identity = await oauth.verifyIdToken({ idToken: tokens.id_token, audience: env("GOOGLE_CLIENT_ID") });
    if (identity.getPayload()?.sub !== user.googleSub) throw new Error("ACCOUNT_MISMATCH");
    if (!tokens.refresh_token && !user.drive) throw new Error("NO_REFRESH_TOKEN");
    const token = tokens.refresh_token ? encrypt(tokens.refresh_token) : user.drive!.encryptedRefreshToken;
    await db().driveConnection.upsert({ where: { userId: user.id }, create: { userId: user.id, encryptedRefreshToken: token }, update: { encryptedRefreshToken: token, status: "CONNECTED" } });
    await ensureRoot(await driveClient(user.id), user.id);
    await db().job.updateMany({ where: { receipt: { userId: user.id, deletedAt: null }, state: "BLOCKED", lastError: { in: ["DRIVE_RECONNECT", "DRIVE_PERMISSION", "DRIVE_FULL", "DRIVE_FILE_TRASHED"] } }, data: { state: "PENDING", attempts: 0, nextRunAt: new Date(), lastError: null } });
    return Response.redirect(`${appUrl()}/m/capture`);
  } catch {
    return Response.redirect(`${appUrl()}/m/account?connection=failed`);
  }
}

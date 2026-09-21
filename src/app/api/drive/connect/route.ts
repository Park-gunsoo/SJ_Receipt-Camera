import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { oauthClient } from "@/lib/drive";
import { encrypt } from "@/lib/crypto";
import { apiError } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser();
    const state = randomBytes(32).toString("base64url");
    const jar = await cookies();
    jar.set("sj-drive-state", encrypt(JSON.stringify({ state, userId: user.id, expires: Date.now() + 600000 })), { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/drive", maxAge: 600 });
    const url = oauthClient().generateAuthUrl({ access_type: "offline", prompt: "consent", scope: ["openid", "email", "https://www.googleapis.com/auth/drive.file"], state, login_hint: user.email });
    return Response.redirect(url);
  } catch (error) { return apiError(error); }
}

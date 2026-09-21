import type { NextAuthOptions } from "next-auth";
import { getServerSession } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { db } from "./db";
import { allowedEmail, configuration } from "./config";
import { AppError } from "./http";

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt", maxAge: 7 * 24 * 60 * 60 },
  providers: [GoogleProvider({ clientId: process.env.GOOGLE_CLIENT_ID ?? "", clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "", authorization: { params: { scope: "openid email profile" } } })],
  pages: { signIn: "/m/start", error: "/m/start" },
  logger: { error: () => console.error("AUTH_ERROR"), warn: () => {}, debug: () => {} },
  callbacks: {
    async signIn({ profile }) {
      const p = profile as { sub?: string; email?: string; email_verified?: boolean; name?: string } | undefined;
      if (!p?.sub || !p.email || !p.email_verified || !allowedEmail(p.email)) return false;
      await db().user.upsert({ where: { googleSub: p.sub }, create: { googleSub: p.sub, email: p.email.toLowerCase(), name: p.name }, update: { email: p.email.toLowerCase(), name: p.name } });
      return true;
    },
    async jwt({ token, account }) {
      if (account?.providerAccountId) token.userId = (await db().user.findUnique({ where: { googleSub: account.providerAccountId }, select: { id: true } }))?.id;
      return token;
    },
    async session({ session, token }) { session.user.id = token.userId ?? ""; return session; },
  },
};
export async function currentUser() {
  if (!configuration().loginReady) return null;
  const session = await getServerSession(authOptions);
  if (!session?.user.id) return null;
  const user = await db().user.findUnique({ where: { id: session.user.id }, include: { drive: true } });
  return user && allowedEmail(user.email) ? user : null;
}
export async function requireUser() {
  const user = await currentUser();
  if (!user) throw new AppError("UNAUTHORIZED", 401);
  return user;
}

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { db, pgEnabled } from "../db";
import { checkLoginLocked, recordLoginFailure, resetLoginAttempts } from "./rate-limit";

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

function requestIp(request: Request): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/** Same derivation as before: a stable fallback for self-hosters who haven't
 *  set AUTH_SECRET, so team mode still works out of the box. */
function deriveFallbackSecret(): string {
  if (!process.env.AUTH_SECRET && pgEnabled()) {
    console.warn("AUTH_SECRET not set — using a derived secret. Set AUTH_SECRET in production.");
  }
  return createHash("sha256").update(`salesrx:${process.env.DATABASE_URL || "local"}`).digest("hex");
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET || deriveFallbackSecret(),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  logger: {
    // A wrong password or a lockout is a normal event, not a server error
    // worth a stack trace (RateLimitedError extends CredentialsSignin).
    error(error) {
      if (error instanceof CredentialsSignin) return;
      console.error("[auth]", error);
    },
  },
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(credentials, request) {
        const email = String(credentials?.email || "").toLowerCase().trim();
        const password = String(credentials?.password || "");
        const ip = requestIp(request);
        if (!email || !password) return null;

        const locked = await checkLoginLocked(email, ip);
        if (locked.locked) throw new RateLimitedError();

        const p = await db();
        const r = await p.query(
          "SELECT id, email, name, password_hash, workspace_id, role FROM users WHERE email=$1",
          [email]
        );
        const u = r.rows[0];
        const ok = u ? await bcrypt.compare(password, u.password_hash) : false;
        if (!ok) {
          const nowLocked = await recordLoginFailure(email, ip);
          if (nowLocked.locked) throw new RateLimitedError();
          throw new CredentialsSignin();
        }

        await resetLoginAttempts(email);
        return { id: u.id, email: u.email, name: u.name, workspaceId: u.workspace_id, role: u.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id!;
        token.workspaceId = user.workspaceId;
        token.role = user.role;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.workspaceId = token.workspaceId;
      session.user.role = token.role;
      return session;
    },
  },
});

export { RateLimitedError };

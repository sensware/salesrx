/**
 * v2.0 auth — only active in Postgres mode. Without DATABASE_URL the app runs
 * in single-user "local" mode with no login, exactly like v1.x.
 *
 * Built on Auth.js (next-auth) — see ./config.ts for the provider/session
 * setup and ./rate-limit.ts for login lockout.
 */
import { randomUUID, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { db, pgEnabled } from "../db";
import { auth, handlers, signIn, signOut } from "./config";
import { checkRegisterLocked, recordRegisterAttempt } from "./rate-limit";

export interface Ctx {
  userId: string;
  workspaceId: string;
  email?: string;
  name?: string;
  role?: string;
}

export { auth, handlers, signIn, signOut };
export { RateLimitedError } from "./config";
export { checkRegisterLocked, recordRegisterAttempt } from "./rate-limit";

/** Resolve the request context. Local mode always succeeds; pg mode requires a session. */
export async function getCtx(): Promise<Ctx | null> {
  if (!pgEnabled()) return { userId: "local", workspaceId: "local" };
  const session = await auth();
  if (!session?.user) return null;
  return {
    userId: session.user.id!,
    workspaceId: session.user.workspaceId,
    email: session.user.email ?? undefined,
    name: session.user.name ?? undefined,
    role: session.user.role,
  };
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
}

/** Build a Ctx from the users table by email. Used right after sign-in, when the
 *  freshly-set session cookie isn't yet visible to `auth()` in the same request. */
export async function ctxByEmail(email: string): Promise<Ctx | null> {
  const p = await db();
  const r = await p.query(
    "SELECT id, email, name, workspace_id, role FROM users WHERE email=$1",
    [email.toLowerCase().trim()]
  );
  const u = r.rows[0];
  if (!u) return null;
  return { userId: u.id, workspaceId: u.workspace_id, email: u.email, name: u.name, role: u.role };
}

// ── user & workspace operations (pg mode only) ──

export async function registerUser(input: {
  email: string; password: string; name: string;
  workspaceName?: string; inviteCode?: string;
}): Promise<Ctx> {
  const p = await db();
  const email = input.email.toLowerCase().trim();
  const existing = await p.query("SELECT id FROM users WHERE email=$1", [email]);
  if (existing.rows.length) throw new Error("An account with this email already exists");

  let workspaceId: string;
  let role = "member";
  if (input.inviteCode) {
    const ws = await p.query("SELECT id FROM workspaces WHERE invite_code=$1", [input.inviteCode.trim()]);
    if (!ws.rows.length) throw new Error("Invalid invite code");
    workspaceId = ws.rows[0].id;
  } else {
    workspaceId = randomUUID();
    role = "admin";
    const invite = randomBytes(4).toString("hex");
    await p.query("INSERT INTO workspaces (id, name, invite_code) VALUES ($1,$2,$3)", [
      workspaceId, input.workspaceName?.trim() || `${input.name.split(" ")[0]}'s team`, invite,
    ]);
  }

  const userId = randomUUID();
  const hash = await bcrypt.hash(input.password, 10);
  await p.query(
    "INSERT INTO users (id, email, name, password_hash, workspace_id, role) VALUES ($1,$2,$3,$4,$5,$6)",
    [userId, email, input.name.trim(), hash, workspaceId, role]
  );
  return { userId, workspaceId, email, name: input.name.trim(), role };
}

export async function workspaceInfo(workspaceId: string) {
  const p = await db();
  const ws = await p.query("SELECT id, name, invite_code FROM workspaces WHERE id=$1", [workspaceId]);
  const members = await p.query(
    "SELECT email, name, role, google_refresh_token IS NOT NULL AS calendar_connected FROM users WHERE workspace_id=$1 ORDER BY created_at",
    [workspaceId]
  );
  return { workspace: ws.rows[0] || null, members: members.rows };
}

export async function setGoogleToken(userId: string, refreshToken: string): Promise<void> {
  const p = await db();
  await p.query("UPDATE users SET google_refresh_token=$1 WHERE id=$2", [refreshToken, userId]);
}

export async function getGoogleToken(userId: string): Promise<string | null> {
  if (!pgEnabled()) return null;
  const p = await db();
  const r = await p.query("SELECT google_refresh_token FROM users WHERE id=$1", [userId]);
  return r.rows[0]?.google_refresh_token || null;
}

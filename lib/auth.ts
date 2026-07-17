/**
 * v2.0 auth — only active in Postgres mode. Without DATABASE_URL the app runs
 * in single-user "local" mode with no login, exactly like v1.x.
 */
import { NextRequest, NextResponse } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { createHash, randomUUID, randomBytes } from "crypto";
import { db, pgEnabled } from "./db";

export interface Ctx {
  userId: string;
  workspaceId: string;
  email?: string;
  name?: string;
  role?: string;
}

const COOKIE = "salesrx_session";

function secret(): Uint8Array {
  const s =
    process.env.AUTH_SECRET ||
    createHash("sha256").update(`salesrx:${process.env.DATABASE_URL || "local"}`).digest("hex");
  if (!process.env.AUTH_SECRET && pgEnabled()) {
    console.warn("AUTH_SECRET not set — using a derived secret. Set AUTH_SECRET in production.");
  }
  return new TextEncoder().encode(s);
}

export async function issueSession(res: NextResponse, ctx: Ctx): Promise<void> {
  const token = await new SignJWT({ ...ctx })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  res.cookies.set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearSession(res: NextResponse): void {
  res.cookies.set(COOKIE, "", { httpOnly: true, path: "/", maxAge: 0 });
}

/** Resolve the request context. Local mode always succeeds; pg mode requires a session. */
export async function getCtx(req: NextRequest): Promise<Ctx | null> {
  if (!pgEnabled()) return { userId: "local", workspaceId: "local" };
  const token = req.cookies.get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return {
      userId: payload.userId as string,
      workspaceId: payload.workspaceId as string,
      email: payload.email as string | undefined,
      name: payload.name as string | undefined,
      role: payload.role as string | undefined,
    };
  } catch {
    return null;
  }
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: "Not signed in" }, { status: 401 });
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

export async function loginUser(email: string, password: string): Promise<Ctx> {
  const p = await db();
  const r = await p.query(
    "SELECT id, email, name, password_hash, workspace_id, role FROM users WHERE email=$1",
    [email.toLowerCase().trim()]
  );
  if (!r.rows.length) throw new Error("Invalid email or password");
  const u = r.rows[0];
  const ok = await bcrypt.compare(password, u.password_hash);
  if (!ok) throw new Error("Invalid email or password");
  return { userId: u.id, workspaceId: u.workspace_id, email: u.email, name: u.name, role: u.role };
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

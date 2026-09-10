/**
 * DB-backed rate limiting / lockout for login and registration.
 * No-op in local (file-storage) mode — there's no login to brute-force there.
 *
 * The lockout decision lives in the pure `nextState` function (unit-tested);
 * the DB layer just reads and writes a row.
 */
import { db, pgEnabled } from "../db";

const LOGIN_MAX_ATTEMPTS = Number(process.env.SALESRX_LOGIN_MAX_ATTEMPTS) || 5;
const LOGIN_LOCKOUT_MINUTES = Number(process.env.SALESRX_LOGIN_LOCKOUT_MINUTES) || 15;

// Secondary, looser throttles — slow down a single-source attack across many
// accounts, or scripted signup spam. IP is read from x-forwarded-for, which
// is spoofable since this app has no stripping reverse proxy in front of it
// by default (docker-compose exposes it directly) — best-effort only. The
// per-account login lockout above is the real guarantee.
const LOGIN_IP_MAX_ATTEMPTS = 20;
const LOGIN_IP_WINDOW_MINUTES = 15;
const REGISTER_IP_MAX_ATTEMPTS = 20;
const REGISTER_IP_WINDOW_MINUTES = 60;

export interface AttemptState {
  failedCount: number;
  lockedUntil: number | null; // epoch ms
  lastAttemptAt: number; // epoch ms
}

export interface Policy {
  maxAttempts: number;
  windowMs: number;
  lockoutMs: number;
}

export interface AttemptResult {
  locked: boolean;
  retryAfterSeconds?: number;
}

/**
 * Given the stored attempt state and a policy, compute the state after one
 * more failed attempt. Pure — the DB layer just persists the result.
 */
export function nextState(
  prev: AttemptState | null,
  now: number,
  policy: Policy
): AttemptState {
  // Fresh start if there's no prior record or the window has elapsed.
  if (!prev || now - prev.lastAttemptAt > policy.windowMs) {
    return { failedCount: 1, lockedUntil: null, lastAttemptAt: now };
  }
  const failedCount = prev.failedCount + 1;
  const lockedUntil =
    failedCount >= policy.maxAttempts ? now + policy.lockoutMs : prev.lockedUntil;
  return { failedCount, lockedUntil, lastAttemptAt: now };
}

/** Is this state currently locked out? */
export function lockResult(state: AttemptState | null, now: number): AttemptResult {
  if (state?.lockedUntil && state.lockedUntil > now) {
    return { locked: true, retryAfterSeconds: Math.ceil((state.lockedUntil - now) / 1000) };
  }
  return { locked: false };
}

// ── DB layer ──

async function load(identifier: string): Promise<AttemptState | null> {
  const p = await db();
  const r = await p.query(
    "SELECT failed_count, locked_until, last_attempt_at FROM login_attempts WHERE identifier=$1",
    [identifier]
  );
  const row = r.rows[0];
  if (!row) return null;
  return {
    failedCount: row.failed_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : null,
    lastAttemptAt: new Date(row.last_attempt_at).getTime(),
  };
}

async function store(identifier: string, s: AttemptState): Promise<void> {
  const p = await db();
  await p.query(
    `INSERT INTO login_attempts (identifier, failed_count, locked_until, last_attempt_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (identifier) DO UPDATE SET
       failed_count = EXCLUDED.failed_count,
       locked_until = EXCLUDED.locked_until,
       last_attempt_at = EXCLUDED.last_attempt_at`,
    [
      identifier,
      s.failedCount,
      s.lockedUntil ? new Date(s.lockedUntil) : null,
      new Date(s.lastAttemptAt),
    ]
  );
}

async function checkLocked(identifier: string): Promise<AttemptResult> {
  if (!pgEnabled()) return { locked: false };
  return lockResult(await load(identifier), Date.now());
}

async function recordFailure(identifier: string, policy: Policy): Promise<AttemptResult> {
  if (!pgEnabled()) return { locked: false };
  const now = Date.now();
  const next = nextState(await load(identifier), now, policy);
  await store(identifier, next);
  return lockResult(next, now);
}

async function reset(identifier: string): Promise<void> {
  if (!pgEnabled()) return;
  const p = await db();
  await p.query("DELETE FROM login_attempts WHERE identifier=$1", [identifier]);
}

const min = (n: number) => n * 60_000;

const LOGIN_POLICY: Policy = {
  maxAttempts: LOGIN_MAX_ATTEMPTS,
  windowMs: min(LOGIN_LOCKOUT_MINUTES),
  lockoutMs: min(LOGIN_LOCKOUT_MINUTES),
};
const LOGIN_IP_POLICY: Policy = {
  maxAttempts: LOGIN_IP_MAX_ATTEMPTS,
  windowMs: min(LOGIN_IP_WINDOW_MINUTES),
  lockoutMs: min(LOGIN_IP_WINDOW_MINUTES),
};
const REGISTER_IP_POLICY: Policy = {
  maxAttempts: REGISTER_IP_MAX_ATTEMPTS,
  windowMs: min(REGISTER_IP_WINDOW_MINUTES),
  lockoutMs: min(REGISTER_IP_WINDOW_MINUTES),
};

/** Login — keyed by account and by source IP. Account lockout is the real guarantee. */
export async function checkLoginLocked(email: string, ip: string): Promise<AttemptResult> {
  const byAccount = await checkLocked(`login:${email}`);
  if (byAccount.locked) return byAccount;
  return checkLocked(`login-ip:${ip}`);
}

export async function recordLoginFailure(email: string, ip: string): Promise<AttemptResult> {
  const byAccount = await recordFailure(`login:${email}`, LOGIN_POLICY);
  await recordFailure(`login-ip:${ip}`, LOGIN_IP_POLICY);
  return byAccount;
}

export async function resetLoginAttempts(email: string): Promise<void> {
  await reset(`login:${email}`);
}

/** Registration throttle — keyed by source IP only (no account exists yet). */
export async function checkRegisterLocked(ip: string): Promise<AttemptResult> {
  return checkLocked(`register:${ip}`);
}

export async function recordRegisterAttempt(ip: string): Promise<AttemptResult> {
  return recordFailure(`register:${ip}`, REGISTER_IP_POLICY);
}

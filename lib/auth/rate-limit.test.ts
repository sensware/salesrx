import test from "node:test";
import assert from "node:assert/strict";
import { nextState, lockResult, type Policy, type AttemptState } from "./rate-limit";

const POLICY: Policy = { maxAttempts: 5, windowMs: 15 * 60_000, lockoutMs: 15 * 60_000 };
const T0 = 1_000_000_000_000;

test("first failure starts a fresh count, no lock", () => {
  const s = nextState(null, T0, POLICY);
  assert.equal(s.failedCount, 1);
  assert.equal(s.lockedUntil, null);
  assert.equal(lockResult(s, T0).locked, false);
});

test("failures below the threshold increment without locking", () => {
  let s: AttemptState | null = null;
  for (let i = 1; i <= 4; i++) {
    s = nextState(s, T0 + i * 1000, POLICY);
    assert.equal(s.failedCount, i);
    assert.equal(lockResult(s, T0 + i * 1000).locked, false);
  }
});

test("the Nth failure locks out for lockoutMs", () => {
  let s: AttemptState | null = null;
  for (let i = 1; i <= 5; i++) s = nextState(s, T0 + i * 1000, POLICY);
  const now = T0 + 5000;
  const r = lockResult(s, now);
  assert.equal(r.locked, true);
  assert.equal(r.retryAfterSeconds, 15 * 60);
});

test("a locked-out state clears once locked_until passes", () => {
  let s: AttemptState | null = null;
  for (let i = 1; i <= 5; i++) s = nextState(s, T0 + i * 1000, POLICY);
  assert.equal(lockResult(s, T0 + 5000 + 15 * 60_000 + 1).locked, false);
});

test("a failure after the window elapsed resets the count to 1", () => {
  const stale: AttemptState = { failedCount: 4, lockedUntil: null, lastAttemptAt: T0 };
  const s = nextState(stale, T0 + 15 * 60_000 + 1, POLICY);
  assert.equal(s.failedCount, 1);
  assert.equal(s.lockedUntil, null);
});

test("continued failures during an active lockout extend it", () => {
  let s: AttemptState | null = null;
  for (let i = 1; i <= 5; i++) s = nextState(s, T0 + i * 1000, POLICY);
  const firstLock = s!.lockedUntil!;
  s = nextState(s, T0 + 6000, POLICY);
  assert.equal(s.failedCount, 6);
  assert.ok(s.lockedUntil! > firstLock);
});

test("lockResult on null / no prior attempts is not locked", () => {
  assert.equal(lockResult(null, T0).locked, false);
});

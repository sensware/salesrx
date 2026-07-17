/**
 * v2.2 — usage metering & plan limits. The margin guard:
 *   Pro $49/rep/mo · 70% gross-margin floor → COGS budget $14.70/rep/mo.
 *   At ~$0.49 est. per fresh brief, that funds 30 fresh briefs + small ops.
 * Cached responses never consume credits — the cap bites cost, not habit.
 * Limits are env-overridable for self-hosters (their keys, their budget).
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { db, pgEnabled } from "./db";
import type { Ctx } from "./auth";

export type UsageKind = "briefs" | "tips" | "meetings" | "scripts";

export interface UsageRecord {
  month: string; // YYYY-MM
  briefs: number;
  tips: number;
  meetings: number;
  scripts: number;
  estCostUsd: number;
}

export interface UsageStatus {
  plan: string;
  month: string;
  used: UsageRecord;
  limits: Record<UsageKind, number>;
  estCostUsd: number;
  budgetUsd: number;
}

/** Estimated marginal cost per operation (USD) — conservative averages. */
export const EST_COST: Record<UsageKind, number> = {
  briefs: 0.49, // LLM research + synthesis + signal APIs
  tips: 0.02,
  meetings: 0.03,
  scripts: 0.08,
};

const PRICE_PRO = 49;
const MARGIN_FLOOR = 0.7;

export function planName(): string {
  return (process.env.SALESRX_PLAN || "pro").toLowerCase();
}

export function limits(): Record<UsageKind, number> {
  const plan = planName();
  const briefDefault = plan === "free" ? 5 : plan === "team" ? 45 : 30;
  return {
    briefs: Number(process.env.SALESRX_MONTHLY_BRIEF_LIMIT) || briefDefault,
    tips: Number(process.env.SALESRX_MONTHLY_TIPS_LIMIT) || 20,
    meetings: Number(process.env.SALESRX_MONTHLY_MEETINGS_LIMIT) || 60,
    scripts: Number(process.env.SALESRX_MONTHLY_SCRIPTS_LIMIT) || 30,
  };
}

export function budgetUsd(): number {
  const price = plan49();
  return Math.round(price * (1 - MARGIN_FLOOR) * 100) / 100;
}
function plan49(): number {
  return planName() === "team" ? 79 : planName() === "free" ? 0 : PRICE_PRO;
}

function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

const FILE = join(process.cwd(), "data", "usage.json");

function empty(month: string): UsageRecord {
  return { month, briefs: 0, tips: 0, meetings: 0, scripts: 0, estCostUsd: 0 };
}

async function load(userId: string): Promise<UsageRecord> {
  const month = monthKey();
  const key = `${userId}|${month}`;
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT data FROM usage_meter WHERE key=$1", [key]);
    return r.rows.length ? (r.rows[0].data as UsageRecord) : empty(month);
  }
  try {
    if (existsSync(FILE)) {
      const all = JSON.parse(readFileSync(FILE, "utf8"));
      if (all[key]) return all[key] as UsageRecord;
    }
  } catch {}
  return empty(month);
}

async function save(userId: string, rec: UsageRecord): Promise<void> {
  const key = `${userId}|${rec.month}`;
  if (pgEnabled()) {
    const p = await db();
    await p.query(
      `INSERT INTO usage_meter (key, data) VALUES ($1,$2)
       ON CONFLICT (key) DO UPDATE SET data=$2`,
      [key, JSON.stringify(rec)]
    );
    return;
  }
  let all: Record<string, UsageRecord> = {};
  try {
    if (existsSync(FILE)) all = JSON.parse(readFileSync(FILE, "utf8"));
  } catch {}
  all[key] = rec;
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(all, null, 2));
}

export class LimitError extends Error {
  status = 429;
  constructor(kind: UsageKind, limit: number) {
    const reset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
      .toISOString().slice(0, 10);
    super(
      `Monthly ${kind} limit reached (${limit}/${limit} fresh ${kind} this month). ` +
      `Resets ${reset}. Cached results remain free — re-running a recent prospect doesn't count. ` +
      `Self-hosting? Raise SALESRX_MONTHLY_${kind.toUpperCase()}_LIMIT in .env.`
    );
  }
}

/** Consume one unit of `kind` for this user, or throw LimitError. */
export async function consume(ctx: Ctx, kind: UsageKind): Promise<void> {
  const lim = limits();
  const rec = await load(ctx.userId);
  if (rec[kind] >= lim[kind]) throw new LimitError(kind, lim[kind]);
  rec[kind] += 1;
  rec.estCostUsd = Math.round((rec.estCostUsd + EST_COST[kind]) * 100) / 100;
  await save(ctx.userId, rec);
}

export async function usageStatus(ctx: Ctx): Promise<UsageStatus> {
  const used = await load(ctx.userId);
  return {
    plan: planName(),
    month: used.month,
    used,
    limits: limits(),
    estCostUsd: used.estCostUsd,
    budgetUsd: budgetUsd(),
  };
}

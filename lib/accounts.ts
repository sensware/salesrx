/**
 * Account memory — the compounding loop. v2.0: scoped per WORKSPACE, so a
 * team shares memory: any rep's logged meeting improves everyone's next brief.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { db, pgEnabled } from "./db";

export interface MeetingRecord {
  date: string; // ISO
  rawNotes: string;
  outcomes: string[];
  nextSteps: string[];
  objectionsHeard: string[];
  followUpEmail: string;
  loggedBy?: string; // user email (multi-user mode)
}

export interface AccountRecord {
  id: string;
  name: string;
  domain?: string;
  createdAt: string;
  briefsRun: number;
  lastBriefAt?: string;
  memorySummary: string;
  meetings: MeetingRecord[];
}

const FILE = join(process.cwd(), "data", "accounts.json");

export function accountId(name: string, domain?: string): string {
  return createHash("sha1")
    .update(`${name}|${domain || ""}`.toLowerCase())
    .digest("hex")
    .slice(0, 10);
}

function fileLoad(): AccountRecord[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8")) as AccountRecord[];
  } catch {
    return [];
  }
}
function fileSave(accounts: AccountRecord[]): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(accounts, null, 2));
}

export async function loadAccounts(workspaceId = "local"): Promise<AccountRecord[]> {
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT data FROM accounts WHERE workspace_id=$1", [workspaceId]);
    return r.rows.map((x) => x.data as AccountRecord);
  }
  return fileLoad();
}

export async function getOrCreateAccount(
  name: string,
  domain?: string,
  workspaceId = "local"
): Promise<AccountRecord> {
  const id = accountId(name, domain);
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT data FROM accounts WHERE id=$1 AND workspace_id=$2", [id, workspaceId]);
    if (r.rows.length) return r.rows[0].data as AccountRecord;
    const acc: AccountRecord = {
      id, name, domain, createdAt: new Date().toISOString(),
      briefsRun: 0, memorySummary: "", meetings: [],
    };
    await p.query(
      "INSERT INTO accounts (id, workspace_id, data) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING",
      [id, workspaceId, JSON.stringify(acc)]
    );
    return acc;
  }
  const accounts = fileLoad();
  let acc = accounts.find((a) => a.id === id);
  if (!acc) {
    acc = { id, name, domain, createdAt: new Date().toISOString(), briefsRun: 0, memorySummary: "", meetings: [] };
    accounts.push(acc);
    fileSave(accounts);
  }
  return acc;
}

export async function updateAccount(updated: AccountRecord, workspaceId = "local"): Promise<void> {
  if (pgEnabled()) {
    const p = await db();
    await p.query(
      `INSERT INTO accounts (id, workspace_id, data) VALUES ($1,$2,$3)
       ON CONFLICT (id, workspace_id) DO UPDATE SET data=$3`,
      [updated.id, workspaceId, JSON.stringify(updated)]
    );
    return;
  }
  const accounts = fileLoad();
  const i = accounts.findIndex((a) => a.id === updated.id);
  if (i >= 0) accounts[i] = updated;
  else accounts.push(updated);
  fileSave(accounts);
}

/** Render account history as a prompt block for the research agent. */
export function memoryToPromptBlock(acc: AccountRecord): string | undefined {
  if (!acc.memorySummary && acc.meetings.length === 0) return undefined;
  const recent = acc.meetings.slice(-3).map(
    (m) =>
      `- ${m.date.slice(0, 10)}${m.loggedBy ? ` (${m.loggedBy})` : ""}: outcomes: ${m.outcomes.join("; ") || "n/a"}. next steps: ${
        m.nextSteps.join("; ") || "n/a"
      }. objections heard: ${m.objectionsHeard.join("; ") || "none"}`
  );
  return `ACCOUNT HISTORY (this team's own past meetings with this prospect — weigh heavily; tailor pain points, NEPQ ladders and objection handling to what already happened. Do NOT re-suggest steps already taken):
Summary: ${acc.memorySummary || "n/a"}
Recent meetings:
${recent.join("\n") || "- none logged yet"}`;
}

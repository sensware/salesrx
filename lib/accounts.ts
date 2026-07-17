/**
 * Account memory — the compounding loop. Every meeting logged makes the
 * next brief for that account smarter.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

export interface MeetingRecord {
  date: string; // ISO
  rawNotes: string;
  outcomes: string[];
  nextSteps: string[];
  objectionsHeard: string[];
  followUpEmail: string;
}

export interface AccountRecord {
  id: string;
  name: string;
  domain?: string;
  createdAt: string;
  briefsRun: number;
  lastBriefAt?: string;
  memorySummary: string; // rolling 2-3 sentence summary maintained by the LLM
  meetings: MeetingRecord[];
}

const FILE = join(process.cwd(), "data", "accounts.json");

export function accountId(name: string, domain?: string): string {
  return createHash("sha1")
    .update(`${name}|${domain || ""}`.toLowerCase())
    .digest("hex")
    .slice(0, 10);
}

export function loadAccounts(): AccountRecord[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8")) as AccountRecord[];
  } catch {
    return [];
  }
}

export function saveAccounts(accounts: AccountRecord[]): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(accounts, null, 2));
}

export function getOrCreateAccount(name: string, domain?: string): AccountRecord {
  const accounts = loadAccounts();
  const id = accountId(name, domain);
  let acc = accounts.find((a) => a.id === id);
  if (!acc) {
    acc = {
      id,
      name,
      domain,
      createdAt: new Date().toISOString(),
      briefsRun: 0,
      memorySummary: "",
      meetings: [],
    };
    accounts.push(acc);
    saveAccounts(accounts);
  }
  return acc;
}

export function updateAccount(updated: AccountRecord): void {
  const accounts = loadAccounts();
  const i = accounts.findIndex((a) => a.id === updated.id);
  if (i >= 0) accounts[i] = updated;
  else accounts.push(updated);
  saveAccounts(accounts);
}

/** Render account history as a prompt block for the research agent. */
export function memoryToPromptBlock(acc: AccountRecord): string | undefined {
  if (!acc.memorySummary && acc.meetings.length === 0) return undefined;
  const recent = acc.meetings.slice(-3).map(
    (m) =>
      `- ${m.date.slice(0, 10)}: outcomes: ${m.outcomes.join("; ") || "n/a"}. next steps: ${
        m.nextSteps.join("; ") || "n/a"
      }. objections heard: ${m.objectionsHeard.join("; ") || "none"}`
  );
  return `ACCOUNT HISTORY (rep's own past meetings with this prospect — weigh heavily; tailor pain points, NEPQ ladders and objection handling to what already happened. Do NOT re-suggest steps already taken):
Summary: ${acc.memorySummary || "n/a"}
Recent meetings:
${recent.join("\n") || "- none logged yet"}`;
}

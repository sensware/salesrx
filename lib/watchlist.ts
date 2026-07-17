import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";
import { db, pgEnabled } from "./db";

export interface WatchAlert {
  headline: string;
  detail: string;
  when: string;
  kind: "opportunity" | "warning" | "info";
  sourceUrl?: string;
  foundAt: string;
}

export interface WatchItem {
  id: string;
  name: string;
  domain?: string;
  addedAt: string;
  lastCheckedAt?: string;
  knownSignals: string[];
  alerts: WatchAlert[];
}

const FILE = join(process.cwd(), "data", "watchlist.json");

export function makeId(name: string, domain?: string): string {
  return createHash("sha1")
    .update(`${name}|${domain || ""}`.toLowerCase())
    .digest("hex")
    .slice(0, 10);
}

export function normalizeHeadline(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

export async function loadWatchlist(workspaceId = "local"): Promise<WatchItem[]> {
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT data FROM watchlist WHERE workspace_id=$1", [workspaceId]);
    return r.rows.map((x) => x.data as WatchItem);
  }
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8")) as WatchItem[];
  } catch {
    return [];
  }
}

export async function saveWatchlist(items: WatchItem[], workspaceId = "local"): Promise<void> {
  if (pgEnabled()) {
    const p = await db();
    await p.query("DELETE FROM watchlist WHERE workspace_id=$1", [workspaceId]);
    for (const item of items) {
      await p.query("INSERT INTO watchlist (id, workspace_id, data) VALUES ($1,$2,$3)", [
        item.id, workspaceId, JSON.stringify(item),
      ]);
    }
    return;
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(items, null, 2));
}

/** Workspace ids that have watchlist entries (for cron refresh). */
export async function watchlistWorkspaceIds(): Promise<string[]> {
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT DISTINCT workspace_id FROM watchlist");
    return r.rows.map((x) => x.workspace_id as string);
  }
  return existsSync(FILE) ? ["local"] : [];
}

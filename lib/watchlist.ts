import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { createHash } from "crypto";

export interface WatchAlert {
  headline: string;
  detail: string;
  when: string;
  kind: "opportunity" | "warning" | "info";
  sourceUrl?: string;
  foundAt: string; // ISO datetime
}

export interface WatchItem {
  id: string;
  name: string;
  domain?: string;
  addedAt: string;
  lastCheckedAt?: string;
  knownSignals: string[]; // normalized headlines already surfaced (from briefs or prior checks)
  alerts: WatchAlert[];
}

const FILE = join(process.cwd(), "data", "watchlist.json");

export function loadWatchlist(): WatchItem[] {
  try {
    if (!existsSync(FILE)) return [];
    return JSON.parse(readFileSync(FILE, "utf8")) as WatchItem[];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchItem[]): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(items, null, 2));
}

export function makeId(name: string, domain?: string): string {
  return createHash("sha1")
    .update(`${name}|${domain || ""}`.toLowerCase())
    .digest("hex")
    .slice(0, 10);
}

export function normalizeHeadline(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();
}

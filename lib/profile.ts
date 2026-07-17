import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { db, pgEnabled } from "./db";
import type { RepProfile } from "./types";

const FILE = join(process.cwd(), "data", "profile.json");

export async function loadProfile(userId = "local"): Promise<RepProfile | null> {
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT data FROM profiles WHERE user_id=$1", [userId]);
    return r.rows.length ? (r.rows[0].data as RepProfile) : null;
  }
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf8")) as RepProfile;
  } catch {
    return null;
  }
}

export async function saveProfile(profile: RepProfile, userId = "local"): Promise<void> {
  if (pgEnabled()) {
    const p = await db();
    await p.query(
      `INSERT INTO profiles (user_id, data) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data=$2`,
      [userId, JSON.stringify(profile)]
    );
    return;
  }
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(profile, null, 2));
}

/** All user ids that have a saved profile (for cron auto-prep). */
export async function profileUserIds(): Promise<string[]> {
  if (pgEnabled()) {
    const p = await db();
    const r = await p.query("SELECT user_id FROM profiles");
    return r.rows.map((x) => x.user_id as string);
  }
  return existsSync(FILE) ? ["local"] : [];
}

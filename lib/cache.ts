import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";
import { db, pgEnabled } from "./db";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const TTL_MS =
  (Number(process.env.SALESRX_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

function hashKey(key: string): string {
  return createHash("sha1").update(key.toLowerCase().trim()).digest("hex");
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const h = hashKey(key);
  if (pgEnabled()) {
    try {
      const p = await db();
      const r = await p.query(
        "SELECT value FROM cache WHERE key=$1 AND updated_at > now() - $2::interval",
        [h, `${TTL_MS} milliseconds`]
      );
      return r.rows.length ? (r.rows[0].value as T) : null;
    } catch {
      return null;
    }
  }
  try {
    const path = join(CACHE_DIR, `${h}.json`);
    if (!existsSync(path)) return null;
    if (Date.now() - statSync(path).mtimeMs > TTL_MS) return null;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const h = hashKey(key);
  if (pgEnabled()) {
    try {
      const p = await db();
      await p.query(
        `INSERT INTO cache (key, value, updated_at) VALUES ($1, $2, now())
         ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=now()`,
        [h, JSON.stringify(value)]
      );
    } catch {
      /* best effort */
    }
    return;
  }
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(join(CACHE_DIR, `${h}.json`), JSON.stringify(value, null, 2));
  } catch {
    /* best effort */
  }
}

import { createHash } from "crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync } from "fs";
import { join } from "path";

const CACHE_DIR = join(process.cwd(), "data", "cache");
const TTL_MS =
  (Number(process.env.SALESRX_CACHE_TTL_HOURS) || 24) * 60 * 60 * 1000;

function keyToPath(key: string): string {
  const h = createHash("sha1").update(key.toLowerCase().trim()).digest("hex");
  return join(CACHE_DIR, `${h}.json`);
}

export function cacheGet<T>(key: string): T | null {
  try {
    const p = keyToPath(key);
    if (!existsSync(p)) return null;
    if (Date.now() - statSync(p).mtimeMs > TTL_MS) return null;
    return JSON.parse(readFileSync(p, "utf8")) as T;
  } catch {
    return null;
  }
}

export function cacheSet(key: string, value: unknown): void {
  try {
    mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(keyToPath(key), JSON.stringify(value, null, 2));
  } catch {
    // cache is best-effort
  }
}

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import type { RepProfile } from "./types";

const FILE = join(process.cwd(), "data", "profile.json");

export function loadProfile(): RepProfile | null {
  try {
    if (!existsSync(FILE)) return null;
    return JSON.parse(readFileSync(FILE, "utf8")) as RepProfile;
  } catch {
    return null;
  }
}

export function saveProfile(profile: RepProfile): void {
  mkdirSync(dirname(FILE), { recursive: true });
  writeFileSync(FILE, JSON.stringify(profile, null, 2));
}

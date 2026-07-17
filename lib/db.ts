/**
 * v2.0 storage: Postgres when DATABASE_URL is set, JSON files otherwise.
 * Schema is bootstrapped lazily on first query — no migration tooling needed
 * for a fresh install; real migrations arrive when the schema next changes.
 */
import { Pool } from "pg";

let pool: Pool | null = null;
let ready: Promise<void> | null = null;

export function pgEnabled(): boolean {
  return !!process.env.DATABASE_URL;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS workspaces (
  id text PRIMARY KEY,
  name text NOT NULL,
  invite_code text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  name text NOT NULL,
  password_hash text NOT NULL,
  workspace_id text REFERENCES workspaces(id),
  role text DEFAULT 'member',
  google_refresh_token text,
  created_at timestamptz DEFAULT now()
);
CREATE TABLE IF NOT EXISTS profiles (
  user_id text PRIMARY KEY,
  data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS accounts (
  id text NOT NULL,
  workspace_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (id, workspace_id)
);
CREATE TABLE IF NOT EXISTS watchlist (
  id text NOT NULL,
  workspace_id text NOT NULL,
  data jsonb NOT NULL,
  PRIMARY KEY (id, workspace_id)
);
CREATE TABLE IF NOT EXISTS cache (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);
`;

export async function db(): Promise<Pool> {
  if (!pool) pool = new Pool({ connectionString: process.env.DATABASE_URL });
  if (!ready) ready = pool.query(SCHEMA).then(() => undefined);
  await ready;
  return pool;
}

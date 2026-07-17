/**
 * Salesforce sync (v2.0) — token-based, no OAuth dance. Obtain credentials via
 * a Connected App (client-credentials flow) or `sf org display` for dev orgs.
 */
const API = "v59.0";

export function salesforceConfigured(): boolean {
  return !!process.env.SALESFORCE_INSTANCE_URL && !!process.env.SALESFORCE_ACCESS_TOKEN;
}

async function sf<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const base = process.env.SALESFORCE_INSTANCE_URL!.replace(/\/$/, "");
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${process.env.SALESFORCE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Salesforce ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

function soqlEscape(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Find an Account by website domain (or name), create it if missing. */
export async function upsertSfAccount(name: string, domain?: string): Promise<string> {
  const where = domain
    ? `Website LIKE '%${soqlEscape(domain)}%'`
    : `Name = '${soqlEscape(name)}'`;
  const q = encodeURIComponent(`SELECT Id FROM Account WHERE ${where} LIMIT 1`);
  const found = await sf<{ records: { Id: string }[] }>(`/services/data/${API}/query?q=${q}`);
  if (found.records.length) return found.records[0].Id;

  const created = await sf<{ id: string }>(`/services/data/${API}/sobjects/Account`, "POST", {
    Name: name,
    ...(domain ? { Website: domain } : {}),
  });
  return created.id;
}

/** Attach a note (as a completed Task) to an Account. */
export async function addSfNote(accountId: string, subject: string, body: string): Promise<string> {
  const created = await sf<{ id: string }>(`/services/data/${API}/sobjects/Task`, "POST", {
    Subject: subject,
    Description: body.slice(0, 30000),
    WhatId: accountId,
    Status: "Completed",
    ActivityDate: new Date().toISOString().slice(0, 10),
  });
  return created.id;
}

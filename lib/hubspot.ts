/**
 * HubSpot CRM sync — via a private-app access token (no OAuth flow).
 * HubSpot: Settings → Integrations → Private Apps → create with scopes:
 * crm.objects.companies.read/write, crm.objects.notes... (standard CRM scopes)
 */

const BASE = "https://api.hubapi.com";

function token(): string | null {
  return process.env.HUBSPOT_ACCESS_TOKEN || null;
}

export function hubspotConfigured(): boolean {
  return !!token();
}

async function hs<T>(path: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HubSpot ${method} ${path} -> ${res.status}: ${text.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

/** Find a company by domain (or name fallback), create it if missing. Returns company ID. */
export async function upsertCompany(name: string, domain?: string): Promise<string> {
  const filters = domain
    ? [{ propertyName: "domain", operator: "EQ", value: domain }]
    : [{ propertyName: "name", operator: "EQ", value: name }];

  const search = await hs<{ results: { id: string }[] }>(
    "/crm/v3/objects/companies/search",
    "POST",
    { filterGroups: [{ filters }], limit: 1 }
  );
  if (search.results.length > 0) return search.results[0].id;

  const created = await hs<{ id: string }>("/crm/v3/objects/companies", "POST", {
    properties: { name, ...(domain ? { domain } : {}) },
  });
  return created.id;
}

/** Attach a note to a company using v4 default associations (no type-ID lookup needed). */
export async function addNoteToCompany(companyId: string, noteBody: string): Promise<string> {
  const note = await hs<{ id: string }>("/crm/v3/objects/notes", "POST", {
    properties: {
      hs_note_body: noteBody.slice(0, 65000),
      hs_timestamp: new Date().toISOString(),
    },
  });
  await hs(
    `/crm/v4/objects/notes/${note.id}/associations/default/companies/${companyId}`,
    "PUT"
  );
  return note.id;
}

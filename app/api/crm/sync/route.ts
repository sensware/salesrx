import { NextRequest, NextResponse } from "next/server";
import { hubspotConfigured, upsertCompany, addNoteToCompany } from "@/lib/hubspot";
import { salesforceConfigured, upsertSfAccount, addSfNote } from "@/lib/salesforce";
import { getCtx, unauthorized } from "@/lib/auth";
import type { Brief } from "@/lib/types";

export const maxDuration = 60;

function briefToNote(brief: Brief): string {
  const pains = brief.painPoints.map((p) => `• ${p.pain} (${p.confidence})`).join("\n");
  const signals = brief.signals.map((s) => `• ${s.when}: ${s.headline}`).join("\n");
  return `SalesRx brief — ${brief.company} (fit score ${brief.fitScore}/100)

${brief.summary}

Signals
${signals}

Pain points
${pains}

Incumbent: ${brief.incumbent}
Win story angle: ${brief.winStoryHint}`;
}

/** Sync a brief or meeting summary to every configured CRM (HubSpot, Salesforce). */
export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();

  if (!hubspotConfigured() && !salesforceConfigured()) {
    return NextResponse.json(
      { error: "No CRM configured — set HUBSPOT_ACCESS_TOKEN and/or SALESFORCE_* (see .env.example)" },
      { status: 400 }
    );
  }

  let body: { name: string; domain?: string; brief?: Brief; noteText?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.name || (!body.brief && !body.noteText)) {
    return NextResponse.json({ error: "name plus brief or noteText required" }, { status: 400 });
  }

  const text = body.brief
    ? briefToNote(body.brief)
    : `SalesRx meeting log — ${body.name}\n\n${body.noteText}`;

  const results: Record<string, string> = {};
  const errors: Record<string, string> = {};

  if (hubspotConfigured()) {
    try {
      const companyId = await upsertCompany(body.name, body.domain);
      const noteId = await addNoteToCompany(companyId, text.replace(/\n/g, "<br>"));
      results.hubspot = `company ${companyId}, note ${noteId}`;
    } catch (e) {
      errors.hubspot = e instanceof Error ? e.message : "sync failed";
    }
  }
  if (salesforceConfigured()) {
    try {
      const accountId = await upsertSfAccount(body.name, body.domain);
      const noteId = await addSfNote(accountId, `SalesRx — ${body.name}`, text);
      results.salesforce = `account ${accountId}, task ${noteId}`;
    } catch (e) {
      errors.salesforce = e instanceof Error ? e.message : "sync failed";
    }
  }

  const ok = Object.keys(results).length > 0;
  return NextResponse.json({ results, errors }, { status: ok ? 200 : 500 });
}

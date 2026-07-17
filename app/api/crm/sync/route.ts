import { NextRequest, NextResponse } from "next/server";
import { hubspotConfigured, upsertCompany, addNoteToCompany } from "@/lib/hubspot";
import type { Brief } from "@/lib/types";

export const maxDuration = 60;

function briefToNote(brief: Brief): string {
  const pains = brief.painPoints.map((p) => `• ${p.pain} (${p.confidence})`).join("\n");
  const signals = brief.signals.map((s) => `• ${s.when}: ${s.headline}`).join("\n");
  return `<strong>SalesRx brief — ${brief.company}</strong> (fit score ${brief.fitScore}/100)

${brief.summary}

<strong>Signals</strong>
${signals}

<strong>Pain points</strong>
${pains}

<strong>Incumbent:</strong> ${brief.incumbent}
<strong>Win story angle:</strong> ${brief.winStoryHint}`;
}

/** Sync a brief or meeting summary to HubSpot as a note on the company. */
export async function POST(req: NextRequest) {
  if (!hubspotConfigured()) {
    return NextResponse.json(
      { error: "HubSpot not configured — set HUBSPOT_ACCESS_TOKEN (see .env.example)" },
      { status: 400 }
    );
  }

  let body: {
    name: string;
    domain?: string;
    brief?: Brief;
    noteText?: string; // e.g. meeting summary / follow-up email
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.name || (!body.brief && !body.noteText)) {
    return NextResponse.json(
      { error: "name plus brief or noteText required" },
      { status: 400 }
    );
  }

  try {
    const companyId = await upsertCompany(body.name, body.domain);
    const noteBody = body.brief
      ? briefToNote(body.brief)
      : `<strong>SalesRx meeting log — ${body.name}</strong>\n\n${body.noteText}`;
    const noteId = await addNoteToCompany(companyId, noteBody.replace(/\n/g, "<br>"));
    return NextResponse.json({ companyId, noteId });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "CRM sync failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

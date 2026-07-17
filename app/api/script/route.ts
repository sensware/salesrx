import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { scriptSystemPrompt } from "@/lib/prompts";
import { getCtx, unauthorized } from "@/lib/auth";
import { cacheGet, cacheSet } from "@/lib/cache";
import { consume } from "@/lib/usage";
import { getOrCreateAccount, memoryToPromptBlock } from "@/lib/accounts";
import type { Brief, CallScript, MeetingType, RepProfile } from "@/lib/types";

export const maxDuration = 120;

/** v2.3 — generate a word-for-word NEPQ call script from a live brief. */
export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();

  let body: { profile: RepProfile; brief: Brief; meetingType?: MeetingType; domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.brief || !body?.profile) {
    return NextResponse.json({ error: "profile and brief are required" }, { status: 400 });
  }
  const meetingType: MeetingType = body.meetingType || "discovery";

  const cacheKey = `script:${ctx.workspaceId}|${body.brief.company}|${meetingType}|${body.profile.moat}`;
  const cached = await cacheGet<CallScript>(cacheKey);
  if (cached) return NextResponse.json({ script: cached, cached: true });

  try {
    await consume(ctx, "scripts");

    // include what the team already knows about this account
    const account = await getOrCreateAccount(body.brief.company, body.domain, ctx.workspaceId);
    const memory = memoryToPromptBlock(account);

    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 6000,
      system: scriptSystemPrompt(),
      messages: [
        {
          role: "user",
          content: `MEETING TYPE: ${meetingType}

REP PROFILE:
${JSON.stringify(body.profile)}

${memory ? memory + "\n\n" : ""}PROSPECT BRIEF (researched, evidence-linked):
${JSON.stringify(body.brief)}

Write the NEPQ call script now.`,
        },
      ],
    });

    const script = extractJson<CallScript>(textOf(msg));
    await cacheSet(cacheKey, script);
    return NextResponse.json({ script, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Script generation failed";
    const status = (err as { status?: number })?.status === 429 ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

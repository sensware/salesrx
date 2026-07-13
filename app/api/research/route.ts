import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, MAX_SEARCHES, extractJson, textOf } from "@/lib/anthropic";
import { researchSystemPrompt, researchUserPrompt } from "@/lib/prompts";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { Brief, ProspectInput, RepProfile } from "@/lib/types";

export const maxDuration = 300; // research can take a while

export async function POST(req: NextRequest) {
  let body: { profile: RepProfile; prospect: ProspectInput };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { profile, prospect } = body || {};
  if (!prospect?.name && !prospect?.domain) {
    return NextResponse.json(
      { error: "Provide at least a prospect name or domain" },
      { status: 400 }
    );
  }

  const cacheKey = `brief:${prospect.name}|${prospect.domain}|${prospect.contact}|${profile?.moat}`;
  const cached = cacheGet<Brief>(cacheKey);
  if (cached) return NextResponse.json({ brief: cached, cached: true });

  try {
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 8000,
      system: researchSystemPrompt(),
      messages: [{ role: "user", content: researchUserPrompt(profile, prospect) }],
      tools: [
        {
          type: "web_search_20250305",
          name: "web_search",
          max_uses: MAX_SEARCHES,
        },
      ],
    });

    const brief = extractJson<Brief>(textOf(msg));
    cacheSet(cacheKey, brief);
    return NextResponse.json({ brief, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

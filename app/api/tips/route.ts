import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { tipsSystemPrompt } from "@/lib/prompts";
import { cacheGet, cacheSet } from "@/lib/cache";
import type { CoachingTip, RepProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  let profile: RepProfile;
  try {
    profile = (await req.json()).profile;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cacheKey = `tips:${JSON.stringify(profile)}`;
  const cached = cacheGet<CoachingTip[]>(cacheKey);
  if (cached) return NextResponse.json({ tips: cached, cached: true });

  try {
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: tipsSystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify(profile) }],
    });
    const tips = extractJson<CoachingTip[]>(textOf(msg));
    cacheSet(cacheKey, tips);
    return NextResponse.json({ tips, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Tips generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

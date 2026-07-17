import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { tipsSystemPrompt } from "@/lib/prompts";
import { cacheGet, cacheSet } from "@/lib/cache";
import { getCtx, unauthorized } from "@/lib/auth";
import type { CoachingTip, RepProfile } from "@/lib/types";

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();

  let profile: RepProfile;
  try {
    profile = (await req.json()).profile;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const cacheKey = `tips:${ctx.userId}:${JSON.stringify(profile)}`;
  const cached = await cacheGet<CoachingTip[]>(cacheKey);
  if (cached) return NextResponse.json({ tips: cached, cached: true });

  try {
    const { consume } = await import("@/lib/usage");
    await consume(ctx, "tips");
    const anthropic = client();
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: tipsSystemPrompt(),
      messages: [{ role: "user", content: JSON.stringify(profile) }],
    });
    const tips = extractJson<CoachingTip[]>(textOf(msg));
    await cacheSet(cacheKey, tips);
    return NextResponse.json({ tips, cached: false });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Tips generation failed";
    const status = (err as { status?: number })?.status === 429 ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research";
import { getCtx, unauthorized } from "@/lib/auth";
import type { ProspectInput, RepProfile } from "@/lib/types";

export const maxDuration = 300; // research can take a while

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();

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

  try {
    const result = await runResearch(profile, prospect, ctx.workspaceId, ctx);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    const status = (err as { status?: number })?.status === 429 ? 429 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

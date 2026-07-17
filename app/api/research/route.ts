import { NextRequest, NextResponse } from "next/server";
import { runResearch } from "@/lib/research";
import type { ProspectInput, RepProfile } from "@/lib/types";

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

  try {
    const result = await runResearch(profile, prospect);
    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

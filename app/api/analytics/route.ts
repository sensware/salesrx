import { NextRequest, NextResponse } from "next/server";
import { getCtx, unauthorized } from "@/lib/auth";
import { computeAnalytics } from "@/lib/analytics";

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();
  return NextResponse.json(await computeAnalytics(ctx.workspaceId));
}

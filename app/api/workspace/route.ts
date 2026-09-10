import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { getCtx, unauthorized, workspaceInfo } from "@/lib/auth";

export async function GET(req: NextRequest) {
  if (!pgEnabled()) return NextResponse.json({ workspace: null, members: [] });
  const ctx = await getCtx();
  if (!ctx) return unauthorized();
  return NextResponse.json(await workspaceInfo(ctx.workspaceId));
}

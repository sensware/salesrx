import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { getCtx, getGoogleToken } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const mode = pgEnabled() ? "multi" : "local";
  const ctx = await getCtx(req);
  const googleAvailable = !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
  if (!ctx) return NextResponse.json({ mode, user: null, googleAvailable });
  const googleConnected = mode === "multi" ? !!(await getGoogleToken(ctx.userId)) : false;
  return NextResponse.json({ mode, user: ctx, googleAvailable, googleConnected });
}

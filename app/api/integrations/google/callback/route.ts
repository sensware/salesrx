import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { createHash } from "crypto";
import { exchangeCode } from "@/lib/gcal";
import { setGoogleToken } from "@/lib/auth";
import { pgEnabled } from "@/lib/db";

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/?calendar=error", req.url));
  try {
    const secret = new TextEncoder().encode(
      process.env.AUTH_SECRET ||
        createHash("sha256").update(`salesrx:${process.env.DATABASE_URL || "local"}`).digest("hex")
    );
    const { payload } = await jwtVerify(state, secret);
    const tokens = await exchangeCode(code);
    if (tokens.refresh_token && pgEnabled()) {
      await setGoogleToken(payload.userId as string, tokens.refresh_token);
    }
    return NextResponse.redirect(new URL("/?calendar=connected", req.url));
  } catch (e) {
    console.warn("Google OAuth callback failed:", e);
    return NextResponse.redirect(new URL("/?calendar=error", req.url));
  }
}

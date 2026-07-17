import { NextRequest, NextResponse } from "next/server";
import { getCtx } from "@/lib/auth";
import { googleAuthUrl, googleConfigured } from "@/lib/gcal";
import { SignJWT } from "jose";
import { createHash } from "crypto";

export async function GET(req: NextRequest) {
  if (!googleConfigured()) {
    return NextResponse.json({ error: "GOOGLE_CLIENT_ID/SECRET not configured" }, { status: 400 });
  }
  const ctx = await getCtx(req);
  if (!ctx) return NextResponse.redirect(new URL("/", req.url));
  const secret = new TextEncoder().encode(
    process.env.AUTH_SECRET ||
      createHash("sha256").update(`salesrx:${process.env.DATABASE_URL || "local"}`).digest("hex")
  );
  const state = await new SignJWT({ userId: ctx.userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("15m")
    .sign(secret);
  return NextResponse.redirect(googleAuthUrl(state));
}

import { NextRequest, NextResponse } from "next/server";
import { loadProfile, saveProfile } from "@/lib/profile";
import { getCtx, unauthorized } from "@/lib/auth";
import type { RepProfile } from "@/lib/types";

export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();
  return NextResponse.json({ profile: await loadProfile(ctx.userId) });
}

export async function POST(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();
  let profile: RepProfile;
  try {
    profile = (await req.json()).profile;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!profile) return NextResponse.json({ error: "profile is required" }, { status: 400 });
  await saveProfile(profile, ctx.userId);
  return NextResponse.json({ ok: true });
}

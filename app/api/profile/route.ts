import { NextRequest, NextResponse } from "next/server";
import { loadProfile, saveProfile } from "@/lib/profile";
import type { RepProfile } from "@/lib/types";

export async function GET() {
  return NextResponse.json({ profile: loadProfile() });
}

export async function POST(req: NextRequest) {
  let profile: RepProfile;
  try {
    profile = (await req.json()).profile;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!profile) return NextResponse.json({ error: "profile is required" }, { status: 400 });
  saveProfile(profile);
  return NextResponse.json({ ok: true });
}

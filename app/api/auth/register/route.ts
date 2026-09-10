import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { registerUser, signIn, checkRegisterLocked, recordRegisterAttempt } from "@/lib/auth";

function requestIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  if (!pgEnabled()) {
    return NextResponse.json({ error: "Single-user mode — no accounts needed" }, { status: 400 });
  }
  try {
    const ip = requestIp(req);
    const locked = await checkRegisterLocked(ip);
    if (locked.locked) {
      return NextResponse.json(
        { error: "Too many signups from this network — try again later" },
        { status: 429 }
      );
    }

    const body = await req.json();
    if (!body?.email || !body?.password || !body?.name) {
      return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
    }
    if (String(body.password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }

    await recordRegisterAttempt(ip);
    const ctx = await registerUser(body);
    await signIn("credentials", { email: body.email, password: body.password, redirect: false });
    return NextResponse.json({ user: ctx });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

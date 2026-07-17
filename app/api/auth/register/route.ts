import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { registerUser, issueSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!pgEnabled()) {
    return NextResponse.json({ error: "Single-user mode — no accounts needed" }, { status: 400 });
  }
  try {
    const body = await req.json();
    if (!body?.email || !body?.password || !body?.name) {
      return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
    }
    if (String(body.password).length < 8) {
      return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    const ctx = await registerUser(body);
    const res = NextResponse.json({ user: ctx });
    await issueSession(res, ctx);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

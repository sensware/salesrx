import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { loginUser, issueSession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!pgEnabled()) {
    return NextResponse.json({ error: "Single-user mode — no login needed" }, { status: 400 });
  }
  try {
    const { email, password } = await req.json();
    const ctx = await loginUser(email, password);
    const res = NextResponse.json({ user: ctx });
    await issueSession(res, ctx);
    return res;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

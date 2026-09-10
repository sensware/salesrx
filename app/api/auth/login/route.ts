import { NextRequest, NextResponse } from "next/server";
import { pgEnabled } from "@/lib/db";
import { AuthError } from "next-auth";
import { signIn, ctxByEmail, RateLimitedError } from "@/lib/auth";

export async function POST(req: NextRequest) {
  if (!pgEnabled()) {
    return NextResponse.json({ error: "Single-user mode — no login needed" }, { status: 400 });
  }
  try {
    const { email, password } = await req.json();
    await signIn("credentials", { email, password, redirect: false });
    return NextResponse.json({ user: await ctxByEmail(email) });
  } catch (err: unknown) {
    if (err instanceof RateLimitedError) {
      return NextResponse.json(
        { error: "Too many failed attempts — try again in a few minutes" },
        { status: 429 }
      );
    }
    if (err instanceof AuthError) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const message = err instanceof Error ? err.message : "Login failed";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

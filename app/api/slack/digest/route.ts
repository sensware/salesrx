import { NextResponse } from "next/server";
import { sendSlackDigest, slackConfigured } from "@/lib/slack";

export const maxDuration = 60;

/** v2.6 — cron-able morning digest: POST /api/slack/digest (after autoprep). */
export async function POST() {
  if (!slackConfigured()) {
    return NextResponse.json(
      { error: "Slack not configured — set SLACK_WEBHOOK_URL (incoming webhook)" },
      { status: 400 }
    );
  }
  try {
    return NextResponse.json(await sendSlackDigest());
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Digest failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

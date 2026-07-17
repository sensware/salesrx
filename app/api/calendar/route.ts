import { NextRequest, NextResponse } from "next/server";
import { getUpcomingMeetings } from "@/lib/calendar";
import { googleUpcomingMeetings } from "@/lib/gcal";
import { getCtx, unauthorized, getGoogleToken } from "@/lib/auth";

/** Upcoming external meetings — Google Calendar (if connected) else ICS feed. */
export async function GET(req: NextRequest) {
  const ctx = await getCtx(req);
  if (!ctx) return unauthorized();
  try {
    const refresh = await getGoogleToken(ctx.userId);
    if (refresh) {
      const meetings = await googleUpcomingMeetings(refresh, 7);
      return NextResponse.json({ meetings, configured: true, source: "google" });
    }
    if (!process.env.CALENDAR_ICS_URL) {
      return NextResponse.json({ meetings: [], configured: false });
    }
    const meetings = await getUpcomingMeetings(7);
    return NextResponse.json({ meetings, configured: true, source: "ics" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calendar fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

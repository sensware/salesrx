import { NextResponse } from "next/server";
import { getUpcomingMeetings } from "@/lib/calendar";

/** Upcoming external meetings from the ICS feed (next 7 days). */
export async function GET() {
  if (!process.env.CALENDAR_ICS_URL) {
    return NextResponse.json({ meetings: [], configured: false });
  }
  try {
    const meetings = await getUpcomingMeetings(7);
    return NextResponse.json({ meetings, configured: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Calendar fetch failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

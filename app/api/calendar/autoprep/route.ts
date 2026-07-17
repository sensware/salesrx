import { NextResponse } from "next/server";
import { getUpcomingMeetings } from "@/lib/calendar";
import { loadProfile } from "@/lib/profile";
import { runResearch } from "@/lib/research";

export const maxDuration = 300;

/**
 * Auto-brief: pre-generates briefs for external meetings in the next 24h so
 * they're cached and instant when the rep opens SalesRx before the meeting.
 * Cron this nightly/hourly: curl -X POST http://localhost:3000/api/calendar/autoprep
 */
export async function POST() {
  if (!process.env.CALENDAR_ICS_URL) {
    return NextResponse.json({ prepped: [], configured: false });
  }
  const profile = loadProfile();
  if (!profile) {
    return NextResponse.json(
      { error: "No rep profile saved yet — open the app and save your profile first" },
      { status: 400 }
    );
  }

  try {
    const meetings = await getUpcomingMeetings(1); // next 24 hours
    const domains = [...new Set(meetings.flatMap((m) => m.domains))];
    const prepped: { domain: string; cached: boolean }[] = [];

    for (const domain of domains) {
      try {
        const { cached } = await runResearch(profile, {
          name: domain.split(".")[0],
          domain,
        });
        prepped.push({ domain, cached });
      } catch (e) {
        console.warn(`autoprep failed for ${domain}:`, e);
      }
    }
    return NextResponse.json({ prepped, meetings: meetings.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Autoprep failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

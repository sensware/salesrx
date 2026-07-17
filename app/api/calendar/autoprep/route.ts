import { NextResponse } from "next/server";
import { getUpcomingMeetings, type CalendarMeeting } from "@/lib/calendar";
import { googleUpcomingMeetings } from "@/lib/gcal";
import { loadProfile, profileUserIds } from "@/lib/profile";
import { getGoogleToken } from "@/lib/auth";
import { pgEnabled, db } from "@/lib/db";
import { runResearch } from "@/lib/research";

export const maxDuration = 300;

/**
 * Auto-brief: pre-generates briefs for external meetings in the next 24h.
 * Cron-friendly (no auth needed — it only warms caches). In multi-user mode it
 * sweeps every user that has a saved profile, using their Google calendar if
 * connected (ICS feed as the shared fallback).
 */
export async function POST() {
  const prepped: { user: string; domain: string; cached: boolean }[] = [];
  let meetingsSeen = 0;

  for (const userId of await profileUserIds()) {
    const profile = await loadProfile(userId);
    if (!profile) continue;

    let workspaceId = "local";
    if (pgEnabled()) {
      const p = await db();
      const r = await p.query("SELECT workspace_id FROM users WHERE id=$1", [userId]);
      workspaceId = r.rows[0]?.workspace_id || "local";
    }

    let meetings: CalendarMeeting[] = [];
    try {
      const refresh = await getGoogleToken(userId);
      if (refresh) meetings = await googleUpcomingMeetings(refresh, 1);
      else if (process.env.CALENDAR_ICS_URL) meetings = await getUpcomingMeetings(1);
    } catch (e) {
      console.warn(`autoprep calendar fetch failed for ${userId}:`, e);
      continue;
    }
    meetingsSeen += meetings.length;

    const domains = [...new Set(meetings.flatMap((m) => m.domains))];
    for (const domain of domains) {
      try {
        const { cached } = await runResearch(
          profile,
          { name: domain.split(".")[0], domain },
          workspaceId,
          { userId, workspaceId } // auto-prep counts against the rep's monthly briefs
        );
        prepped.push({ user: userId, domain, cached });
      } catch (e) {
        console.warn(`autoprep failed for ${domain}:`, e);
      }
    }
  }

  return NextResponse.json({ prepped, meetings: meetingsSeen });
}

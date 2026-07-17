/**
 * v2.6 — Slack morning digest via incoming webhook (key-gated: SLACK_WEBHOOK_URL).
 * Today's external meetings (with brief-ready status) + fresh watchlist alerts,
 * delivered where the team lives. Cron it after autoprep so briefs are warm.
 */
import { getUpcomingMeetings, type CalendarMeeting } from "./calendar";
import { loadWatchlist, watchlistWorkspaceIds } from "./watchlist";

export function slackConfigured(): boolean {
  return !!process.env.SLACK_WEBHOOK_URL;
}

export async function sendSlackDigest(): Promise<{ sent: boolean; meetings: number; alerts: number }> {
  if (!slackConfigured()) return { sent: false, meetings: 0, alerts: 0 };

  let meetings: CalendarMeeting[] = [];
  try {
    if (process.env.CALENDAR_ICS_URL) meetings = await getUpcomingMeetings(1);
  } catch {}

  // fresh alerts (last 24h) across all workspaces
  const cutoff = Date.now() - 24 * 3600 * 1000;
  const alerts: { company: string; headline: string; url?: string }[] = [];
  for (const wsId of await watchlistWorkspaceIds()) {
    for (const item of await loadWatchlist(wsId)) {
      for (const a of item.alerts) {
        if (Date.parse(a.foundAt) > cutoff) {
          alerts.push({ company: item.name, headline: a.headline, url: a.sourceUrl });
        }
      }
    }
  }

  const app = process.env.APP_URL || "http://localhost:3000";
  const lines: string[] = ["*SalesRx morning brief* ››"];
  if (meetings.length) {
    lines.push("", "*Today's external meetings:*");
    for (const m of meetings.slice(0, 8)) {
      const t = new Date(m.start).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
      lines.push(`• ${t} — *${m.title}* (${m.domains.join(", ")}) — <${app}|brief ready>`);
    }
  } else {
    lines.push("", "No external meetings detected today.");
  }
  if (alerts.length) {
    lines.push("", "*New signals on watched accounts:*");
    for (const a of alerts.slice(0, 8)) {
      lines.push(`• *${a.company}*: ${a.headline}${a.url ? ` (<${a.url}|source>)` : ""}`);
    }
  }
  lines.push("", `_Walk in already knowing. → ${app}_`);

  const res = await fetch(process.env.SLACK_WEBHOOK_URL!, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: lines.join("\n") }),
    signal: AbortSignal.timeout(15000),
  });
  return { sent: res.ok, meetings: meetings.length, alerts: alerts.length };
}

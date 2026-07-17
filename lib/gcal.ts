/**
 * Google Calendar via OAuth (v2.0). Requires GOOGLE_CLIENT_ID/SECRET —
 * users connect per-account; the ICS feed remains the zero-setup fallback.
 */
import type { CalendarMeeting } from "./calendar";
import { FREEMAIL } from "./calendar";

const REDIRECT = () =>
  process.env.GOOGLE_REDIRECT_URI ||
  `${process.env.APP_URL || "http://localhost:3000"}/api/integrations/google/callback`;

export function googleConfigured(): boolean {
  return !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;
}

export function googleAuthUrl(state: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: REDIRECT(),
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar.readonly",
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

export async function exchangeCode(code: string): Promise<{ refresh_token?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: REDIRECT(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`Google token exchange failed: ${res.status}`);
  return res.json();
}

async function accessToken(refreshToken: string): Promise<string> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) throw new Error(`Google token refresh failed: ${res.status}`);
  return (await res.json()).access_token;
}

export async function googleUpcomingMeetings(
  refreshToken: string,
  days = 7
): Promise<CalendarMeeting[]> {
  const token = await accessToken(refreshToken);
  const timeMin = new Date().toISOString();
  const timeMax = new Date(Date.now() + days * 86400000).toISOString();
  const q = new URLSearchParams({
    timeMin, timeMax, singleEvents: "true", orderBy: "startTime", maxResults: "50",
  });
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${q}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) throw new Error(`Google Calendar fetch failed: ${res.status}`);
  const data = await res.json();

  const ownDomains = (process.env.OWN_EMAIL_DOMAINS || "")
    .split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);

  const meetings: CalendarMeeting[] = [];
  for (const ev of data.items || []) {
    const start = ev.start?.dateTime || ev.start?.date;
    if (!start) continue;
    const attendees: string[] = (ev.attendees || [])
      .map((a: { email?: string }) => (a.email || "").toLowerCase())
      .filter((e: string) => {
        const dom = e.split("@")[1];
        return dom && !ownDomains.includes(dom);
      });
    const domains = [
      ...new Set(attendees.map((e) => e.split("@")[1]).filter((d) => d && !FREEMAIL.has(d))),
    ];
    if (domains.length === 0) continue;
    meetings.push({
      title: ev.summary || "(untitled)",
      start: new Date(start).toISOString(),
      attendees,
      domains,
    });
  }
  return meetings;
}

/**
 * Calendar integration via secret ICS feed URL — no OAuth required.
 * Google Calendar: Settings → <calendar> → "Secret address in iCal format"
 * Outlook: Settings → Shared calendars → Publish → ICS link
 */

export interface CalendarMeeting {
  title: string;
  start: string; // ISO
  attendees: string[]; // external attendee emails
  domains: string[]; // external company domains (deduped, freemail excluded)
}

const FREEMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com",
  "yahoo.com", "icloud.com", "me.com", "aol.com", "proton.me", "protonmail.com",
  "gmx.com", "mail.com",
]);

/** Unfold ICS lines (continuations start with space/tab) and split into VEVENT blocks. */
function eventBlocks(ics: string): string[] {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const blocks: string[] = [];
  const re = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/g;
  let m;
  while ((m = re.exec(unfolded))) blocks.push(m[1]);
  return blocks;
}

/** Parse ICS datetime (20260717, 20260717T140000, 20260717T140000Z) to a Date. */
function parseIcsDate(value: string): Date | null {
  const m = value.match(/(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const [, y, mo, d, h = "0", mi = "0", s = "0", z] = m;
  if (z) return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return new Date(+y, +mo - 1, +d, +h, +mi, +s);
}

function fieldValue(block: string, name: string): string | null {
  const m = block.match(new RegExp(`^${name}[^:\\n]*:(.*)$`, "mi"));
  return m ? m[1].trim() : null;
}

export async function getUpcomingMeetings(days = 7): Promise<CalendarMeeting[]> {
  const url = process.env.CALENDAR_ICS_URL;
  if (!url) return [];
  const ownDomains = (process.env.OWN_EMAIL_DOMAINS || "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Calendar feed returned ${res.status}`);
  const ics = await res.text();

  const now = Date.now();
  const horizon = now + days * 24 * 60 * 60 * 1000;
  const meetings: CalendarMeeting[] = [];

  for (const block of eventBlocks(ics)) {
    const dtstart = fieldValue(block, "DTSTART");
    if (!dtstart) continue;
    const start = parseIcsDate(dtstart);
    if (!start || start.getTime() < now || start.getTime() > horizon) continue;

    const attendeeEmails = [...block.matchAll(/ATTENDEE[^:\n]*:mailto:([^\s\n]+)/gi)].map((m) =>
      m[1].toLowerCase()
    );
    const external = attendeeEmails.filter((e) => {
      const dom = e.split("@")[1];
      return dom && !ownDomains.includes(dom);
    });
    const domains = [
      ...new Set(
        external.map((e) => e.split("@")[1]).filter((d) => d && !FREEMAIL.has(d))
      ),
    ];
    if (domains.length === 0) continue; // internal meeting — nothing to prep

    meetings.push({
      title: fieldValue(block, "SUMMARY") || "(untitled)",
      start: start.toISOString(),
      attendees: external,
      domains,
    });
  }

  return meetings.sort((a, b) => a.start.localeCompare(b.start));
}

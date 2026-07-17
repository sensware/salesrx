<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-lockup-dark.svg">
  <img src="public/brand/logo-lockup-light.svg" alt="SalesRx" width="340">
</picture>

**Walk in already knowing.**

![version](https://img.shields.io/badge/version-0.3.0-0E8C55?labelColor=0B1F3A)
![stack](https://img.shields.io/badge/Next.js_15_·_TypeScript-0B1F3A?labelColor=0B1F3A&color=41586E)
![ai](https://img.shields.io/badge/Anthropic_API_+_web_search-0E8C55?labelColor=0B1F3A)
![deploy](https://img.shields.io/badge/Docker-self--hostable-D9A441?labelColor=0B1F3A)

SalesRx is a corner team for every sales rep. It researches any prospect live on the web, personalizes the game plan to the rep's own edge, and remembers every meeting — so brief #2 is smarter than brief #1.

A rep sets up their profile once (industry, vertical, competitors, differentiator). SalesRx then generates a one-page pre-meeting brief for any prospect: buying signals with sources, likely stack and incumbent, decision map, rapport intel, objection forecast — and **pain points mapped to NEPQ question ladders** (Situation → Problem awareness → Consequence → Solution awareness).

## How it works

```
Rep profile + prospect input (or auto-detected from calendar)
        │
        ▼
POST /api/research
        │  Claude + live web search  →  cited signals, never invented
        │  TheirStack (optional)     →  verified hiring + technographic data
        │  Account memory            →  what happened in previous meetings
        ▼
The Brief — signals · NEPQ ladders · decision map · objections · fit score
        │
        ▼
Log meeting notes → outcomes + follow-up email draft → memory for next time
```

Three rules the pipeline never breaks: every claim carries a **source link**, thin evidence gets a **confidence label** instead of invented specifics, and pain points must cite the **signal they came from**.

## Quick start

```bash
git clone https://github.com/sensware/salesrx.git && cd salesrx
npm install
cp .env.example .env      # add ANTHROPIC_API_KEY
npm run dev               # → http://localhost:3000
```

Or with Docker (includes nightly watchlist + auto-brief cron):

```bash
docker compose up -d --build
```

Full deployment guide: [`docs/deploy-docker.md`](docs/deploy-docker.md)

## Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | **required** |
| `THEIRSTACK_API_KEY` | — | verified hiring + technographic signals; falls back to LLM web search |
| `CALENDAR_ICS_URL` | — | secret iCal link → upcoming-meeting detection + auto-brief (no OAuth) |
| `OWN_EMAIL_DOMAINS` | — | your company domain(s), so internal attendees are ignored |
| `HUBSPOT_ACCESS_TOKEN` | — | sync briefs + meeting logs to HubSpot as company notes |
| `SALESRX_MODEL` | `claude-sonnet-5` | model for research + synthesis |
| `SALESRX_MAX_WEB_SEARCHES` | `8` | web-search budget per brief |
| `SALESRX_CACHE_TTL_HOURS` | `24` | brief cache freshness |

Every integration is key-gated with a graceful fallback — no key, no breakage.

## Features by version

**v1.0 — the brief.** Live AI research with citations, NEPQ question ladders, positioning coaching from the rep profile.

**v1.1 — signals.** Verified job-posting technographics (TheirStack), watchlist with delta-only alerts (`POST /api/watchlist/refresh`, cron-able).

**v1.2 — workflow.** Calendar auto-brief via secret ICS feed, one-click prep for upcoming external meetings (`POST /api/calendar/autoprep` pre-briefs the next 24h), HubSpot private-app sync, and the post-meeting memory loop: raw notes → outcomes, next steps, follow-up email draft, rolling account memory.

**v2 — next.** Multi-rep teams with shared memory, Postgres, OAuth calendars, Salesforce.

## Project structure

```
app/page.tsx               3-screen flow: profile → research → brief
app/api/research           live research pipeline
app/api/meetings           notes → extraction → account memory
app/api/calendar[/autoprep] ICS meetings + cron pre-briefing
app/api/watchlist[/refresh] signal alerts (delta-only)
app/api/crm/sync           HubSpot company notes
lib/                       prompts, research core, signals, memory, cache
docs/                      pipeline spec · deploy guide · brand guidelines · pitch deck
public/brand/              logo assets (The Advance)
```

## Brand

The design system lives in [`docs/brand-guidelines.html`](docs/brand-guidelines.html): Command Navy `#0B1F3A` (authority), Vanguard Green `#0E8C55` (the one action that matters), Medal Gold `#D9A441` (earned wins only), Valor Red `#C8102E` (warnings only). One rule above all: the brief must make a rep feel more prepared walking into the room.

---

Luke Jian · jian.lucian@gmail.com · Confidential — all rights reserved.

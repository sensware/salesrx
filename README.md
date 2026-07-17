# SalesRx

AI sales intelligence — walk into every prospect meeting prepared.

A rep sets up their profile (industry, vertical, competitors, differentiator). SalesRx then researches any prospect **live on the web** and generates a personalized pre-meeting brief: buying signals, likely stack and incumbent, decision map, rapport intel, objection forecast, and **pain points mapped to NEPQ question ladders** (Situation → Problem awareness → Consequence → Solution awareness).

## How it works

```
Rep profile + prospect input
        │
        ▼
POST /api/research
        │  Claude (Anthropic API) + web search tool
        │  → researches news, hiring, stack, people (with citations)
        │  → synthesizes brief JSON personalized to the rep's moat
        ▼
Brief UI (Next.js) — signals, NEPQ ladders, decision map, objections, sources
```

- **Every claim carries a source** — the brief links citations; reps verify before quoting.
- **NEPQ ladders are evidence-linked** — each pain point cites the signal it was derived from, with a confidence label instead of invented specifics.
- **File cache** (`data/cache/`, 24h TTL) avoids re-paying for repeat research.

## Setup

```bash
npm install
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm run dev               # http://localhost:3000
```

## Config (.env)

| Variable | Default | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | — | required |
| `THEIRSTACK_API_KEY` | — | optional: verified hiring + technographic signals; falls back to LLM web search |
| `CALENDAR_ICS_URL` | — | optional: secret ICS feed for upcoming-meeting detection + auto-brief |
| `OWN_EMAIL_DOMAINS` | — | your company domain(s), so internal attendees are ignored |
| `HUBSPOT_ACCESS_TOKEN` | — | optional: sync briefs + meeting logs to HubSpot as company notes |
| `SALESRX_MODEL` | `claude-sonnet-5` | model for research + synthesis |
| `SALESRX_MAX_WEB_SEARCHES` | `8` | web-search budget per brief |
| `SALESRX_CACHE_TTL_HOURS` | `24` | brief cache freshness |

## v1.1 features

- **Structured signals** — with a TheirStack key, briefs are grounded in job-posting data (open roles + detected tech stack with confidence levels) injected into the research agent as verified ground truth.
- **Watchlist + alerts** — add a prospect from its brief; "Check for new signals" runs a cheap delta search (3 web searches, only NEW items vs. known signals). For nightly alerts, cron a POST to `/api/watchlist/refresh`:
  ```
  0 6 * * * curl -X POST http://localhost:3000/api/watchlist/refresh
  ```

## v1.2 features

- **Post-meeting memory loop** — paste raw notes after a meeting; SalesRx extracts outcomes, next steps, and objections heard, drafts your follow-up email, and updates a rolling account memory that is injected into every future brief for that prospect. Brief #2 knows what happened in meeting #1.
- **Calendar auto-brief** — set `CALENDAR_ICS_URL` (secret iCal link, no OAuth) and the app shows upcoming external meetings with one-click "Prep brief". A cron on `/api/calendar/autoprep` pre-generates briefs for the next 24h of meetings so they're instant.
- **HubSpot sync** — with a private-app token, "Sync brief to CRM" and "Sync meeting to CRM" attach formatted notes to the (auto-created) company record.

## Roadmap (see docs/pipeline-spec.md)

- ~~v1.1 — technographics + hiring-signal APIs, watchlist alerts~~ ✓
- ~~v1.2 — calendar auto-brief, CRM sync, post-meeting notes → account memory~~ ✓
- v2 — multi-rep teams, Postgres migration, Google/Microsoft OAuth calendar, Salesforce

## Project structure

```
app/page.tsx              3-screen flow: profile → research → brief
app/api/tips/route.ts     coaching tips from rep profile
app/api/research/route.ts live research pipeline (Claude + web search)
lib/prompts.ts            research & NEPQ generation prompts
lib/types.ts              Brief schema shared by API and UI
lib/cache.ts              file-based response cache
docs/pipeline-spec.md     full architecture spec
```

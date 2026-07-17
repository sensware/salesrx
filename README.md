<picture>
  <source media="(prefers-color-scheme: dark)" srcset="public/brand/logo-lockup-dark.svg">
  <img src="public/brand/logo-lockup-light.svg" alt="SalesRx" width="340">
</picture>

**Walk in already knowing.**

![version](https://img.shields.io/badge/version-2.6.0-0E8C55?labelColor=0B1F3A)
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
        │  SEC EDGAR + press RSS     →  filings, press releases, earnings-call excerpts
        │  Account memory            →  what the team already knows (shared per workspace)
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
| `DATABASE_URL` | — | **v2 team mode:** Postgres storage, login, shared workspace memory. Unset = single-user file mode |
| `AUTH_SECRET` | derived | session-signing secret for team mode |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | per-user Google Calendar OAuth (ICS stays as fallback) |
| `SALESFORCE_INSTANCE_URL` / `SALESFORCE_ACCESS_TOKEN` | — | Salesforce sync (Account upsert + activity notes) |
| `THEIRSTACK_API_KEY` | — | verified hiring + technographic signals; falls back to LLM web search |
| `SALESRX_EDGAR_UA` | generic | contact string the SEC requires in EDGAR requests (set your email) |
| `API_NINJAS_KEY` | — | earnings-call transcript excerpts in briefs (public companies) |
| `CALENDAR_ICS_URL` | — | secret iCal link → upcoming-meeting detection + auto-brief (no OAuth) |
| `OWN_EMAIL_DOMAINS` | — | your company domain(s), so internal attendees are ignored |
| `HUBSPOT_ACCESS_TOKEN` | — | sync briefs + meeting logs to HubSpot as company notes |
| `SALESRX_MODEL` | `claude-sonnet-5` | model for research + synthesis |
| `SALESRX_MAX_WEB_SEARCHES` | `8` | web-search budget per brief |
| `SALESRX_CACHE_TTL_HOURS` | `24` | brief cache freshness |
| `SALESRX_PLAN` | `pro` | `free` / `pro` / `team` — sets default usage limits (margin guard) |
| `SALESRX_MONTHLY_BRIEF_LIMIT` | plan-based | fresh briefs per rep per month (30 on Pro = 70% margin floor) |
| `SLACK_WEBHOOK_URL` | — | morning digest: today's meetings + fresh watchlist signals |

Every integration is key-gated with a graceful fallback — no key, no breakage.

## Features by version

**v1.0 — the brief.** Live AI research with citations, NEPQ question ladders, positioning coaching from the rep profile.

**v1.1 — signals.** Verified job-posting technographics (TheirStack), watchlist with delta-only alerts (`POST /api/watchlist/refresh`, cron-able).

**v1.2 — workflow.** Calendar auto-brief via secret ICS feed, one-click prep for upcoming external meetings (`POST /api/calendar/autoprep` pre-briefs the next 24h), HubSpot private-app sync, and the post-meeting memory loop: raw notes → outcomes, next steps, follow-up email draft, rolling account memory.

**v2.1 — primary sources.** Briefs are now grounded in the official record, not just web search: SEC EDGAR full-text search surfaces recent 8-K/10-K/10-Q filings (8-K exhibits usually contain the earnings press release), Google News RSS captures press coverage with wire releases flagged `[PR]` — both free, no keys. With an `API_NINJAS_KEY`, earnings-call transcript excerpts (selected around the rep's vertical keywords) feed pain points and NEPQ consequence questions with executives' verbatim words. Everything degrades gracefully: private company, no filings → the collectors simply contribute nothing.

**v2.0 — teams.** Set `DATABASE_URL` and SalesRx becomes multi-user: register/login (JWT sessions), workspaces with invite codes, and **shared account memory** — any rep's logged meeting improves the whole team's next brief on that account. Postgres replaces file storage (schema bootstraps itself), Google Calendar connects per-user via OAuth (ICS feed remains the zero-setup fallback), and CRM sync now targets Salesforce alongside HubSpot. Without `DATABASE_URL`, everything still runs exactly as v1.2 — single rep, file storage, no login.

**v2.2 — margin guard.** Per-rep monthly usage metering with plan limits derived from the margin math: 30% of the $49 Pro price = $14.70 COGS budget = 30 fresh briefs at ~$0.49 each, so **≥70% gross margin holds by construction**. Cached results are always free; limits are env-overridable for self-hosters (`SALESRX_PLAN`, `SALESRX_MONTHLY_BRIEF_LIMIT`). Usage meter in the UI, friendly 429s with the reset date.

**v2.3 — NEPQ call scripts.** One click on any brief generates a word-for-word call script grounded in that prospect's real pain points: permission-based opener referencing a researched fact, the full question ladder, objection reframes with exact wording, and close-the-next-meeting language — with coach notes throughout that teach new reps NEPQ delivery (when to pause, what to listen for). Cold call, discovery, or follow-up variants; team account memory included.

**v2.5 — proof.** Meeting logs now capture structured outcomes — next step booked and deal stage, declared by the rep or inferred from the notes. The team analytics card computes the loop: next-step rate, briefed-account→meeting conversion, stage funnel, most-heard objections, and per-rep stats (`GET /api/analytics`).

**v2.6 — in the room.** Pocket brief at `/pocket` — installable PWA rendering the last brief from device storage, built for parking lots; an audio "corner talk" of any brief via browser TTS (zero API cost); and a Slack morning digest (`SLACK_WEBHOOK_URL`) with today's external meetings and fresh watchlist signals, cron'd weekdays at 06:30 in compose.

**Next** — see [`docs/roadmap.md`](docs/roadmap.md): the Dojo (AI roleplay practice against the actual brief), then enterprise (SOC 2/SSO, Microsoft calendar).

## Project structure

```
app/page.tsx                flow: (login) → profile → research → brief
app/api/auth, /workspace    v2.0 accounts, sessions, invite codes
app/api/research            live research pipeline
app/api/meetings            notes → extraction → shared account memory
app/api/calendar[/autoprep] Google OAuth or ICS meetings + cron pre-briefing
app/api/watchlist[/refresh] signal alerts (delta-only, all-workspace cron sweep)
app/api/crm/sync            HubSpot + Salesforce notes
app/api/integrations/google OAuth connect flow
lib/                        prompts · research core · db (Postgres/file) · auth
                            theirstack · edgar · newsfeed · transcripts · gcal · salesforce
docs/                       pipeline spec · deploy guide · brand guidelines · pitch deck · business plan
public/brand/               logo assets (The Advance)
```

## Brand

The design system lives in [`docs/brand-guidelines.html`](docs/brand-guidelines.html): Command Navy `#0B1F3A` (authority), Vanguard Green `#0E8C55` (the one action that matters), Medal Gold `#D9A441` (earned wins only), Valor Red `#C8102E` (warnings only). One rule above all: the brief must make a rep feel more prepared walking into the room.

---

Luke Jian · Confidential — all rights reserved.

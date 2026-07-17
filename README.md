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
| `SALESRX_MODEL` | `claude-sonnet-5` | model for research + synthesis |
| `SALESRX_MAX_WEB_SEARCHES` | `8` | web-search budget per brief |
| `SALESRX_CACHE_TTL_HOURS` | `24` | brief cache freshness |

## v1.1 features

- **Structured signals** — with a TheirStack key, briefs are grounded in job-posting data (open roles + detected tech stack with confidence levels) injected into the research agent as verified ground truth.
- **Watchlist + alerts** — add a prospect from its brief; "Check for new signals" runs a cheap delta search (3 web searches, only NEW items vs. known signals). For nightly alerts, cron a POST to `/api/watchlist/refresh`:
  ```
  0 6 * * * curl -X POST http://localhost:3000/api/watchlist/refresh
  ```

## Roadmap (see docs/pipeline-spec.md)

- ~~v1.1 — technographics + hiring-signal APIs, watchlist alerts~~ ✓
- v1.2 — calendar auto-brief, CRM sync, post-meeting notes → account memory

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

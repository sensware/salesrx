# SalesRx — AI Research Pipeline Spec (v1)

Goal: turn the prototype's mocked brief into a live pipeline that researches any prospect in <90 seconds and outputs the same brief structure, personalized to the rep's profile, including NEPQ pain-point question ladders.

Analogy for the architecture: think of it as a newsroom. Stringers (data APIs) file raw reports, a researcher (LLM agent with web search) verifies and fills gaps, and an editor (synthesis LLM) writes the one-page brief in the house style your rep profile defines.

---

## 1. Pipeline overview

```
Rep profile ─┐
             ▼
Input (name/domain/location/contact)
             │
   ┌─────────┴──────────┐
   ▼                    ▼
STAGE A: Resolve     STAGE B: Parallel signal collection
(entity resolution)   ├─ Firmographics (enrichment API)
                      ├─ News & strategy (news API + LLM web search)
                      ├─ Technographics (job-post + web detection)
                      ├─ Hiring signals (job postings API)
                      └─ People / decision map (people enrichment)
             │
             ▼
STAGE C: LLM synthesis (Claude)
  ├─ Fit score vs. rep profile
  ├─ Pain-point inference (evidence-linked)
  ├─ NEPQ question ladder generation
  ├─ Objection forecast vs. rep's competitors
  └─ Brief assembly (JSON → UI)
             │
             ▼
STAGE D: Delivery & loop
  ├─ Brief UI / battle-card export
  ├─ Calendar auto-brief, watchlist alerts
  └─ Post-meeting notes → feedback into next brief
```

---

## 2. Stage A — Entity resolution

Input can be partial (name only, or domain only). Resolve to a canonical company record before spending API credits.

- Domain given → enrichment lookup by domain (highest confidence).
- Name only → search enrichment API; disambiguate with the location field ("Meridian Foods, Boston" ≠ "Meridian Foods, Sydney").
- Ambiguous match → return top 3 candidates to the rep to pick (one cheap UI step saves every downstream API call from being wrong).

Cache resolved entities 30 days.

## 3. Stage B — Signal collection (parallel, ~15–30s)

| Signal | Primary source | Fallback / notes |
|---|---|---|
| Firmographics (size, revenue, industry) | People Data Labs (~$0.01–0.10/record) or Apollo (from ~$119/mo, bundled outreach) | Clearbit is now HubSpot Breeze — only worth it if you go HubSpot-native |
| Contacts & decision makers | Apollo / PDL person search by title at company | Never scrape LinkedIn directly (ToS); use licensed providers |
| Technographics (what they run) | TheirStack or Crustdata (job-post-based: shows current + planned stack) | BuiltWith/Wappalyzer for website-detectable tech |
| Hiring signals | Same job-post APIs — titles, count, mentioned tools | "Hiring 3 X-admins" = incumbent confirmation + growth signal |
| News, funding, exec changes | News API (GDELT is free; NewsAPI/Bing paid tiers) | LLM web-search agent (below) covers earnings calls, press releases, local news |
| Rapport intel on the named contact | LLM web-search agent over public sources: talks, podcasts, published articles, company bio | Keep to professional/public info only — see §7 |

**LLM research agent.** APIs give structured breadth; an agent gives judgment and coverage of the long tail (a CEO quote in a trade journal, a strategy shift buried in an earnings transcript). Run a Claude agent with the Anthropic API's web search tool, budgeted at 5–10 searches per brief, with instructions to (a) cite a URL for every claim, (b) prefer sources <6 months old, (c) return structured JSON matching the brief schema. Signal-based relevance is the whole product — stale intel is worse than none.

Every collected fact carries `{claim, source_url, date, confidence}`. The UI shows sources on tap; reps must be able to verify before repeating a claim in a meeting.

## 4. Stage C — Synthesis (the differentiating step)

One synthesis call to Claude (Sonnet-class is sufficient; use the larger model only if quality demands) with three inputs: the rep profile, all Stage-B evidence, and the output JSON schema the UI renders.

**Pain-point inference.** Pains must be *derived from evidence*, not generic to the industry: each pain point links to ≥1 signal (earnings quote, job post, news item). If evidence is thin, the brief says so ("low-confidence inference") rather than hallucinating.

**NEPQ ladder generation.** For each pain point, generate a 4-question ladder:

1. **Situation** — neutral fact-finding about their current state (referencing detected stack/process, so it sounds researched).
2. **Problem awareness** — surfaces where the current state breaks, in their words.
3. **Consequence** — cost of inaction: money, time, internal standing. This is the emotional core; phrase it so the *prospect* states the cost.
4. **Solution awareness** — has them picture the fixed state, subtly shaped by the rep's differentiator without pitching it.

Prompt rules that matter: questions must be answerable only by the prospect (no yes/no), reference specific detected facts, never mention the rep's product by name in stages 1–3, and include a tone note (calm, curious, pause after consequence questions). Optionally add stage 5 — **Commitment/transition** ("What would you want to see to feel confident this is worth 30 more minutes?") for reps who run full NEPQ.

**Objection forecast.** Cross the detected incumbent with the rep's declared competitors and moat → 3 predicted objections + reframes.

**Fit score.** Weighted rubric scored by the LLM with visible sub-scores (ICP match, timing signals, incumbent vulnerability, warm-path availability) — transparent beats a black-box number.

## 5. Stage D — Delivery & feedback loop

- Brief rendered in app + one-page mobile battle card (PDF/share link).
- Calendar integration (Google/Microsoft OAuth): detect external meetings, auto-run pipeline, deliver brief 1 hour before.
- Watchlist: nightly re-run of Stage B deltas per watched company; push alert only on new signals (new exec, funding, relevant job post).
- Post-meeting: rep dictates/types notes → LLM extracts outcomes, updates the account memory, drafts follow-up email → next brief for this account starts from what happened last time. This memory is the compounding moat.

## 6. MVP stack & cost

- **App:** Next.js + Postgres (accounts, briefs, cached signals) + a job queue (Inngest/Trigger.dev or plain BullMQ) for the pipeline.
- **LLM:** Anthropic API — agentic research (web search tool) + one synthesis call.
- **Per-brief cost estimate:** enrichment $0.05–0.30, job/tech signals $0.05–0.20, news ~free–$0.05, LLM (research + synthesis) $0.10–0.40 → **roughly $0.25–1.00 per brief**. At a $20–50/mo/rep price with ~30 briefs/mo, margins work; caching (30-day entity, 24-hour signals) cuts repeat-lookup cost sharply.
- **Phasing:**
  - **MVP (4–6 wks):** manual prospect input → live brief with news + firmographics + LLM research agent + NEPQ ladders. Skip calendar/CRM.
  - **v1.1:** technographics + hiring signals APIs, watchlist alerts.
  - **v1.2:** calendar auto-brief, CRM sync (HubSpot first), post-meeting loop.

## 7. Compliance guardrails

- No LinkedIn scraping; person data only via licensed providers with GDPR/CCPA basis.
- Rapport intel limited to professional/public info (talks, articles, company bios) — no personal social media digging; briefs label rapport items with their public source.
- Store citations with every claim; add a visible "verify before quoting" nudge on financial figures.

---

*Sources consulted for the data-source landscape:* [Autobound — Best B2B Data Enrichment APIs 2026](https://www.autobound.ai/blog/best-b2b-data-enrichment-apis), [Cleanlist — Enrichment APIs ranked 2026](https://www.cleanlist.ai/blog/2026-03-05-best-b2b-data-enrichment-apis), [TheirStack — Technographic Data APIs](https://theirstack.com/en/blog/best-technographic-data-apis), [Crustdata — Technographic providers](https://crustdata.com/blog/technographic-data-providers). Verify current pricing before committing — these figures move quarterly.

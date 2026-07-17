# SalesRx — Product Roadmap

> Walk in already knowing. The roadmap follows one arc: **prepare the rep → arm the rep in the room → prove it worked → make the whole team better.**

## Shipped

| Version | Theme | What it delivered |
|---|---|---|
| v1.0 | The brief | Live AI research with citations, NEPQ pain-point ladders, coaching tips |
| v1.1 | Signals | TheirStack technographics + hiring data, watchlist with delta-only alerts |
| v1.2 | Workflow | Calendar auto-brief (ICS), HubSpot sync, post-meeting memory loop, Docker |
| v2.0 | Teams | Workspaces with shared account memory, Postgres, Google OAuth calendar, Salesforce |
| v2.1 | Primary sources | SEC EDGAR filings, press RSS ([PR]-flagged), earnings-call transcript excerpts |
| v2.2 | Margin guard | Usage metering + plan limits: 30% COGS budget → ≥70% gross margin by construction |
| v2.3 | Rep enablement | NEPQ call-script generator: opener → ladders with real pains → objections → close, with coach notes for new reps |
| v2.5 | Proof | Outcome analytics: structured meeting outcomes (next step, stage), next-step rate, brief→meeting conversion, objection leaderboard, per-rep stats |
| v2.6 | In the room | Pocket brief PWA (offline last brief), audio "corner talk" (browser TTS), Slack morning digest |

## Next up

### v2.4 — The Dojo (rep enablement, part 2)
Roleplay mode: the AI plays the prospect **using the actual brief** — their pains, their objections, their personality signals — and the new rep practices the call before making it. After each round: a scorecard (did they pitch too early? skip the consequence question? talk more than 30%?) plus drill suggestions. Pairs directly with v2.3: script → practice → real call.

### v3.0 — Enterprise
SOC 2, SSO/SAML, Microsoft OAuth calendar, roles & territories, audit logs, annual contracts. Gated on design-partner traction, not calendar dates.

## Candidate ideas (unscheduled — for discussion)

| Idea | Why it might win | Open question |
|---|---|---|
| Live call copilot | Real-time NEPQ nudges during calls (transcription + brief context) — the endgame of "corner team" | Latency, consent/recording laws, crowded space (Gong et al.) |
| Chrome extension | Brief-in-a-sidebar on LinkedIn/CRM pages — meets reps where they prospect | Extension review + maintenance overhead |
| Email & sequence writer | Signal-grounded outreach drafts feeding the meeting the brief then preps | Adjacent to crowded SEP market; maybe integrate, not compete |
| Win-story library | Workspace-wide reference-case matcher that improves with every closed deal | Needs deal-outcome data first (v2.5) |
| Multi-language briefs | EU/LATAM expansion; NEPQ ladders localized, not just translated | Demand signal needed |
| Partner/agency mode | Agencies running SalesRx for multiple client workspaces | Billing + data isolation complexity |
| Brief API / embed | Sell the brief as an API to CRMs and SEPs (B2B2B) | Cannibalizes seats vs. expands reach |

## Operating principles

Every feature must pass the corner-team test: *does it make a rep more prepared or more confident in the room?* Margin is a feature (v2.2 keeps every account ≥70% gross by construction). Integrations stay key-optional with graceful fallbacks. And evidence discipline is non-negotiable: no invented specifics, sources on every claim.

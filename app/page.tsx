"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Brief, CallScript, CoachingTip, MeetingType, ProspectInput, RepProfile,
} from "@/lib/types";
import type { WatchItem } from "@/lib/watchlist";
import type { CalendarMeeting } from "@/lib/calendar";
import type { MeetingRecord } from "@/lib/accounts";

type Screen = "auth" | "profile" | "search" | "loading" | "brief";

interface Me {
  mode: "multi" | "local";
  user: { email?: string; name?: string; role?: string } | null;
  googleAvailable: boolean;
  googleConnected?: boolean;
}

const LOAD_STEPS = [
  "Company profile & firmographics",
  "News, funding & strategy shifts",
  "Tech & vendor stack detection",
  "Org changes & key decision makers",
  "Rapport intel on your contact",
  "Matching against your profile",
];

const ROLE_LABEL: Record<string, string> = {
  economic_buyer: "Economic buyer",
  champion: "Likely champion",
  blocker: "Potential blocker",
  influencer: "Influencer",
};

export default function Home() {
  const [screen, setScreen] = useState<Screen>("profile");
  const [profile, setProfile] = useState<RepProfile>({
    industry: "",
    vertical: "",
    productType: "",
    location: "",
    competitors: "",
    moat: "",
  });
  const [prospect, setProspect] = useState<ProspectInput>({
    name: "",
    domain: "",
    location: "",
    contact: "",
  });
  const [tips, setTips] = useState<CoachingTip[] | null>(null);
  const [tipsLoading, setTipsLoading] = useState(false);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadStep, setLoadStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [watchlist, setWatchlist] = useState<WatchItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [watchAdded, setWatchAdded] = useState(false);
  const [calMeetings, setCalMeetings] = useState<CalendarMeeting[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [usage, setUsage] = useState<{
    plan: string;
    used: { briefs: number; scripts: number };
    limits: { briefs: number; scripts: number };
    estCostUsd: number;
    budgetUsd: number;
  } | null>(null);

  async function loadUsage() {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) setUsage(await res.json());
    } catch {}
  }
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [authForm, setAuthForm] = useState({ email: "", password: "", name: "", workspaceName: "", inviteCode: "" });
  const [workspace, setWorkspace] = useState<{ workspace: { name: string; invite_code: string } | null; members: { email: string; name: string; role: string; calendar_connected: boolean }[] }>({ workspace: null, members: [] });

  async function loadMe() {
    try {
      const res = await fetch("/api/auth/me");
      const data: Me = await res.json();
      setMe(data);
      if (data.mode === "multi" && !data.user) setScreen("auth");
      else if (data.mode === "multi") {
        fetch("/api/workspace").then((r) => r.json()).then(setWorkspace).catch(() => {});
        fetch("/api/profile").then((r) => r.json()).then((d) => { if (d.profile) setProfile(d.profile); }).catch(() => {});
      }
    } catch {}
  }

  async function submitAuth() {
    setError(null);
    const path = authMode === "login" ? "/api/auth/login" : "/api/auth/register";
    try {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(authForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Authentication failed");
      setScreen("profile");
      loadMe();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authentication failed");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setScreen("auth");
    setMe((m) => (m ? { ...m, user: null } : m));
  }
  const [notes, setNotes] = useState("");
  const [logging, setLogging] = useState(false);
  const [meetingResult, setMeetingResult] = useState<MeetingRecord | null>(null);
  const [crmStatus, setCrmStatus] = useState<string | null>(null);
  const [script, setScript] = useState<CallScript | null>(null);
  const [scriptType, setScriptType] = useState<MeetingType>("discovery");
  const [scriptLoading, setScriptLoading] = useState(false);

  async function generateScript() {
    if (!brief) return;
    setScriptLoading(true);
    setScript(null);
    try {
      const res = await fetch("/api/script", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, brief, meetingType: scriptType, domain: prospect.domain }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Script generation failed");
      setScript(data.script);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Script generation failed");
    } finally {
      setScriptLoading(false);
    }
  }

  function scriptToText(s: CallScript): string {
    return (
      `NEPQ call script — ${s.company} (${s.meetingType}, ${s.durationHint})\n\n` +
      s.sections
        .map(
          (sec) =>
            `## ${sec.name} — ${sec.goal}\n` +
            sec.lines
              .map((l) => (l.speaker === "coach" ? `   [coach: ${l.text}]` : `REP: ${l.text}`))
              .join("\n")
        )
        .join("\n\n")
    );
  }

  async function loadCalendar() {
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json();
      if (res.ok && data.configured) setCalMeetings(data.meetings);
    } catch {}
  }

  async function logMeeting() {
    if (!brief || !notes.trim()) return;
    setLogging(true);
    setMeetingResult(null);
    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brief.company, domain: prospect.domain, notes }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Meeting analysis failed");
      setMeetingResult(data.meeting);
      setNotes("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Meeting analysis failed");
    } finally {
      setLogging(false);
    }
  }

  async function syncToCrm(payload: { brief?: Brief; noteText?: string }) {
    if (!brief) return;
    setCrmStatus("Syncing…");
    try {
      const res = await fetch("/api/crm/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: brief.company, domain: prospect.domain, ...payload }),
      });
      const data = await res.json();
      setCrmStatus(res.ok ? "✓ Synced to HubSpot" : data.error);
    } catch {
      setCrmStatus("CRM sync failed");
    }
  }

  async function loadWatch() {
    try {
      const res = await fetch("/api/watchlist");
      const data = await res.json();
      if (res.ok) setWatchlist(data.watchlist);
    } catch {}
  }

  async function addToWatchlist() {
    if (!brief) return;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: brief.company,
        domain: prospect.domain || undefined,
        knownSignals: brief.signals.map((s) => s.headline),
      }),
    });
    setWatchAdded(true);
    loadWatch();
  }

  async function refreshWatchlist(id?: string) {
    setRefreshing(true);
    try {
      const res = await fetch("/api/watchlist/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(id ? { id } : {}),
      });
      const data = await res.json();
      if (res.ok) setWatchlist(data.watchlist);
    } catch {}
    setRefreshing(false);
  }

  async function removeFromWatchlist(id: string) {
    const res = await fetch(`/api/watchlist?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (res.ok) setWatchlist(data.watchlist);
  }

  useEffect(() => {
    // load saved profile (local mode) then check auth mode
    const saved = typeof window !== "undefined" && localStorage.getItem("salesrx.profile");
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch {}
    }
    loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (screen === "search") {
      loadWatch();
      loadCalendar();
      loadUsage();
    }
    if (screen === "brief") {
      setWatchAdded(false);
      setMeetingResult(null);
      setCrmStatus(null);
      setScript(null);
    }
    if (screen === "loading") {
      setLoadStep(0);
      timerRef.current = setInterval(
        () => setLoadStep((s) => Math.min(s + 1, LOAD_STEPS.length - 1)),
        2500
      );
      return () => {
        if (timerRef.current) clearInterval(timerRef.current);
      };
    }
  }, [screen]);

  const step = screen === "auth" || screen === "profile" ? 1 : screen === "brief" ? 3 : 2;

  async function generateTips() {
    localStorage.setItem("salesrx.profile", JSON.stringify(profile));
    // also persist server-side so calendar auto-prep can use it
    fetch("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile }),
    }).catch(() => {});
    setTipsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tips generation failed");
      setTips(data.tips);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Tips generation failed");
    } finally {
      setTipsLoading(false);
    }
  }

  async function research(override?: ProspectInput) {
    const target = override || prospect;
    setError(null);
    setScreen("loading");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prospect: target }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Research failed");
      setBrief(data.brief);
      setScreen("brief");
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Research failed");
      setScreen("search");
    }
  }

  function initials(name: string) {
    return name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    <div className="app">
      <header className="top">
        <div className="logo">
          <svg width="34" height="22" viewBox="0 0 100 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <polygon points="0,0 20,0 52,32 20,64 0,64 32,32" fill="#0E8C55" />
            <polygon points="36,0 56,0 88,32 56,64 36,64 68,32" fill="#F4F6F8" />
            <circle cx="93" cy="7" r="5" fill="#D9A441" />
          </svg>
          <div>
            Sales<span>Rx</span>
            <small>walk in prepared</small>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {me?.mode === "multi" && me.user && (
            <>
              <span style={{ fontSize: 12, color: "var(--muted)" }}>{me.user.email}</span>
              <button className="btn ghost small" onClick={logout}>Sign out</button>
            </>
          )}
          <div className="stepper">
            {[1, 2, 3].map((n) => (
              <div key={n} className={`dot ${n === step ? "active" : n < step ? "done" : ""}`}>
                {n}
              </div>
            ))}
          </div>
        </div>
      </header>

      {screen === "auth" && (
        <section className="card" style={{ maxWidth: 460, margin: "40px auto" }}>
          <h1>{authMode === "login" ? "Sign in" : "Create your account"}</h1>
          <p className="sub">
            {authMode === "login"
              ? "Team mode is on — sign in to your workspace."
              : "Start a new team workspace, or join one with an invite code."}
          </p>
          {authMode === "register" && (
            <>
              <label>Your name</label>
              <input value={authForm.name} onChange={(e) => setAuthForm({ ...authForm, name: e.target.value })} placeholder="e.g. Luke Jian" />
            </>
          )}
          <label>Email</label>
          <input type="email" value={authForm.email} onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })} placeholder="you@company.com" />
          <label>Password</label>
          <input type="password" value={authForm.password} onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })} placeholder={authMode === "register" ? "8+ characters" : ""} />
          {authMode === "register" && (
            <div className="row">
              <div>
                <label>New workspace name</label>
                <input value={authForm.workspaceName} onChange={(e) => setAuthForm({ ...authForm, workspaceName: e.target.value, inviteCode: "" })} placeholder="e.g. Northeast pod" />
              </div>
              <div>
                <label>…or invite code</label>
                <input value={authForm.inviteCode} onChange={(e) => setAuthForm({ ...authForm, inviteCode: e.target.value, workspaceName: "" })} placeholder="from your admin" />
              </div>
            </div>
          )}
          <button className="btn" onClick={submitAuth}>
            {authMode === "login" ? "Sign in →" : "Create account →"}
          </button>{" "}
          <button className="btn ghost" onClick={() => { setAuthMode(authMode === "login" ? "register" : "login"); setError(null); }}>
            {authMode === "login" ? "New here? Register" : "Have an account? Sign in"}
          </button>
          {error && <div className="err">{error}</div>}
        </section>
      )}

      {screen === "profile" && me?.mode === "multi" && (
        <section className="card">
          <h2>👥 {workspace.workspace?.name || "Your workspace"}</h2>
          <p className="sub" style={{ marginBottom: 10 }}>
            Team memory is shared: any member&apos;s logged meeting makes everyone&apos;s next brief on that account smarter.
            {workspace.workspace && (
              <> Invite teammates with code <b style={{ color: "var(--accent-bright)" }}>{workspace.workspace.invite_code}</b>.</>
            )}
          </p>
          <div>
            {workspace.members.map((m) => (
              <span key={m.email} className="tag" title={m.email}>
                {m.name} · {m.role}{m.calendar_connected ? " · 📅" : ""}
              </span>
            ))}
          </div>
          {me.googleAvailable && (
            <div style={{ marginTop: 12 }}>
              {me.googleConnected ? (
                <span className="tag green">✓ Google Calendar connected</span>
              ) : (
                <a className="btn ghost small" href="/api/integrations/google/start" style={{ textDecoration: "none" }}>
                  Connect Google Calendar
                </a>
              )}
            </div>
          )}
        </section>
      )}

      {screen === "profile" && (
        <section className="card">
          <h1>Your rep profile</h1>
          <p className="sub">
            Tell SalesRx who you are and what you sell. Every prospect brief is personalized to
            your edge.
          </p>
          <div className="row">
            <div>
              <label>Industry</label>
              <input
                value={profile.industry}
                onChange={(e) => setProfile({ ...profile, industry: e.target.value })}
                placeholder="e.g. SaaS, Medical devices"
              />
            </div>
            <div>
              <label>Vertical / niche</label>
              <input
                value={profile.vertical}
                onChange={(e) => setProfile({ ...profile, vertical: e.target.value })}
                placeholder="e.g. Supply-chain visibility"
              />
            </div>
            <div>
              <label>Product type</label>
              <input
                value={profile.productType}
                onChange={(e) => setProfile({ ...profile, productType: e.target.value })}
                placeholder="e.g. Real-time tracking platform"
              />
            </div>
            <div>
              <label>Location / territory</label>
              <input
                value={profile.location}
                onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                placeholder="e.g. Northeast US"
              />
            </div>
          </div>
          <label>Main competitors (comma-separated)</label>
          <input
            value={profile.competitors}
            onChange={(e) => setProfile({ ...profile, competitors: e.target.value })}
            placeholder="e.g. project44, FourKites"
          />
          <label>Your differentiator / moat</label>
          <textarea
            rows={2}
            value={profile.moat}
            onChange={(e) => setProfile({ ...profile, moat: e.target.value })}
            placeholder="What do you win on?"
          />
          <button className="btn" onClick={generateTips} disabled={tipsLoading}>
            {tipsLoading ? "Coaching in progress…" : "Generate my coaching tips →"}
          </button>{" "}
          <button className="btn ghost" onClick={() => setScreen("search")}>
            Skip to prospect research →
          </button>
          {error && <div className="err">{error}</div>}
          {tips && (
            <div style={{ marginTop: 22 }}>
              <h2>💡 AI coaching for your positioning</h2>
              {tips.map((t, i) => (
                <div className="tip" key={i}>
                  <span className="ico">{t.icon}</span>
                  <span>{t.tip}</span>
                </div>
              ))}
              <button className="btn" onClick={() => setScreen("search")}>
                Continue to prospect research →
              </button>
            </div>
          )}
        </section>
      )}

      {screen === "search" && (
        <section className="card">
          <h1>Research a prospect</h1>
          <p className="sub">Enter what you know — SalesRx researches the rest, live.</p>
          <div className="row">
            <div>
              <label>Company name</label>
              <input
                value={prospect.name}
                onChange={(e) => setProspect({ ...prospect, name: e.target.value })}
                placeholder="e.g. Meridian Foods"
              />
            </div>
            <div>
              <label>Domain (optional)</label>
              <input
                value={prospect.domain}
                onChange={(e) => setProspect({ ...prospect, domain: e.target.value })}
                placeholder="meridianfoods.com"
              />
            </div>
            <div>
              <label>HQ / branch location (optional)</label>
              <input
                value={prospect.location}
                onChange={(e) => setProspect({ ...prospect, location: e.target.value })}
                placeholder="e.g. Boston, MA"
              />
            </div>
            <div>
              <label>Contact to build rapport with (optional)</label>
              <input
                value={prospect.contact}
                onChange={(e) => setProspect({ ...prospect, contact: e.target.value })}
                placeholder="e.g. Dana Whitfield"
              />
            </div>
          </div>
          <button
            className="btn"
            onClick={() => research()}
            disabled={!prospect.name && !prospect.domain}
          >
            🔎 Research prospect
          </button>{" "}
          <button className="btn ghost" onClick={() => setScreen("profile")}>
            ← Edit profile
          </button>
          {usage && (
            <div style={{ marginTop: 16, fontSize: 12, color: "var(--muted)" }}>
              Fresh briefs this month: {usage.used.briefs}/{usage.limits.briefs}
              {usage.used.briefs >= usage.limits.briefs * 0.8 && (
                <span style={{ color: "var(--warn)" }}> · approaching limit</span>
              )}{" "}
              · est. AI spend ${usage.estCostUsd.toFixed(2)} of ${usage.budgetUsd.toFixed(2)} budget
              · cached re-runs are free
            </div>
          )}
          {error && <div className="err">{error}</div>}
        </section>
      )}

      {screen === "search" && calMeetings && calMeetings.length > 0 && (
        <section className="card">
          <h2>📅 Upcoming meetings (next 7 days)</h2>
          {calMeetings.map((m, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "9px 0",
                borderBottom: "1px solid var(--border)",
                fontSize: 13.5,
                flexWrap: "wrap",
              }}
            >
              <b>{m.title}</b>
              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                {new Date(m.start).toLocaleString()}
              </span>
              {m.domains.map((d) => (
                <span key={d} className="tag blue">
                  {d}
                </span>
              ))}
              <button
                className="btn small"
                style={{ marginLeft: "auto" }}
                onClick={() => {
                  const p = {
                    name: m.domains[0].split(".")[0],
                    domain: m.domains[0],
                    location: "",
                    contact: "",
                  };
                  setProspect(p);
                  research(p);
                }}
              >
                Prep brief →
              </button>
            </div>
          ))}
        </section>
      )}

      {screen === "search" && (
        <section className="card">
          <h2>
            🔔 Watchlist
            <button
              className="btn ghost small"
              style={{ marginLeft: "auto" }}
              onClick={() => refreshWatchlist()}
              disabled={refreshing || watchlist.length === 0}
            >
              {refreshing ? "Checking for new signals…" : "Check for new signals"}
            </button>
          </h2>
          {watchlist.length === 0 && (
            <p className="sub" style={{ marginBottom: 0 }}>
              Empty — research a prospect and hit “Add to watchlist” on the brief. New signals
              (funding, exec changes, hiring waves) show up here.
            </p>
          )}
          {watchlist.map((w) => (
            <div key={w.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
                <b>{w.name}</b>
                {w.domain && <span className="tag">{w.domain}</span>}
                {w.alerts.length > 0 && (
                  <span className="tag amber">{w.alerts.length} alert{w.alerts.length > 1 ? "s" : ""}</span>
                )}
                <span style={{ marginLeft: "auto", fontSize: 11, color: "var(--muted)" }}>
                  {w.lastCheckedAt
                    ? `checked ${new Date(w.lastCheckedAt).toLocaleDateString()}`
                    : "never checked"}
                </span>
                <button
                  className="btn ghost small"
                  onClick={() => removeFromWatchlist(w.id)}
                  title="Remove"
                >
                  ✕
                </button>
              </div>
              {w.alerts.slice(0, 3).map((a, i) => (
                <div key={i} className={`sig ${a.kind}`} style={{ marginTop: 8 }}>
                  <span className="when">{a.when}</span>
                  <br />
                  <b>{a.headline}</b> — {a.detail}{" "}
                  {a.sourceUrl && (
                    <a href={a.sourceUrl} target="_blank" rel="noreferrer">
                      source ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

      {screen === "loading" && (
        <section className="card">
          <h1>Researching {prospect.name || prospect.domain}…</h1>
          <p className="sub">
            Live web research in progress — typically 30–90 seconds.
          </p>
          <ul className="loader">
            {LOAD_STEPS.map((s, i) => (
              <li key={s} className={i <= loadStep ? "on" : ""}>
                {i < loadStep ? (
                  <span style={{ color: "var(--accent)", fontWeight: 700 }}>✓</span>
                ) : (
                  <span className="spin" />
                )}{" "}
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      {screen === "brief" && brief && (
        <>
          <section className="card">
            <div className="brief-head">
              <div>
                <h1>{brief.company}</h1>
                <p className="sub" style={{ marginBottom: 8 }}>
                  {brief.meta}
                </p>
                <div>
                  {brief.tags.map((t, i) => (
                    <span key={i} className={`tag ${i === 0 ? "green" : i === 1 ? "blue" : "amber"}`}>
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div className="score">
                <b>{brief.fitScore}</b>
                <span>Fit score</span>
                {brief.fitBreakdown?.map((f) => (
                  <div className="fitbar" key={f.label}>
                    {f.label} · {f.score}/{f.max}
                    <div className="bar">
                      <div className="fill" style={{ width: `${(f.score / f.max) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <p style={{ fontSize: 13.5, color: "var(--muted)", marginTop: 8 }}>{brief.summary}</p>
          </section>

          <section className="card">
            <h2>📡 Buying signals & recent changes</h2>
            {brief.signals.map((s, i) => (
              <div key={i} className={`sig ${s.kind}`}>
                <span className="when">{s.when}</span>
                <br />
                <b>{s.headline}</b> — {s.detail}{" "}
                {s.sourceUrl && (
                  <a href={s.sourceUrl} target="_blank" rel="noreferrer">
                    source ↗
                  </a>
                )}
              </div>
            ))}
          </section>

          <div className="grid2">
            <section className="card">
              <h2>🧰 Current stack & incumbent</h2>
              <div>
                {brief.stack.map((s) => (
                  <span key={s} className="tag">
                    {s}
                  </span>
                ))}
              </div>
              <p style={{ fontSize: 13, color: "var(--muted)", marginTop: 10 }}>{brief.stackNote}</p>
            </section>
            <section className="card">
              <h2>⚠️ Likely challenges</h2>
              {brief.challenges.map((c, i) => (
                <div className="tip" key={i}>
                  <span className="ico">•</span>
                  <span>{c}</span>
                </div>
              ))}
            </section>
          </div>

          <section className="card">
            <h2>🧠 Pain points → NEPQ question ladders</h2>
            <p className="sub" style={{ marginBottom: 14 }}>
              Ask in order, calm and curious — let the prospect state the pain and its cost in
              their own words. Pause after consequence questions.
            </p>
            {brief.painPoints.map((p, i) => (
              <div className="nepq-pain" key={i}>
                <div className="pain-title">
                  🔥 Pain {i + 1}: {p.pain}
                  <span className={`conf ${p.confidence}`}>{p.confidence} confidence</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 10 }}>
                  Evidence: {p.evidence}
                </div>
                {p.ladder.map((s, j) => (
                  <div className="nepq-q" key={j}>
                    <div className="nepq-stage">{s.stage}</div>
                    <div>“{s.question}”</div>
                  </div>
                ))}
              </div>
            ))}
          </section>

          <section className="card">
            <h2>🗺️ Decision map</h2>
            {brief.people.map((p, i) => (
              <div className="person" key={i}>
                <div className="avatar">{initials(p.name)}</div>
                <div>
                  <b>{p.name}</b>
                  <span className={`role-chip ${p.role}`}>{ROLE_LABEL[p.role] || p.role}</span>
                  <div className="role">{p.title}</div>
                  <div className="note">{p.note}</div>
                </div>
              </div>
            ))}
          </section>

          {brief.rapport?.length > 0 && (
            <section className="card">
              <h2>🤝 Rapport dossier</h2>
              {brief.rapport.map((r, i) => (
                <div className="tip" key={i}>
                  <span className="ico">{r.icon}</span>
                  <span>
                    <b>{r.label}:</b> {r.detail}
                  </span>
                </div>
              ))}
            </section>
          )}

          <div className="grid2">
            <section className="card">
              <h2>🛡️ Objection forecast</h2>
              {brief.objections.map((o, i) => (
                <div className="qa" key={i}>
                  <div className="q">“{o.objection}”</div>
                  <div className="a">
                    <b>Response:</b> {o.response}
                  </div>
                </div>
              ))}
            </section>
            <section className="card">
              <h2>❓ Discovery questions</h2>
              <ol className="disc">
                {brief.discoveryQuestions.map((q, i) => (
                  <li key={i}>{q}</li>
                ))}
              </ol>
            </section>
          </div>

          <section className="card">
            <h2>🏆 Win story angle</h2>
            <p style={{ fontSize: 13.5 }}>{brief.winStoryHint}</p>
          </section>

          {brief.sources?.length > 0 && (
            <section className="card">
              <h2>🔗 Sources</h2>
              <ol className="disc">
                {brief.sources.map((s, i) => (
                  <li key={i}>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "var(--accent2)" }}
                    >
                      {s.title}
                    </a>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section className="card">
            <h2>📞 NEPQ call script</h2>
            <p className="sub">
              A word-for-word script built from this brief&apos;s real pain points — opener,
              question ladders, objection reframes, and the close. Coach notes teach new reps
              the NEPQ delivery as they go.
            </p>
            <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={scriptType}
                onChange={(e) => setScriptType(e.target.value as MeetingType)}
                style={{ maxWidth: 220 }}
              >
                <option value="cold-call">Cold call</option>
                <option value="discovery">Discovery meeting</option>
                <option value="follow-up">Follow-up meeting</option>
              </select>
              <button className="btn small" onClick={generateScript} disabled={scriptLoading}>
                {scriptLoading ? "Writing script…" : "Generate script"}
              </button>
              {script && (
                <button
                  className="btn ghost small"
                  onClick={() => navigator.clipboard.writeText(scriptToText(script))}
                >
                  📋 Copy full script
                </button>
              )}
            </div>
            {script && (
              <div style={{ marginTop: 16 }}>
                <p className="sub" style={{ marginBottom: 10 }}>
                  {script.durationHint} · prospect should do ~70% of the talking — the script is
                  questions and silence, not a pitch.
                </p>
                {script.sections.map((sec, i) => (
                  <div className="nepq-pain" key={i}>
                    <div className="pain-title">
                      {i + 1} · {sec.name}
                      <span style={{ fontWeight: 400, fontSize: 12, color: "var(--muted)", marginLeft: 8 }}>
                        {sec.goal}
                      </span>
                    </div>
                    {sec.lines.map((l, j) =>
                      l.speaker === "coach" ? (
                        <div
                          key={j}
                          style={{
                            fontSize: 12,
                            color: "var(--warn)",
                            margin: "6px 0 10px 12px",
                            borderLeft: "2px solid var(--warn)",
                            paddingLeft: 8,
                          }}
                        >
                          🎙 {l.text}
                        </div>
                      ) : (
                        <div key={j} className="nepq-q">
                          “{l.text}”
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card">
            <h2>📝 Log meeting notes</h2>
            <p className="sub">
              Paste raw notes or a voice-memo transcript after the meeting. SalesRx extracts
              outcomes and next steps, drafts your follow-up email, and remembers everything for
              the next brief on this account.
            </p>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Met with Dana and Marcus. Concerned about rollout time. Marcus wants ROI numbers by Friday. Dana hinted the renewal decision moved up to October…"
            />
            <button className="btn small" style={{ marginTop: 12 }} onClick={logMeeting} disabled={logging || !notes.trim()}>
              {logging ? "Analyzing…" : "Analyze & save"}
            </button>
            {meetingResult && (
              <div style={{ marginTop: 16 }}>
                <div className="grid2">
                  <div>
                    <h2>✅ Outcomes</h2>
                    {meetingResult.outcomes.map((o, i) => (
                      <div className="tip" key={i}>
                        <span className="ico">•</span>
                        <span>{o}</span>
                      </div>
                    ))}
                  </div>
                  <div>
                    <h2>➡️ Next steps</h2>
                    {meetingResult.nextSteps.map((s, i) => (
                      <div className="tip" key={i}>
                        <span className="ico">•</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <h2 style={{ marginTop: 12 }}>✉️ Follow-up email draft</h2>
                <div
                  className="tip"
                  style={{ whiteSpace: "pre-wrap", display: "block" }}
                >
                  {meetingResult.followUpEmail}
                </div>
                <button
                  className="btn ghost small"
                  onClick={() => navigator.clipboard.writeText(meetingResult.followUpEmail)}
                >
                  📋 Copy email
                </button>{" "}
                <button
                  className="btn ghost small"
                  onClick={() =>
                    syncToCrm({
                      noteText: `Outcomes: ${meetingResult.outcomes.join("; ")}\nNext steps: ${meetingResult.nextSteps.join("; ")}`,
                    })
                  }
                >
                  ↗ Sync meeting to CRM
                </button>
              </div>
            )}
          </section>

          <section className="card">
            <button className="btn small" onClick={addToWatchlist} disabled={watchAdded}>
              {watchAdded ? "✓ On your watchlist" : "🔔 Add to watchlist"}
            </button>{" "}
            <button className="btn small ghost" onClick={() => syncToCrm({ brief })}>
              ↗ Sync brief to CRM
            </button>{" "}
            <button className="btn ghost small" onClick={() => setScreen("search")}>
              ← Research another prospect
            </button>
            {crmStatus && (
              <span style={{ marginLeft: 10, fontSize: 12.5, color: "var(--muted)" }}>
                {crmStatus}
              </span>
            )}
          </section>
          <p className="footer-note">
            AI-researched from public sources — verify figures before quoting them in a meeting.
          </p>
        </>
      )}
    </div>
  );
}

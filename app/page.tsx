"use client";

import { useEffect, useRef, useState } from "react";
import type { Brief, CoachingTip, ProspectInput, RepProfile } from "@/lib/types";

type Screen = "profile" | "search" | "loading" | "brief";

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

  useEffect(() => {
    // load saved profile
    const saved = typeof window !== "undefined" && localStorage.getItem("salesrx.profile");
    if (saved) {
      try {
        setProfile(JSON.parse(saved));
      } catch {}
    }
  }, []);

  useEffect(() => {
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

  const step = screen === "profile" ? 1 : screen === "brief" ? 3 : 2;

  async function generateTips() {
    localStorage.setItem("salesrx.profile", JSON.stringify(profile));
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

  async function research() {
    setError(null);
    setScreen("loading");
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile, prospect }),
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
          Sales<span>Rx</span>
          <small>walk in prepared</small>
        </div>
        <div className="stepper">
          {[1, 2, 3].map((n) => (
            <div key={n} className={`dot ${n === step ? "active" : n < step ? "done" : ""}`}>
              {n}
            </div>
          ))}
        </div>
      </header>

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
            onClick={research}
            disabled={!prospect.name && !prospect.domain}
          >
            🔎 Research prospect
          </button>{" "}
          <button className="btn ghost" onClick={() => setScreen("profile")}>
            ← Edit profile
          </button>
          {error && <div className="err">{error}</div>}
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
            <button className="btn ghost small" onClick={() => setScreen("search")}>
              ← Research another prospect
            </button>
          </section>
          <p className="footer-note">
            AI-researched from public sources — verify figures before quoting them in a meeting.
          </p>
        </>
      )}
    </div>
  );
}

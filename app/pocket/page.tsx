"use client";

/**
 * v2.6 — the pocket brief. Renders the last generated brief from localStorage,
 * so it opens instantly (and after install as a PWA, works in a parking lot
 * with one bar of signal). Compact, thumb-scrollable, no chrome.
 */
import { useEffect, useState } from "react";
import type { Brief } from "@/lib/types";

export default function Pocket() {
  const [brief, setBrief] = useState<Brief | null>(null);
  useEffect(() => {
    try {
      const raw = localStorage.getItem("salesrx.lastBrief");
      if (raw) setBrief(JSON.parse(raw));
    } catch {}
  }, []);

  if (!brief) {
    return (
      <div className="app" style={{ maxWidth: 480 }}>
        <h1 style={{ marginTop: 40 }}>Pocket brief</h1>
        <p className="sub">
          No brief cached on this device yet. Research a prospect in the main app first — the
          latest brief always lives here, ready for the parking lot.
        </p>
        <a className="btn small" href="/" style={{ textDecoration: "none" }}>Open SalesRx →</a>
      </div>
    );
  }

  return (
    <div className="app" style={{ maxWidth: 480, paddingBottom: 40 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1 style={{ fontSize: 19 }}>{brief.company}</h1>
        <span style={{ fontSize: 22, fontWeight: 800, color: "var(--win)" }}>{brief.fitScore}</span>
      </div>
      <p className="sub" style={{ marginBottom: 12 }}>{brief.summary}</p>

      <h2 style={{ fontSize: 13 }}>📡 Signals</h2>
      {brief.signals.slice(0, 4).map((s, i) => (
        <div key={i} className={`sig ${s.kind}`} style={{ fontSize: 12.5 }}>
          <b>{s.headline}</b> — {s.detail}
        </div>
      ))}

      <h2 style={{ fontSize: 13, marginTop: 14 }}>🧠 Ask these</h2>
      {brief.painPoints.map((p, i) => (
        <div key={i} className="nepq-pain" style={{ padding: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6 }}>{p.pain}</div>
          {p.ladder.map((l, j) => (
            <div key={j} style={{ fontSize: 12, marginBottom: 5 }}>
              <span className="nepq-stage" style={{ fontSize: 9 }}>{l.stage}</span>
              <div>“{l.question}”</div>
            </div>
          ))}
        </div>
      ))}

      <h2 style={{ fontSize: 13, marginTop: 14 }}>🛡️ If they push back</h2>
      {brief.objections.map((o, i) => (
        <div key={i} className="qa" style={{ fontSize: 12.5 }}>
          <div className="q">“{o.objection}”</div>
          <div className="a">{o.response}</div>
        </div>
      ))}

      <h2 style={{ fontSize: 13, marginTop: 14 }}>🗺️ People</h2>
      {brief.people.map((p, i) => (
        <div key={i} style={{ fontSize: 12.5, marginBottom: 6 }}>
          <b>{p.name}</b> · {p.title} — <span style={{ color: "var(--muted)" }}>{p.note}</span>
        </div>
      ))}

      <a className="btn ghost small" href="/" style={{ textDecoration: "none", marginTop: 16, display: "inline-block" }}>
        ← Full app
      </a>
    </div>
  );
}

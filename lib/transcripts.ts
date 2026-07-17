/**
 * v2.1 — earnings-call transcripts via API Ninjas (key-optional: API_NINJAS_KEY).
 * The NEPQ goldmine: executives stating pains in their own words. Public
 * companies only; we extract the excerpts most relevant to the rep's vertical.
 */
import { cacheGet, cacheSet } from "./cache";

export interface TranscriptExcerpt {
  ticker: string;
  quarter: string;
  excerpt: string;
}

export function transcriptsConfigured(): boolean {
  return !!process.env.API_NINJAS_KEY;
}

function currentQuarters(): { year: number; quarter: number }[] {
  const now = new Date();
  const list: { year: number; quarter: number }[] = [];
  let y = now.getFullYear();
  let q = Math.floor(now.getMonth() / 3) + 1;
  for (let i = 0; i < 4; i++) {
    list.push({ year: y, quarter: q });
    q--;
    if (q === 0) { q = 4; y--; }
  }
  return list;
}

/** Pull the windows of the transcript most relevant to the rep's world. */
function relevantExcerpts(transcript: string, keywords: string[], budget = 2400): string {
  const kws = keywords.map((k) => k.toLowerCase()).filter((k) => k.length > 3);
  const windows: string[] = [];
  const lower = transcript.toLowerCase();
  for (const kw of kws) {
    const idx = lower.indexOf(kw);
    if (idx >= 0) {
      windows.push(transcript.slice(Math.max(0, idx - 250), idx + 450));
    }
    if (windows.join("").length > budget * 0.7) break;
  }
  const intro = transcript.slice(0, windows.length ? 600 : 1800);
  return [intro, ...windows].join("\n[…]\n").slice(0, budget);
}

export async function latestTranscriptExcerpt(
  ticker: string,
  keywords: string[]
): Promise<TranscriptExcerpt | null> {
  if (!transcriptsConfigured()) return null;
  const cacheKey = `transcript:${ticker}`;
  const cached = await cacheGet<{ quarter: string; transcript: string }>(cacheKey);
  if (cached) {
    return { ticker, quarter: cached.quarter, excerpt: relevantExcerpts(cached.transcript, keywords) };
  }

  for (const { year, quarter } of currentQuarters()) {
    try {
      const res = await fetch(
        `https://api.api-ninjas.com/v1/earningstranscript?ticker=${encodeURIComponent(ticker)}&year=${year}&quarter=${quarter}`,
        {
          headers: { "X-Api-Key": process.env.API_NINJAS_KEY! },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      const transcript: string | undefined = data?.transcript;
      if (!transcript || transcript.length < 200) continue;
      const label = `Q${quarter} ${year}`;
      await cacheSet(cacheKey, { quarter: label, transcript: transcript.slice(0, 60000) });
      return { ticker, quarter: label, excerpt: relevantExcerpts(transcript, keywords) };
    } catch (e) {
      console.warn(`transcript fetch failed ${ticker} Q${quarter} ${year}:`, e);
    }
  }
  return null;
}

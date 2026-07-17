/**
 * v2.1 — SEC EDGAR (free, no API key; SEC requires a descriptive User-Agent).
 * Full-text search over filings; 8-K exhibits routinely contain earnings press
 * releases, so this doubles as a primary press-release source for public cos.
 */
import { cacheGet, cacheSet } from "./cache";

export interface Filing {
  form: string;
  date: string;
  company: string;
  ticker?: string;
  cik?: string;
  url: string;
  snippet?: string;
}

function ua(): string {
  return process.env.SALESRX_EDGAR_UA || "SalesRx-research/2.1 (set SALESRX_EDGAR_UA to your contact email)";
}

/** Parse "Apple Inc.  (AAPL)  (CIK 0000320193)" display names. */
function parseDisplayName(dn: string): { company: string; ticker?: string; cik?: string } {
  const cik = dn.match(/CIK\s*(\d+)/i)?.[1];
  const ticker = dn.match(/\(([A-Z.]{1,6})\)\s*\(CIK/i)?.[1];
  const company = dn.split("(")[0].trim();
  return { company, ticker, cik };
}

export async function edgarFilings(companyName: string, maxResults = 6): Promise<Filing[]> {
  const cacheKey = `edgar:${companyName}`;
  const cached = await cacheGet<Filing[]>(cacheKey);
  if (cached) return cached;

  try {
    const q = new URLSearchParams({
      q: `"${companyName}"`,
      forms: "8-K,10-K,10-Q",
    });
    const res = await fetch(`https://efts.sec.gov/LATEST/search-index?${q}`, {
      headers: { "User-Agent": ua(), Accept: "application/json" },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const hits: Filing[] = [];
    for (const h of data?.hits?.hits || []) {
      const s = h._source || {};
      const dn = (s.display_names || [])[0] || "";
      const { company, ticker, cik } = parseDisplayName(dn);
      // only filings actually from this company (FTS matches mentions too)
      if (!company.toLowerCase().includes(companyName.toLowerCase().split(" ")[0])) continue;
      const adsh: string = s.adsh || "";
      const accession = adsh.replace(/-/g, "");
      hits.push({
        form: s.form_type || s.root_forms?.[0] || s.file_type || "filing",
        date: s.file_date || "",
        company, ticker, cik,
        url: cik && accession
          ? `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession}`
          : `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(companyName)}`,
      });
      if (hits.length >= maxResults) break;
    }
    await cacheSet(cacheKey, hits);
    return hits;
  } catch (e) {
    console.warn("EDGAR fetch failed:", e);
    return [];
  }
}

/** Best-effort ticker resolution from EDGAR results (for transcript lookups). */
export function tickerFrom(filings: Filing[]): string | undefined {
  return filings.find((f) => f.ticker)?.ticker;
}

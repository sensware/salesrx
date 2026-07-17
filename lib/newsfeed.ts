/**
 * v2.1 — press coverage via Google News RSS (free, no key). Catches PR-wire
 * distribution (PRNewswire / BusinessWire / GlobeNewswire) and trade press for
 * private companies where EDGAR has nothing.
 */
import { cacheGet, cacheSet } from "./cache";

export interface PressItem {
  title: string;
  url: string;
  date: string;
  source: string;
  isPressRelease: boolean;
}

const PR_WIRES = /pr\s*newswire|business\s*wire|globe\s*newswire|accesswire|newsfile/i;

function decode(s: string): string {
  return s
    .replace(/<!\[CDATA\[(.*?)\]\]>/gs, "$1")
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .trim();
}

function tag(block: string, name: string): string {
  return decode(block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, "i"))?.[1] || "");
}

export async function pressItems(companyName: string, maxItems = 8): Promise<PressItem[]> {
  const cacheKey = `news:${companyName}`;
  const cached = await cacheGet<PressItem[]>(cacheKey);
  if (cached) return cached;

  try {
    const q = encodeURIComponent(`"${companyName}"`);
    const res = await fetch(
      `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (SalesRx research)" },
        signal: AbortSignal.timeout(15000),
      }
    );
    if (!res.ok) return [];
    const xml = await res.text();
    const cutoff = Date.now() - 120 * 86400000; // ~4 months
    const items: PressItem[] = [];
    for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
      const block = m[1];
      const title = tag(block, "title");
      const link = tag(block, "link");
      const pub = tag(block, "pubDate");
      const source = tag(block, "source");
      if (!title || !link) continue;
      const t = Date.parse(pub);
      if (isFinite(t) && t < cutoff) continue;
      items.push({
        title,
        url: link,
        date: isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "",
        source: source || "news",
        isPressRelease: PR_WIRES.test(source) || PR_WIRES.test(title),
      });
      if (items.length >= maxItems) break;
    }
    await cacheSet(cacheKey, items);
    return items;
  } catch (e) {
    console.warn("News RSS fetch failed:", e);
    return [];
  }
}

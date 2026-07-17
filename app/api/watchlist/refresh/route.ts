import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { deltaSystemPrompt } from "@/lib/prompts";
import {
  loadWatchlist,
  saveWatchlist,
  normalizeHeadline,
  type WatchAlert,
} from "@/lib/watchlist";

export const maxDuration = 300;

/**
 * Re-checks watched companies for NEW signals since the last check.
 * POST body (optional): { "id": "<watch item id>" } — refresh one item; omit to refresh all.
 * For nightly automation, hit this endpoint from a cron job (e.g. Vercel Cron or crontab).
 */
export async function POST(req: NextRequest) {
  let onlyId: string | undefined;
  try {
    onlyId = (await req.json())?.id;
  } catch {
    // empty body = refresh all
  }

  const items = loadWatchlist();
  const targets = onlyId ? items.filter((i) => i.id === onlyId) : items;
  if (targets.length === 0) {
    return NextResponse.json({ watchlist: items, newAlerts: 0 });
  }

  const anthropic = client();
  let newAlerts = 0;

  for (const item of targets) {
    try {
      const since = item.lastCheckedAt || item.addedAt;
      const msg = await anthropic.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: deltaSystemPrompt(),
        messages: [
          {
            role: "user",
            content: `Company: ${item.name}${item.domain ? ` (${item.domain})` : ""}
Look for signals newer than: ${since}
Already-known signals (do NOT repeat): ${item.knownSignals.join("; ") || "none"}`,
          },
        ],
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 3 }],
      });

      const found = extractJson<Omit<WatchAlert, "foundAt">[]>(textOf(msg));
      const fresh = found.filter(
        (a) => !item.knownSignals.includes(normalizeHeadline(a.headline))
      );
      for (const a of fresh) {
        item.alerts.unshift({ ...a, foundAt: new Date().toISOString() });
        item.knownSignals.push(normalizeHeadline(a.headline));
        newAlerts++;
      }
      item.alerts = item.alerts.slice(0, 20); // keep it bounded
      item.lastCheckedAt = new Date().toISOString();
    } catch (e) {
      console.warn(`watchlist refresh failed for ${item.name}:`, e);
    }
  }

  saveWatchlist(items);
  return NextResponse.json({ watchlist: items, newAlerts });
}

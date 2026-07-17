import { NextRequest, NextResponse } from "next/server";
import { client, MODEL, extractJson, textOf } from "@/lib/anthropic";
import { deltaSystemPrompt } from "@/lib/prompts";
import { getCtx } from "@/lib/auth";
import {
  loadWatchlist, saveWatchlist, normalizeHeadline, watchlistWorkspaceIds,
  type WatchAlert, type WatchItem,
} from "@/lib/watchlist";

export const maxDuration = 300;

async function refreshItems(items: WatchItem[], onlyId?: string): Promise<number> {
  const targets = onlyId ? items.filter((i) => i.id === onlyId) : items;
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
      item.alerts = item.alerts.slice(0, 20);
      item.lastCheckedAt = new Date().toISOString();
    } catch (e) {
      console.warn(`watchlist refresh failed for ${item.name}:`, e);
    }
  }
  return newAlerts;
}

/**
 * Re-checks watched companies for NEW signals.
 * Signed-in call: refreshes the caller's workspace (optional {id} for one item).
 * Unauthenticated cron call: refreshes ALL workspaces (nightly job).
 */
export async function POST(req: NextRequest) {
  let onlyId: string | undefined;
  try {
    onlyId = (await req.json())?.id;
  } catch {
    /* empty body = refresh all */
  }

  const ctx = await getCtx(req);
  if (ctx) {
    const items = await loadWatchlist(ctx.workspaceId);
    const newAlerts = await refreshItems(items, onlyId);
    await saveWatchlist(items, ctx.workspaceId);
    return NextResponse.json({ watchlist: items, newAlerts });
  }

  // cron mode — no session: sweep every workspace
  let total = 0;
  for (const wsId of await watchlistWorkspaceIds()) {
    const items = await loadWatchlist(wsId);
    total += await refreshItems(items);
    await saveWatchlist(items, wsId);
  }
  return NextResponse.json({ newAlerts: total, cron: true });
}

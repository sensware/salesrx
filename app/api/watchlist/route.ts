import { NextRequest, NextResponse } from "next/server";
import {
  loadWatchlist,
  saveWatchlist,
  makeId,
  normalizeHeadline,
  type WatchItem,
} from "@/lib/watchlist";

export async function GET() {
  return NextResponse.json({ watchlist: loadWatchlist() });
}

export async function POST(req: NextRequest) {
  let body: { name: string; domain?: string; knownSignals?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!body?.name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const items = loadWatchlist();
  const id = makeId(body.name, body.domain);
  if (items.some((i) => i.id === id)) {
    return NextResponse.json({ watchlist: items, added: false });
  }
  const item: WatchItem = {
    id,
    name: body.name,
    domain: body.domain,
    addedAt: new Date().toISOString(),
    knownSignals: (body.knownSignals || []).map(normalizeHeadline),
    alerts: [],
  };
  items.push(item);
  saveWatchlist(items);
  return NextResponse.json({ watchlist: items, added: true });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
  const items = loadWatchlist().filter((i) => i.id !== id);
  saveWatchlist(items);
  return NextResponse.json({ watchlist: items });
}

import { NextResponse, type NextRequest } from "next/server";

import { fetchCryptoNews } from "@/lib/cryptocompare";
import type { NewsItem } from "@/lib/mock/news";

/**
 * GET /api/news?limit=N
 *
 * Polled by the Coin Market client every ~30s so the Crypto News tab refreshes
 * without a full page reload.
 *
 * Stale-while-revalidate: the last good batch is answered immediately and,
 * once it's older than the freshness window, a single background refresh
 * runs behind the response. Only a cold server (nothing cached yet) waits
 * on CryptoCompare / the RSS fallbacks — and that wait is bounded by the
 * fetchers' own 5 s deadlines.
 */
export const dynamic = "force-dynamic";

/** Freshness window (seconds). Synced with the client poll interval. */
const FRESH_SEC = 30;

let cache: { news: NewsItem[]; at: number } | null = null;
let inflight: Promise<void> | null = null;

function refresh(limit: number): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const news = await fetchCryptoNews(limit, FRESH_SEC);
    // Never replace a good batch with an empty one (every source failed).
    if (news.length > 0) cache = { news, at: Date.now() };
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

function readCache() {
  return cache;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") ?? "24", 10) || 24));

  const cached = readCache();
  if (cached && cached.news.length >= Math.min(limit, cached.news.length)) {
    const stale = Date.now() - cached.at > FRESH_SEC * 1000;
    if (stale) void refresh(Math.max(limit, 24));
    const res = NextResponse.json({ news: cached.news.slice(0, limit), stale, fetchedAt: cached.at });
    res.headers.set("Cache-Control", "no-store, must-revalidate");
    return res;
  }

  await refresh(Math.max(limit, 24));
  const filled = readCache();
  const res = NextResponse.json({
    news: filled?.news.slice(0, limit) ?? [],
    stale: false,
    fetchedAt: filled?.at ?? Date.now(),
  });
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

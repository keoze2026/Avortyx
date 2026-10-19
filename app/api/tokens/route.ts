import { NextResponse, type NextRequest } from "next/server";

import { fetchTopTokens, type TokensResult } from "@/lib/coingecko";

/**
 * GET /api/tokens?page=N&perPage=M
 *
 * Polled by the Coin Market client every few seconds for block 1, and called
 * on demand when the user paginates past tokens we haven't fetched yet. The
 * inner CoinGecko fetch uses a short `revalidate` keyed on URL+page, so each
 * (page, perPage) combo costs at most one upstream call per window regardless
 * of visitor count — keeping us under CoinGecko's free-tier rate limit while
 * still feeling live in the UI.
 */
export const dynamic = "force-dynamic";

/** Upstream cache window (seconds). Short = fresher numbers in the UI. */
const UPSTREAM_REVALIDATE_SEC = 8;

/**
 * Answer from the last good batch straight away; refresh behind it when it is
 * older than the window. Only a cold server (nothing cached yet) waits on
 * CoinGecko, and `instrumentation.ts` warms exactly that on startup. Before
 * this, every request that landed just after the cache window waited for the
 * upstream (up to its 5 s deadline) with a spinner on screen.
 */
const store = new Map<string, { result: TokensResult; at: number }>();
const inflight = new Map<string, Promise<void>>();
/** Keep a batch this long at most; older than this is dropped, not served. */
const MAX_AGE_MS = 10 * 60 * 1000;

function refresh(key: string, perPage: number, page: number): Promise<void> {
  const running = inflight.get(key);
  if (running) return running;
  const job = (async () => {
    const result = await fetchTopTokens(perPage, UPSTREAM_REVALIDATE_SEC, page);
    // Never replace a good batch with an empty one (upstream failed).
    if (result.tokens.length > 0) store.set(key, { result, at: Date.now() });
  })().finally(() => {
    inflight.delete(key);
  });
  inflight.set(key, job);
  return job;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.max(
    1,
    Math.min(250, parseInt(searchParams.get("perPage") ?? "250", 10) || 250),
  );
  const key = `${page}:${perPage}`;

  let hit = store.get(key);
  if (hit && Date.now() - hit.at > MAX_AGE_MS) {
    store.delete(key);
    hit = undefined;
  }

  if (hit) {
    if (Date.now() - hit.at > UPSTREAM_REVALIDATE_SEC * 1000) void refresh(key, perPage, page);
  } else {
    await refresh(key, perPage, page);
    hit = store.get(key);
  }

  const res = NextResponse.json(hit?.result ?? { tokens: [], source: "fallback" });
  // Tell intermediaries (browser, CDN) not to cache; the cache that matters is the one above.
  res.headers.set("Cache-Control", "no-store, must-revalidate");
  return res;
}

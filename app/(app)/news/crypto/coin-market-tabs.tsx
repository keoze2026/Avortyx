"use client";

import * as React from "react";
import { Coins, Newspaper, RefreshCw } from "lucide-react";

import { MarketStatsRow } from "@/components/coinmarket/market-stats-row";
import { TokensTable } from "@/components/coinmarket/tokens-table";
import { NewsFeed } from "@/components/news/news-feed";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/shared/page-header";
import { useTranslation } from "@/hooks/use-translation";
import type { NewsCategory, NewsItem } from "@/lib/mock/news";
import type { TokenEntry } from "@/lib/mock/tokens";
import { cn } from "@/lib/utils";

type TabId = "tokens" | "news";

const TABS: Array<{
  id: TabId;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "tokens", labelKey: "toolsUI.news.coinMarket.tabs.tokens", icon: Coins },
  { id: "news", labelKey: "toolsUI.news.coinMarket.tabs.cryptoNews", icon: Newspaper },
];

export function CoinMarketHeader() {
  const { t } = useTranslation();
  return (
    <PageHeader
      title={t("toolsUI.news.coinMarket.title")}
      description={t("toolsUI.news.coinMarket.description")}
    />
  );
}

const CRYPTO_CATEGORIES: NewsCategory[] = [
  "Bitcoin",
  "Ethereum",
  "DeFi",
  "NFT",
  "Layer 2",
  "Regulation",
  "Markets",
];

/**
 * How often to poll /api/tokens for the visible block (ms).
 * Synced with the upstream cache window in app/api/tokens/route.ts so polls
 * arrive right after the cache refreshes — every poll is guaranteed-fresh.
 */
const POLL_INTERVAL_MS = 8_000;
/** How often to poll /api/news (ms). Matches the upstream news cache window. */
const NEWS_POLL_INTERVAL_MS = 30_000;
/** Each CoinGecko fetch returns this many tokens. */
const BLOCK_SIZE = 250;
/** Rough upper bound — used while we haven't hit the end of CoinGecko's list. */
const ESTIMATED_MAX_TOKENS = 15_000;
/** How many news items to keep in memory. */
const NEWS_LIMIT = 24;

/** Last good tape + headlines, per browser, so a return visit paints at once. */
const SNAPSHOT_KEY = "avortyx.news.crypto";

interface Snapshot {
  tokens: TokenEntry[];
  news: NewsItem[];
  at: number;
}

function readSnapshot(): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    return Array.isArray(parsed.tokens) && Array.isArray(parsed.news) ? parsed : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snap: Snapshot) {
  try {
    // Only the first block of the tape is worth keeping (what is on screen).
    window.localStorage.setItem(
      SNAPSHOT_KEY,
      JSON.stringify({ ...snap, tokens: snap.tokens.slice(0, BLOCK_SIZE) }),
    );
  } catch {
    // Storage blocked: cold start next time, nothing else changes.
  }
}

interface Props {
  /** Optional server-rendered data; when omitted the component fetches on mount. */
  tokens?: TokenEntry[];
  news?: NewsItem[];
}

/** Client-side tab switcher. Fetches its own data (tokens + headlines) so
 *  the page shell never waits on CoinGecko / CryptoCompare. */
export function CoinMarketTabs({ tokens: initialTokens, news: initialNews }: Props) {
  const { t } = useTranslation();
  const [tab, setTab] = React.useState<TabId>("tokens");
  const [tokens, setTokens] = React.useState<TokenEntry[]>(initialTokens ?? []);
  const [news, setNews] = React.useState<NewsItem[]>(initialNews ?? []);
  const [loading, setLoading] = React.useState(false);
  // True until the first token block / headline batch is on screen.
  const [tokensPending, setTokensPending] = React.useState(!initialTokens?.length);
  const [newsPending, setNewsPending] = React.useState(!initialNews?.length);

  // Paint the last snapshot immediately; the fetches below then update it.
  React.useEffect(() => {
    if (initialTokens?.length || initialNews?.length) return;
    const snap = readSnapshot();
    if (!snap) return;
    if (snap.tokens.length > 0) {
      setTokens(snap.tokens);
      setTokensPending(false);
    }
    if (snap.news.length > 0) {
      setNews(snap.news);
      setNewsPending(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persist whatever is on screen so the next visit starts from it.
  React.useEffect(() => {
    if (tokens.length === 0 && news.length === 0) return;
    writeSnapshot({ tokens, news, at: Date.now() });
  }, [tokens, news]);
  // True until we hit a CoinGecko page that returns an empty array.
  const [hasMore, setHasMore] = React.useState(true);
  // Refresh status surfaced in the toolbar so the user can see freshness.
  const [refreshing, setRefreshing] = React.useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = React.useState<number>(Date.now());

  /**
   * Pull the latest block-1 snapshot and splice it into state. Held in a ref
   * so the interval / visibility handlers all share the same closure-stable
   * function without re-arming the effect on every render.
   */
  const refreshLatestRef = React.useRef<() => Promise<void>>(async () => {});
  React.useEffect(() => {
    refreshLatestRef.current = async () => {
      setRefreshing(true);
      try {
        const res = await fetch(
          `/api/tokens?page=1&perPage=${BLOCK_SIZE}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as {
          tokens: TokenEntry[];
          source: unknown;
        };
        const fresh = payload.tokens;
        // Only commit when we got real data. An empty array means the
        // upstream call failed — keep the last good snapshot in place so the
        // user continues to see real, recent values.
        if (!Array.isArray(fresh) || fresh.length === 0) return;
        setTokens((prev) => [...fresh, ...prev.slice(fresh.length)]);
        setLastUpdatedAt(Date.now());
      } catch {
        /* swallow — keep the last good snapshot on transient errors */
      } finally {
        setRefreshing(false);
        setTokensPending(false);
      }
    };
  }, []);

  const manualRefresh = React.useCallback(() => {
    void refreshLatestRef.current();
  }, []);

  /* ─── Poll block 1 on a short interval so the "live" rows stay fresh. ── */
  React.useEffect(() => {
    if (tab !== "tokens") return;
    let cancelled = false;

    const tick = () => {
      if (cancelled) return;
      if (typeof document !== "undefined" && document.hidden) return;
      void refreshLatestRef.current();
    };

    // Re-poll instantly when the tab opens (or the operator switches back
    // from another browser tab) so they don't stare at stale numbers.
    void refreshLatestRef.current();
    const onVisible = () => {
      if (!document.hidden) void refreshLatestRef.current();
    };
    document.addEventListener("visibilitychange", onVisible);

    const id = window.setInterval(tick, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [tab]);

  /* ─── "Updated Ns ago" rolls every second to feel alive. ───────────── */
  const [now, setNow] = React.useState<number>(() => Date.now());
  React.useEffect(() => {
    if (tab !== "tokens") return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [tab]);
  const secondsAgo = Math.max(0, Math.floor((now - lastUpdatedAt) / 1000));

  /* ─── Poll /api/news so the Crypto News tab stays fresh. ──────────────
   * Runs on every CoinMarketTabs mount (regardless of which tab is active)
   * so the moment the operator switches to "Crypto News", the latest pull
   * is already in state. An empty / failed response keeps the previous good
   * snapshot — same "last known values" pattern we use for tokens. */
  React.useEffect(() => {
    let cancelled = false;

    const refresh = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/news?limit=${NEWS_LIMIT}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const payload = (await res.json()) as { news: NewsItem[] };
        const fresh = payload.news;
        if (cancelled) return;
        if (Array.isArray(fresh) && fresh.length > 0) setNews(fresh);
      } catch {
        /* keep the last good snapshot on transient errors */
      } finally {
        if (!cancelled) setNewsPending(false);
      }
    };

    // Re-poll immediately on visibility change so coming back to the tab
    // pulls the latest headlines right away.
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    // First pull right away: the shell is already on screen.
    void refresh();
    const id = window.setInterval(refresh, NEWS_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  /* ─── Append the next block when the user paginates past loaded data. ── */
  const ensureLoadedForPage = React.useCallback(
    async (tablePage: number, tablePageSize: number) => {
      const tokensNeeded = (tablePage + 1) * tablePageSize;
      if (tokensNeeded <= tokens.length) return;
      if (!hasMore || loading) return;

      setLoading(true);
      try {
        const nextCgPage = Math.floor(tokens.length / BLOCK_SIZE) + 1;
        const res = await fetch(
          `/api/tokens?page=${nextCgPage}&perPage=${BLOCK_SIZE}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const payload = (await res.json()) as {
          tokens: TokenEntry[];
          source: unknown;
        };
        const more = payload.tokens;
        if (!Array.isArray(more) || more.length === 0) {
          // Reached the end of CoinGecko's list.
          setHasMore(false);
          return;
        }
        setTokens((prev) => [...prev, ...more]);
      } finally {
        setLoading(false);
      }
    },
    [tokens.length, hasMore, loading],
  );

  // Display total: rough upper bound until we know we've hit the end,
  // then the exact loaded count.
  const estimatedTotal = hasMore
    ? Math.max(ESTIMATED_MAX_TOKENS, tokens.length)
    : tokens.length;

  return (
    <>
      <div className="no-scrollbar flex overflow-x-auto border-b border-border">
        {TABS.map((tab2) => {
          const Icon = tab2.icon;
          const active = tab === tab2.id;
          return (
            <button
              key={tab2.id}
              type="button"
              onClick={() => setTab(tab2.id)}
              className={cn(
                "relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none",
                active
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t(tab2.labelKey)}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "tokens" && (
        <div className="space-y-5">
          {/* Live status strip — shows freshness + manual refresh affordance.
              When the upstream API can't be reached we silently keep the
              last good snapshot; the "Updated Ns ago" counter is the only
              hint that polling has paused (it just keeps climbing). */}
          <div className="flex items-center justify-end gap-2 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span className="relative inline-flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[oklch(0.78_0.18_155)] opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[oklch(0.78_0.18_155)]" />
              </span>
              <span className="font-semibold uppercase tracking-wider text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
                {t("toolsUI.news.coinMarket.live")}
              </span>
            </span>
            <span aria-hidden className="text-muted-foreground/40">·</span>
            <span className="tabular-nums">
              {secondsAgo < 1
                ? t("toolsUI.news.coinMarket.updatedJustNow")
                : t("toolsUI.news.coinMarket.updatedSecondsAgo").replace("{seconds}", String(secondsAgo))}
            </span>
            <button
              type="button"
              onClick={manualRefresh}
              disabled={refreshing}
              aria-label={t("toolsUI.news.coinMarket.refreshAria")}
              className={cn(
                "ml-1 inline-flex h-6 w-6 items-center justify-center rounded-md border border-border transition-colors",
                "hover:bg-muted hover:text-foreground",
                refreshing && "opacity-60",
              )}
            >
              <RefreshCw
                className={cn(
                  "h-3 w-3",
                  refreshing && "animate-spin",
                )}
              />
            </button>
          </div>

          {tokensPending && tokens.length === 0 ? (
            <TapeSkeleton />
          ) : (
            <>
              <MarketStatsRow tokens={tokens.slice(0, BLOCK_SIZE)} />
              <TokensTable
                tokens={tokens}
                estimatedTotal={estimatedTotal}
                loading={loading}
                onPageChange={ensureLoadedForPage}
                pageSize={100}
              />
            </>
          )}
        </div>
      )}

      {tab === "news" && (
        <NewsFeed items={news} categories={CRYPTO_CATEGORIES} loading={newsPending} />
      )}
    </>
  );
}

/** Placeholder for the stats row + first table rows while block 1 loads. */
function TapeSkeleton() {
  const bone = "animate-pulse rounded-md bg-muted";
  return (
    <div className="space-y-5" aria-busy>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Card key={i} className="space-y-2 p-4">
            <div className={`${bone} h-3 w-20`} />
            <div className={`${bone} h-6 w-28`} />
          </Card>
        ))}
      </div>
      <Card className="divide-y divide-border p-0">
        {Array.from({ length: 10 }, (_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <div className={`${bone} h-4 w-6`} />
            <div className={`${bone} h-6 w-6 rounded-full`} />
            <div className={`${bone} h-4 w-32`} />
            <div className={`${bone} ml-auto h-4 w-20`} />
            <div className={`${bone} h-4 w-16`} />
            <div className={`${bone} hidden h-4 w-24 md:block`} />
          </div>
        ))}
      </Card>
    </div>
  );
}

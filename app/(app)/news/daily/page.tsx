"use client";

import * as React from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { NewsFeed } from "@/components/news/news-feed";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { MOCK_DAILY_NEWS, type NewsCategory, type NewsItem } from "@/lib/mock/news";

const DAILY_CATEGORIES: NewsCategory[] = ["Tech", "Business", "World", "Politics", "Science", "Sports"];

/** Refresh the feed every 10 minutes so the page stays live without the
 *  user manually reloading. Same cadence as the server-side RSS cache so
 *  every auto-poll is cheap. */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

/** Last good batch, kept per browser so a return visit paints instantly
 *  while the fresh batch loads. Bounded: 60 trimmed items ≈ 30 KB. */
const SNAPSHOT_KEY = "avortyx.news.daily";

interface NewsResponse {
  items: NewsItem[];
  cached: boolean;
  stale?: boolean;
  fetchedAt: number;
  failedSources?: string[];
}

interface Snapshot {
  items: NewsItem[];
  fetchedAt: number;
}

function readSnapshot(): Snapshot | null {
  try {
    const raw = window.localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Snapshot;
    return Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeSnapshot(snap: Snapshot) {
  try {
    window.localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
  } catch {
    // Storage full or blocked — the page still works, it just cold-starts next time.
  }
}

export default function DailyNewsPage() {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [fetchedAt, setFetchedAt] = React.useState<number | null>(null);
  // True only while there is nothing on screen yet (no snapshot, first load).
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Paint the last batch immediately; the network round-trip then only
  // ever *updates* the page.
  React.useEffect(() => {
    const snap = readSnapshot();
    if (snap) {
      setItems(snap.items);
      setFetchedAt(snap.fetchedAt);
      setLoading(false);
    }
  }, []);

  const load = React.useCallback(async () => {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/daily-news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: NewsResponse = await res.json();
      if (data.items.length > 0) {
        setItems(data.items);
        setFetchedAt(data.fetchedAt);
        writeSnapshot({ items: data.items, fetchedAt: data.fetchedAt });
      } else {
        // Every source failed and the server had nothing cached — keep
        // whatever is on screen, or the fixture so the page isn't empty.
        setItems((prev) => (prev.length > 0 ? prev : MOCK_DAILY_NEWS));
      }
      // The server answered from a stale batch and is refreshing behind
      // it — pull again shortly so the fresh batch lands without a reload.
      if (data.stale) window.setTimeout(() => void load(), 8_000);
    } catch (err) {
      setError(String(err));
      setItems((prev) => (prev.length > 0 ? prev : MOCK_DAILY_NEWS));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial fetch + 10-minute auto-refresh loop. Resets if the component
  // unmounts so navigating away cleanly stops the polling.
  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return (
    <>
      <PageHeader
        title={t("toolsUI.news.daily.title")}
        description={t("toolsUI.news.daily.description")}
        actions={
          <div className="flex items-center gap-3">
            {fetchedAt && (
              <span className="hidden text-[11px] text-muted-foreground sm:inline">
                {refreshing
                  ? t("toolsUI.news.feed.stale")
                  : t("toolsUI.news.daily.lastUpdated").replace("{time}", new Date(fetchedAt).toLocaleTimeString())}
              </span>
            )}
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
              {refreshing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {t("common.refresh")}
            </Button>
          </div>
        }
      />

      {error && items.length > 0 && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/8 px-3 py-2 text-xs text-destructive">
          {t("toolsUI.news.daily.fetchError")}
        </div>
      )}

      <NewsFeed items={items} categories={DAILY_CATEGORIES} loading={loading} />
    </>
  );
}

/**
 * Daily News and Coin Market open instantly because their last good data is
 * already in the browser before the person clicks.
 *
 * Two things fill it:
 *   - each page saves what it shows (as before), and
 *   - `prefetchNewsPages()` fetches both in the background shortly after the
 *     app opens, so even the very first click of a session finds data waiting.
 *
 * The pages read it with a layout effect, which runs before the first paint,
 * so there is no empty-skeleton flash on the way in.
 */
import type { NewsItem } from "@/lib/mock/news";
import type { TokenEntry } from "@/lib/mock/tokens";

export const DAILY_KEY = "avortyx.news.daily";
export const CRYPTO_KEY = "avortyx.news.crypto";
/** Only the first block of the tape is worth keeping (what is on screen). */
const TOKEN_BLOCK = 250;

export interface DailySnapshot {
  items: NewsItem[];
  fetchedAt: number;
}

export interface CryptoSnapshot {
  tokens: TokenEntry[];
  news: NewsItem[];
  at: number;
}

function read<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the page still works, it just cold-starts next time.
  }
}

export function readDailySnapshot(): DailySnapshot | null {
  const snap = read<DailySnapshot>(DAILY_KEY);
  return snap && Array.isArray(snap.items) && snap.items.length > 0 ? snap : null;
}

export function writeDailySnapshot(snap: DailySnapshot) {
  write(DAILY_KEY, snap);
}

export function readCryptoSnapshot(): CryptoSnapshot | null {
  const snap = read<CryptoSnapshot>(CRYPTO_KEY);
  return snap && Array.isArray(snap.tokens) && Array.isArray(snap.news) ? snap : null;
}

export function writeCryptoSnapshot(snap: CryptoSnapshot) {
  write(CRYPTO_KEY, { ...snap, tokens: snap.tokens.slice(0, TOKEN_BLOCK) });
}

let prefetched = false;

/** Warm both pages' browser copies once per session. Safe to call repeatedly. */
export function prefetchNewsPages(): void {
  if (typeof window === "undefined" || prefetched) return;
  prefetched = true;

  const get = async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url, { cache: "no-store" });
      return res.ok ? ((await res.json()) as T) : null;
    } catch {
      return null;
    }
  };

  void (async () => {
    const [daily, tokens, news] = await Promise.all([
      get<{ items?: NewsItem[]; fetchedAt?: number }>("/api/daily-news"),
      get<{ tokens?: TokenEntry[] }>(`/api/tokens?page=1&perPage=${TOKEN_BLOCK}`),
      get<{ news?: NewsItem[] }>("/api/news?limit=24"),
    ]);

    if (daily?.items?.length) {
      writeDailySnapshot({ items: daily.items, fetchedAt: daily.fetchedAt ?? Date.now() });
    }

    const prev = readCryptoSnapshot();
    const nextTokens = tokens?.tokens?.length ? tokens.tokens : (prev?.tokens ?? []);
    const nextNews = news?.news?.length ? news.news : (prev?.news ?? []);
    if (nextTokens.length > 0 || nextNews.length > 0) {
      writeCryptoSnapshot({ tokens: nextTokens, news: nextNews, at: Date.now() });
    }
  })();
}

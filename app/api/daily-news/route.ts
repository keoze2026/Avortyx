/**
 * Live daily-news aggregator — fetches RSS feeds from ~13 reputable sources
 * (BBC, NPR, TechCrunch, The Verge and Bloomberg) in parallel, normalizes the
 * items into the shared `NewsItem` shape, and returns the freshest 60 entries.
 *
 * Speed:
 *   - Stale-while-revalidate. A batch up to 10 minutes old is returned as
 *     is. Between 10 and 15 minutes it is returned immediately and refreshed
 *     in the background with `after()`, which keeps the server running until
 *     the refresh finishes (a plain fire-and-forget promise could be cut off
 *     by the host as soon as the response was sent, leaving the same news on
 *     screen for hours). Older than 15 minutes, the request waits for the
 *     fresh batch, so the page never shows news more than ~15 minutes old.
 *   - Every feed has a hard 4 s deadline, so one slow outlet can no longer
 *     hold the whole response; the fast ones are served and the slow one
 *     just misses this batch.
 *   - Each feed is fetched with `cache: "no-store"`: the 10-minute window is
 *     this file's own cache. Next's data cache on top of it could hand a
 *     refresh a copy of the feed that was itself up to 10 minutes old.
 *
 * No API key required — every source is publicly accessible RSS / Atom.
 */

import { after, NextResponse } from "next/server";

import type { NewsCategory, NewsItem } from "@/lib/mock/news";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_MS = 10 * 60 * 1000; // 10 minutes
/** Past this age a request waits for the fresh batch instead of serving the old one. */
const MAX_STALE_MS = 15 * 60 * 1000; // 15 minutes
const PER_FEED_LIMIT = 12; // most-recent N per source
const TOTAL_LIMIT = 60;
/** Per-feed deadline. Past this a source is skipped for the batch. */
const FEED_TIMEOUT_MS = 4_000;

interface FeedSource {
  url: string;
  /** Display name used as `NewsItem.source`. */
  source: string;
  category: NewsCategory;
}

/**
 * Curated RSS feeds. All publicly accessible, no API key required.
 * Mix of UK + US outlets so politics / sports lean toward the English-
 * speaking common denominator.
 */
const FEEDS: FeedSource[] = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml",                   source: "BBC News",     category: "World" },
  { url: "https://feeds.bbci.co.uk/news/business/rss.xml",                source: "BBC Business", category: "Business" },
  { url: "https://feeds.bbci.co.uk/news/technology/rss.xml",              source: "BBC Tech",     category: "Tech" },
  { url: "https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", source: "BBC Science",  category: "Science" },
  { url: "https://feeds.bbci.co.uk/sport/rss.xml",                        source: "BBC Sport",    category: "Sports" },
  { url: "https://feeds.npr.org/1014/rss.xml",                            source: "NPR Politics", category: "Politics" },
  { url: "https://techcrunch.com/feed/",                                  source: "TechCrunch",   category: "Tech" },
  { url: "https://www.theverge.com/rss/index.xml",                        source: "The Verge",    category: "Tech" },
  // Bloomberg's official public feeds: headline, one-line summary and a link
  // to the story on bloomberg.com (which may ask the reader to subscribe).
  { url: "https://www.bloomberg.com/feeds/markets/news.rss",              source: "Bloomberg Markets",    category: "Business" },
  { url: "https://www.bloomberg.com/feeds/business/news.rss",             source: "Bloomberg Business",   category: "Business" },
  { url: "https://www.bloomberg.com/feeds/economics/news.rss",            source: "Bloomberg Economics",  category: "Business" },
  { url: "https://www.bloomberg.com/feeds/technology/news.rss",           source: "Bloomberg Technology", category: "Tech" },
  { url: "https://www.bloomberg.com/feeds/politics/news.rss",             source: "Bloomberg Politics",   category: "Politics" },
];

/** Deterministic gradient tint per item — uses the title hash so the same
 *  story always lands on the same color. */
const TINTS: Array<[string, string]> = [
  ["#3A4BC4", "#818CF8"],
  ["#14B8A6", "#6366F1"],
  ["#F97316", "#EC4899"],
  ["#06B6D4", "#4F46E5"],
  ["#D946EF", "#6366F1"],
  ["#DC2626", "#F59E0B"],
];

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

let cache: { items: NewsItem[]; at: number; failedSources: string[] } | null = null;
function readCache() {
  return cache;
}

/** Single-flight refresh so a burst of requests fans out to the feeds once. */
let inflight: Promise<void> | null = null;

async function fetchFeed(feed: FeedSource): Promise<NewsItem[]> {
  const res = await fetch(feed.url, {
    cache: "no-store",
    signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    headers: {
      // Some feeds (notably TechCrunch) 403 a default-UA fetch.
      "User-Agent": "Mozilla/5.0 (compatible; AvortyxNewsBot/1.0; +https://avortyx.io)",
      Accept: "application/rss+xml, application/atom+xml, application/xml;q=0.9, */*;q=0.8",
    },
  });
  if (!res.ok) throw new Error(`${feed.source} HTTP ${res.status}`);
  return parseFeed(await res.text(), feed);
}

/** Pull every feed (each on its own deadline) and replace the cache when
 *  at least one source answered — never overwrite a good batch with nothing. */
function refresh(): Promise<void> {
  if (inflight) return inflight;
  inflight = (async () => {
    const results = await Promise.allSettled(FEEDS.map(fetchFeed));
    const newest = results
      .flatMap((r) => (r.status === "fulfilled" ? r.value : []))
      .sort((a, b) => b.publishedAt - a.publishedAt)
      .slice(0, TOTAL_LIMIT);
    await fillMissingImages(newest);
    // Bloomberg's feeds carry no picture and its site blocks the picture
    // lookup, so its stories showed as empty coloured cards. Only Bloomberg
    // stories that do have a picture are shown.
    const items = newest.filter((i) => !i.source.startsWith("Bloomberg") || Boolean(i.imageUrl));
    const failedSources = results
      .map((r, i) => (r.status === "rejected" ? FEEDS[i].source : null))
      .filter((x): x is string => x !== null);
    if (items.length > 0) cache = { items, at: Date.now(), failedSources };
  })().finally(() => {
    inflight = null;
  });
  return inflight;
}

export async function GET() {
  const age = cache ? Date.now() - cache.at : Infinity;

  // Too old to show: wait for the fresh batch (bounded by the per-feed
  // deadline). If every source fails, the old batch is still served below.
  if (cache && age >= MAX_STALE_MS) await refresh();

  if (cache) {
    const nowAge = Date.now() - cache.at;
    // Serve what we have straight away; refresh behind the response when the
    // batch is past its freshness window. after() keeps the server alive
    // until that refresh is done.
    if (nowAge >= CACHE_MS) after(() => refresh());
    return NextResponse.json(
      {
        items: cache.items,
        cached: true,
        stale: nowAge >= CACHE_MS,
        fetchedAt: cache.at,
        failedSources: cache.failedSources,
      },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } },
    );
  }

  // Cold start — nothing to serve yet, so this request waits (bounded by
  // the per-feed deadline). Read the cache through a helper: TypeScript
  // narrowed `cache` to null above and can't see `refresh()` writing it.
  await refresh();
  const filled = readCache();
  return NextResponse.json(
    {
      items: filled?.items ?? [],
      cached: false,
      stale: false,
      fetchedAt: filled?.at ?? Date.now(),
      failedSources: filled?.failedSources ?? FEEDS.map((f) => f.source),
    },
    { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=600" } },
  );
}

/* ────────────────────────────────────────────────────────────────────── */
/*  Picture enrichment — feeds that ship no image (TechCrunch)            */
/* ────────────────────────────────────────────────────────────────────── */

/** Article pages we already looked at, url → og:image (or null when the
 *  page had none). Bounded; refreshes reuse it so each article is fetched
 *  at most once for the life of the process. */
const IMAGE_LOOKUPS = new Map<string, string | null>();
const IMAGE_LOOKUP_MAX = 500;
/** Article pages fetched per refresh — keeps a cold start bounded. */
const PAGE_LOOKUPS_PER_REFRESH = 12;
const PAGE_TIMEOUT_MS = 3_500;
const BOT_UA = "Mozilla/5.0 (compatible; AvortyxNewsBot/1.0; +https://avortyx.io)";

function rememberImage(url: string, image: string | null) {
  if (IMAGE_LOOKUPS.size >= IMAGE_LOOKUP_MAX) {
    const first = IMAGE_LOOKUPS.keys().next().value;
    if (first !== undefined) IMAGE_LOOKUPS.delete(first);
  }
  IMAGE_LOOKUPS.set(url, image);
}

/**
 * Give every story a picture where the feed didn't carry one:
 *
 *   1. TechCrunch — its RSS is text-only, but the WordPress REST API returns
 *      the featured image for a batch of post ids in a single request.
 *   2. Anything else still missing — read `og:image` off the article page,
 *      a bounded number per refresh, remembered across refreshes so the
 *      list fills in over successive polls without re-fetching.
 */
async function fillMissingImages(items: NewsItem[]): Promise<void> {
  const missing = items.filter((i) => !i.imageUrl);
  if (missing.length === 0) return;

  // Anything we've already resolved (or know has no picture).
  for (const item of missing) {
    const known = IMAGE_LOOKUPS.get(item.url);
    if (known) item.imageUrl = known;
  }

  await fillTechCrunchImages(missing.filter((i) => !i.imageUrl && i.source === "TechCrunch"));

  const pending = missing
    .filter((i) => !i.imageUrl && !IMAGE_LOOKUPS.has(i.url))
    .slice(0, PAGE_LOOKUPS_PER_REFRESH);
  await Promise.allSettled(
    pending.map(async (item) => {
      const image = await fetchOgImage(item.url);
      rememberImage(item.url, image);
      if (image) item.imageUrl = image;
    }),
  );
}

async function fillTechCrunchImages(items: NewsItem[]): Promise<void> {
  if (items.length === 0) return;
  // The feed's <guid> is `https://techcrunch.com/?p=<post id>`; parseFeed
  // keeps it on the item as `wpPostId`.
  const ids = items.map((i) => i.wpPostId).filter((n): n is number => typeof n === "number");
  if (ids.length === 0) return;
  try {
    const res = await fetch(
      `https://techcrunch.com/wp-json/wp/v2/posts?include=${ids.join(",")}&per_page=${ids.length}&_fields=id,jetpack_featured_media_url`,
      { signal: AbortSignal.timeout(PAGE_TIMEOUT_MS), headers: { "User-Agent": BOT_UA } },
    );
    if (!res.ok) return;
    const rows = (await res.json()) as Array<{ id: number; jetpack_featured_media_url?: string }>;
    const byId = new Map(rows.map((r) => [r.id, r.jetpack_featured_media_url || null]));
    for (const item of items) {
      const image = item.wpPostId !== undefined ? (byId.get(item.wpPostId) ?? null) : null;
      rememberImage(item.url, image);
      if (image) item.imageUrl = image;
    }
  } catch {
    // Fall through — the og:image pass picks these up.
  }
}

/** First `og:image` / `twitter:image` on an article page, or null. Reads
 *  only the head of the document. */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
      headers: { "User-Agent": BOT_UA, Accept: "text/html" },
    });
    if (!res.ok) return null;
    const head = (await res.text()).slice(0, 120_000);
    const m =
      head.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i) ??
      head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image(?::secure_url)?["']/i) ??
      head.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
    const image = m ? decode(m[1]) : null;
    return image && /^https?:\/\//.test(image) ? image : null;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────────────────── */
/*  RSS / Atom parser — regex-based, handles both feed flavors            */
/* ────────────────────────────────────────────────────────────────────── */

function parseFeed(xml: string, feed: FeedSource): NewsItem[] {
  const isAtom =
    xml.includes("<feed") &&
    xml.includes('xmlns="http://www.w3.org/2005/Atom"');
  const itemTag = isAtom ? "entry" : "item";
  const blocks = extractAll(xml, itemTag);

  const items: NewsItem[] = [];
  for (const block of blocks.slice(0, PER_FEED_LIMIT)) {
    const title = decode(extractFirst(block, "title")) ?? "";
    const description =
      decode(extractFirst(block, isAtom ? "summary" : "description")) ??
      decode(extractFirst(block, "content")) ??
      "";
    const link = isAtom
      ? extractAttr(block, "link", "href") ??
        decode(extractFirst(block, "link")) ??
        ""
      : decode(extractFirst(block, "link")) ?? "";
    const pubDateRaw =
      decode(extractFirst(block, isAtom ? "published" : "pubDate")) ??
      decode(extractFirst(block, isAtom ? "updated" : "dc:date"));
    const publishedAt = pubDateRaw ? Date.parse(pubDateRaw) : NaN;

    // Try `<media:thumbnail url="..."/>`, `<media:content url="..."/>`,
    // `<enclosure url="..."/>`, and lastly the first `<img src="...">` in
    // any HTML the entry carries (description, or the full `<content>` /
    // `<content:encoded>` body — The Verge only puts its picture there).
    const imageUrl =
      decode(
        extractAttr(block, "media:thumbnail", "url") ??
          extractAttr(block, "media:content", "url") ??
          extractAttr(block, "enclosure", "url") ??
          extractImgSrc(description) ??
          extractImgSrc(block),
      ) ?? undefined;

    if (!title || !link || !Number.isFinite(publishedAt)) continue;

    // WordPress feeds expose the post id in <guid> (`…/?p=123`) — used to
    // look up the featured image when the feed itself carries none.
    const guid = extractFirst(block, "guid") ?? "";
    const wpPostId = guid.match(/[?&]p=(\d+)/)?.[1];

    const id = `${feed.source}-${hashCode(link)}`;
    const tint = TINTS[hashCode(title) % TINTS.length];

    items.push({
      id,
      title: title.trim(),
      summary: stripTags(description).slice(0, 220).trim(),
      source: feed.source,
      category: feed.category,
      publishedAt,
      url: link.trim(),
      tint,
      ...(imageUrl ? { imageUrl } : {}),
      ...(wpPostId ? { wpPostId: Number(wpPostId) } : {}),
    });
  }
  return items;
}

/** Extract every `<tag>…</tag>` block (non-greedy). */
function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?<\\/${tag}>`, "g");
  return xml.match(re) ?? [];
}

/** Extract the first inner text of `<tag>…</tag>`. CDATA-aware. */
function extractFirst(xml: string, tag: string): string | null {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`);
  const m = xml.match(re);
  if (!m) return null;
  const inner = m[1].trim();
  const cdata = inner.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return cdata ? cdata[1] : inner;
}

/** Extract `<tag attr="…">` value of a given attribute. */
function extractAttr(xml: string, tag: string, attr: string): string | null {
  const re = new RegExp(`<${tag}[^>]*\\s${attr}="([^"]+)"`);
  const m = xml.match(re);
  return m ? m[1] : null;
}

function extractImgSrc(html: string): string | null {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : null;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ");
}

function decode(s: string | null): string | null {
  if (s == null) return null;
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}
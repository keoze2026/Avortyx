"use client";

/**
 * Shared news feed (Daily News + Crypto News tab).
 *
 * Layout — an editorial front page rather than a wall of equal cards:
 *
 *   ┌──────────────────────────────────────────┬──────────────────┐
 *   │  Lead story (image · source · time)      │  LATEST          │
 *   │                                          │  · headline      │
 *   ├────────────────────┬─────────────────────┤  · headline      │
 *   │  Top stories       │  (2-up card grid)   │  · headline  …   │
 *   │  …                 │  …                  │                  │
 *   └────────────────────┴─────────────────────┴──────────────────┘
 *
 * Only pictured stories go in the card grid (fixed 16:9 thumbnails, so the
 * rows line up); text-only stories go to a headline list beneath it, where
 * they read better than as a card with a random gradient block. The
 * right-hand "Latest" rail is the scan-first view: source · time ·
 * headline, newest first.
 *
 * `loading` renders the same layout as skeletons so the page never pops
 * from a spinner to a grid.
 */

import * as React from "react";
import { ArrowUpRight, Clock3, Search, X } from "lucide-react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatRelativeTime } from "@/lib/format";
import type { NewsCategory, NewsItem } from "@/lib/mock/news";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface Props {
  items: NewsItem[];
  /** Tag pills offered as a quick filter. "All" is always prepended. */
  categories: NewsCategory[];
  /** Skeleton layout while the first batch is loading. */
  loading?: boolean;
}

/** How many headlines the "Latest" rail shows. */
const LATEST_COUNT = 10;
/** Grid cards after the lead story. */
const GRID_COUNT = 12;

export function NewsFeed({ items, categories, loading = false }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<NewsCategory | "all">("all");

  const filtered = React.useMemo(() => {
    let list = items;
    if (category !== "all") list = list.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((i) => `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => b.publishedAt - a.publishedAt);
  }, [items, query, category]);

  // Lead = the newest story that has a picture (falls back to the newest).
  // The card grid takes pictured stories only, so its rows line up; every
  // text-only story goes to the headline list where it reads better anyway.
  const leadIndex = Math.max(0, filtered.findIndex((i) => !!i.imageUrl));
  const lead = filtered[leadIndex];
  const rest = filtered.filter((_, i) => i !== leadIndex);
  const pictured = rest.filter((i) => !!i.imageUrl);
  const grid = pictured.slice(0, GRID_COUNT);
  const gridIds = new Set(grid.map((i) => i.id));
  const more = rest.filter((i) => !gridIds.has(i.id));
  const latest = filtered.slice(0, LATEST_COUNT);

  // Only offer chips for categories that actually have stories.
  const present = React.useMemo(() => new Set(items.map((i) => i.category)), [items]);

  return (
    <div className="space-y-5">
      {/* Toolbar: category chips + always-visible search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-1 flex items-center gap-1.5 overflow-x-auto px-1">
          <Chip label={t("toolsUI.news.feed.all")} active={category === "all"} onClick={() => setCategory("all")} />
          {categories
            .filter((c) => loading || present.has(c))
            .map((c) => (
              <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
        </div>
        <div className="relative sm:ml-auto sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("toolsUI.news.feed.searchPlaceholder")}
            className="h-9 pl-7 pr-7 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("toolsUI.news.feed.closeSearch")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <FeedSkeleton />
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {t("toolsUI.news.feed.noMatches")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          {/* Main column */}
          <div className="min-w-0 space-y-5">
            {lead && <LeadCard item={lead} />}

            {grid.length > 0 && (
              <section>
                <SectionLabel>
                  {t("toolsUI.news.feed.topStories")}
                  <span className="ml-2 font-normal normal-case tracking-normal text-muted-foreground/70">
                    {t("toolsUI.news.feed.storiesCount").replace("{count}", String(filtered.length))}
                  </span>
                </SectionLabel>
                <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                  {grid.map((item) => (
                    <StoryCard key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}

            {more.length > 0 && (
              <section>
                <SectionLabel>{t("toolsUI.news.feed.moreStories")}</SectionLabel>
                <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                  {more.map((item) => (
                    <HeadlineRow key={item.id} item={item} />
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Latest rail */}
          <aside className="min-w-0">
            <div className="xl:sticky xl:top-20">
              <SectionLabel>{t("toolsUI.news.feed.latest")}</SectionLabel>
              <div className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
                {latest.map((item) => (
                  <HeadlineRow key={item.id} item={item} compact />
                ))}
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────── */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{children}</h2>
  );
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors",
        active
          ? "border-accent/50 bg-accent/15 text-foreground"
          : "border-border bg-card text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function Meta({ item, className }: { item: NewsItem; className?: string }) {
  return (
    <div className={cn("flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground", className)}>
      <span className="truncate font-semibold text-foreground/80">{item.source}</span>
      <span aria-hidden>·</span>
      <span className="shrink-0">{item.category}</span>
      <span aria-hidden>·</span>
      <span className="inline-flex shrink-0 items-center gap-1 tabular-nums">
        <Clock3 className="h-3 w-3" />
        {formatRelativeTime(item.publishedAt)}
      </span>
    </div>
  );
}

function Thumb({ item, className }: { item: NewsItem; className?: string }) {
  if (!item.imageUrl) return null;
  return (
    <div className={cn("relative overflow-hidden bg-muted", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={item.imageUrl}
        alt=""
        className="h-full w-full object-cover transition-transform duration-500 group-hover/story:scale-[1.03]"
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

function LeadCard({ item }: { item: NewsItem }) {
  const { t } = useTranslation();
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group/story block">
      <Card className="overflow-hidden p-0 transition-colors hover:border-accent/45">
        <div className={cn("grid grid-cols-1", item.imageUrl && "md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]")}>
          {item.imageUrl && <Thumb item={item} className="aspect-video md:aspect-auto md:h-full" />}
          <div className="flex flex-col justify-center p-5 sm:p-6">
            <Meta item={item} />
            <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight transition-colors group-hover/story:text-accent sm:text-2xl">
              {item.title}
            </h2>
            {item.summary && (
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
            )}
            <span className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-accent">
              {t("toolsUI.news.feed.readFullStory")}
              <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover/story:-translate-y-0.5 group-hover/story:translate-x-0.5" />
            </span>
          </div>
        </div>
      </Card>
    </a>
  );
}

function StoryCard({ item }: { item: NewsItem }) {
  return (
    <a href={item.url} target="_blank" rel="noopener noreferrer" className="group/story block h-full">
      <Card className="flex h-full flex-col overflow-hidden p-0 transition-colors hover:border-accent/45">
        <Thumb item={item} className="aspect-video w-full shrink-0" />
        <div className="flex flex-1 flex-col p-4">
          <Meta item={item} />
          <h3 className="mt-1.5 text-[15px] font-semibold leading-snug transition-colors group-hover/story:text-accent">
            {item.title}
          </h3>
          {item.summary && (
            <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.summary}</p>
          )}
        </div>
      </Card>
    </a>
  );
}

function HeadlineRow({ item, compact = false }: { item: NewsItem; compact?: boolean }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/story flex items-start gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
    >
      {!compact && item.imageUrl && <Thumb item={item} className="h-14 w-20 shrink-0 rounded-md" />}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
          <span className="truncate font-semibold text-foreground/70">{item.source}</span>
          <span aria-hidden>·</span>
          <span className="shrink-0 tabular-nums normal-case tracking-normal">{formatRelativeTime(item.publishedAt)}</span>
        </div>
        <div
          className={cn(
            "mt-0.5 font-medium leading-snug transition-colors group-hover/story:text-accent",
            compact ? "line-clamp-2 text-[13px]" : "line-clamp-2 text-sm",
          )}
        >
          {item.title}
        </div>
      </div>
      <ArrowUpRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-colors group-hover/story:text-accent" />
    </a>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function FeedSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_320px]" aria-busy>
      <div className="space-y-5">
        <Card className="overflow-hidden p-0">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
            <Bone className="aspect-video rounded-none md:aspect-auto md:h-full" />
            <div className="space-y-3 p-6">
              <Bone className="h-3 w-40" />
              <Bone className="h-6 w-11/12" />
              <Bone className="h-6 w-3/4" />
              <Bone className="h-3 w-full" />
              <Bone className="h-3 w-5/6" />
            </div>
          </div>
        </Card>
        <Bone className="h-3 w-28" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Card key={i} className="overflow-hidden p-0">
              <Bone className="aspect-video rounded-none" />
              <div className="space-y-2 p-4">
                <Bone className="h-3 w-32" />
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-2/3" />
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div className="space-y-3">
        <Bone className="h-3 w-16" />
        <div className="divide-y divide-border rounded-xl border border-border bg-card">
          {Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="space-y-2 px-4 py-3">
              <Bone className="h-2.5 w-24" />
              <Bone className="h-3.5 w-full" />
              <Bone className="h-3.5 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

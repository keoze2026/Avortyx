"use client";

/**
 * Shared news feed (Daily News + Crypto News tab).
 *
 * Deliberately simple — two shapes only:
 *
 *   ┌─────────────────┬──────────────────────────────┐
 *   │  picture        │  CATEGORY · TOP STORY        │   ← top story
 *   │                 │  headline / summary / source │
 *   ├────────┬────────┴─┬────────────┬───────────────┤
 *   │ card   │  card    │  card      │  …            │   ← everything else,
 *   └────────┴──────────┴────────────┴───────────────┘     one uniform grid
 *
 * Every card is the same: 16:9 picture (a soft tint when the source sent
 * none), category eyebrow, headline, two lines of summary, source · time.
 * `loading` renders the same shapes as skeletons.
 */

import * as React from "react";
import { ArrowUpRight, Search, X } from "lucide-react";

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

export function NewsFeed({ items, categories, loading = false }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = React.useState("");
  const [category, setCategory] = React.useState<NewsCategory | "all">("all");

  const filtered = React.useMemo(() => {
    let list = items;
    if (category !== "all") list = list.filter((i) => i.category === category);
    const q = query.trim().toLowerCase();
    if (q) list = list.filter((i) => `${i.title} ${i.summary} ${i.source}`.toLowerCase().includes(q));
    return [...list].sort((a, b) => b.publishedAt - a.publishedAt);
  }, [items, query, category]);

  // Top story = the newest story that has a picture (else simply the newest).
  const leadIndex = Math.max(0, filtered.findIndex((i) => !!i.imageUrl));
  const lead = filtered[leadIndex];
  const rest = filtered.filter((_, i) => i !== leadIndex);

  // Only offer chips for categories that actually have stories.
  const present = React.useMemo(() => new Set(items.map((i) => i.category)), [items]);

  return (
    <div className="space-y-6">
      {/* Category chips + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="no-scrollbar -mx-1 flex items-center gap-2 overflow-x-auto px-1">
          <Chip label={t("toolsUI.news.feed.all")} active={category === "all"} onClick={() => setCategory("all")} />
          {categories
            .filter((c) => loading || present.has(c))
            .map((c) => (
              <Chip key={c} label={c} active={category === c} onClick={() => setCategory(c)} />
            ))}
        </div>
        <div className="relative sm:ml-auto sm:w-60">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("toolsUI.news.feed.searchPlaceholder")}
            className="h-9 rounded-full pl-8 pr-8 text-xs"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={t("toolsUI.news.feed.closeSearch")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {loading && items.length === 0 ? (
        <FeedSkeleton />
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-12 text-center text-sm text-muted-foreground">
          {t("toolsUI.news.feed.noMatches")}
        </div>
      ) : (
        <>
          {lead && <TopStory item={lead} />}
          {rest.length > 0 && (
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
              {rest.map((item) => (
                <StoryCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ─── Pieces ───────────────────────────────────────────────────────── */

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

/** 16:9 picture, or a soft tint in the story's own colours when there is none. */
function Picture({ item, className }: { item: NewsItem; className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden bg-muted", className)}
      style={
        item.imageUrl
          ? undefined
          : { background: `linear-gradient(135deg, ${item.tint[0]}33 0%, ${item.tint[1]}33 100%)` }
      }
    >
      {item.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={item.imageUrl}
          alt=""
          className="h-full w-full object-cover transition-transform duration-500 group-hover/story:scale-[1.03]"
          loading="lazy"
          decoding="async"
        />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center text-2xl font-semibold tracking-tight text-foreground/25">
          {item.source}
        </span>
      )}
    </div>
  );
}

function Eyebrow({ item, top = false }: { item: NewsItem; top?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent">
      {item.category}
      {top && (
        <>
          <span aria-hidden className="text-muted-foreground/60">•</span>
          <span className="font-medium text-muted-foreground">{t("toolsUI.news.feed.topStory")}</span>
        </>
      )}
    </div>
  );
}

function SourceLine({ item, chip = false }: { item: NewsItem; chip?: boolean }) {
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className={cn(chip && "rounded-md bg-muted px-2 py-1 font-medium text-foreground/80")}>{item.source}</span>
      <span className="tabular-nums">{formatRelativeTime(item.publishedAt)}</span>
    </div>
  );
}

function TopStory({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/story block overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/45"
    >
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Picture item={item} className="aspect-video lg:aspect-auto lg:min-h-[320px]" />
        <div className="flex flex-col justify-center p-6 sm:p-8">
          <Eyebrow item={item} top />
          <h2 className="mt-3 text-2xl font-semibold leading-tight tracking-tight transition-colors group-hover/story:text-accent sm:text-[28px]">
            {item.title}
          </h2>
          {item.summary && (
            <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-muted-foreground">{item.summary}</p>
          )}
          <div className="mt-6 flex items-center justify-between">
            <SourceLine item={item} chip />
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-colors group-hover/story:text-accent" />
          </div>
        </div>
      </div>
    </a>
  );
}

function StoryCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group/story flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card transition-colors hover:border-accent/45"
    >
      <Picture item={item} className="aspect-video w-full shrink-0" />
      <div className="flex flex-1 flex-col p-5">
        <Eyebrow item={item} />
        <h3 className="mt-2 line-clamp-2 text-[15px] font-semibold leading-snug transition-colors group-hover/story:text-accent">
          {item.title}
        </h3>
        {item.summary && (
          <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{item.summary}</p>
        )}
        <div className="mt-auto pt-4">
          <SourceLine item={item} />
        </div>
      </div>
    </a>
  );
}

/* ─── Skeleton ─────────────────────────────────────────────────────── */

function Bone({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function FeedSkeleton() {
  return (
    <div className="space-y-6" aria-busy>
      <div className="grid grid-cols-1 overflow-hidden rounded-2xl border border-border bg-card lg:grid-cols-2">
        <Bone className="aspect-video rounded-none lg:aspect-auto lg:min-h-[320px]" />
        <div className="space-y-3 p-8">
          <Bone className="h-3 w-32" />
          <Bone className="h-7 w-11/12" />
          <Bone className="h-7 w-4/5" />
          <Bone className="h-3 w-full" />
          <Bone className="h-3 w-5/6" />
          <Bone className="mt-6 h-6 w-28" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
            <Bone className="aspect-video rounded-none" />
            <div className="space-y-2.5 p-5">
              <Bone className="h-3 w-20" />
              <Bone className="h-4 w-full" />
              <Bone className="h-4 w-3/4" />
              <Bone className="h-3 w-5/6" />
              <Bone className="mt-3 h-3 w-32" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

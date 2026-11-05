"use client";

/**
 * CH-550: a "Getting Started" video inside a page (Campaign Groups, Number
 * Pools). A one-line strip - title, length, Watch - that opens the video with
 * its chapters beside it, like the Getting Started page (CH-306): press a
 * chapter to jump there, the chapter playing is highlighted. Closed until
 * Watch is pressed, so the page itself is never pushed down; the choice is
 * remembered in this browser only.
 *
 * Videos are encoded like CH-407 (1920x1080 H.264 High 4.1, a keyframe every
 * 2 s, index at the front) so they start at once in every browser.
 */

import * as React from "react";
import { ChevronDown, CirclePlay, Clock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

export interface GuideChapter {
  /** Translation key of the chapter title. */
  key: string;
  /** Start, in seconds. */
  at: number;
}

interface GuideVideoProps {
  /** Remembers open / closed in this browser (localStorage key suffix). */
  id: string;
  src: string;
  poster: string;
  /** Translation keys. */
  titleKey: string;
  subtitleKey: string;
  chapters: readonly GuideChapter[];
  /** Length in seconds until the file says otherwise. */
  seconds: number;
  className?: string;
}

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function readOpen(id: string): boolean {
  try {
    return window.localStorage.getItem(`guide-video:${id}`) === "open";
  } catch {
    return false;
  }
}

function writeOpen(id: string, open: boolean) {
  try {
    window.localStorage.setItem(`guide-video:${id}`, open ? "open" : "closed");
  } catch {
    /* private window / blocked storage: the strip simply starts closed */
  }
}

export function GuideVideo({ id, src, poster, titleKey, subtitleKey, chapters, seconds, className }: GuideVideoProps) {
  const { t } = useTranslation();
  const [open, setOpen] = React.useState(false);
  const video = React.useRef<HTMLVideoElement>(null);
  const [now, setNow] = React.useState(0);
  const [length, setLength] = React.useState(seconds);

  React.useEffect(() => setOpen(readOpen(id)), [id]);

  const toggle = () => {
    setOpen((o) => {
      writeOpen(id, !o);
      if (o) video.current?.pause();
      return !o;
    });
  };

  const current = React.useMemo(() => {
    let idx = -1;
    chapters.forEach((c, i) => {
      if (now >= c.at) idx = i;
    });
    return idx;
  }, [now, chapters]);

  // Same safety net as the Getting Started page: Play pressed and still at
  // 0:00 after 4 s - nudge the position so the decoder starts again.
  const stallTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const clearStall = () => {
    if (stallTimer.current) clearTimeout(stallTimer.current);
    stallTimer.current = null;
  };
  const onPlay = () => {
    clearStall();
    stallTimer.current = setTimeout(() => {
      const v = video.current;
      if (v && !v.paused && v.currentTime < 0.05) {
        v.currentTime = 0.05;
        void v.play().catch(() => undefined);
      }
    }, 4000);
  };
  React.useEffect(() => clearStall, []);

  const jump = (at: number) => {
    const v = video.current;
    if (!v) return;
    v.currentTime = at;
    void v.play().catch(() => undefined);
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-center gap-3 px-4 py-3">
        <CirclePlay className="h-5 w-5 shrink-0 text-accent" />
        <div className="min-w-0 flex-1">
          {/* CH-572: just the video's title - it sits on the Getting Started page (CH-571). */}
          <div className="truncate text-sm font-semibold">{t(titleKey)}</div>
          <div className="truncate text-xs text-muted-foreground">{t(subtitleKey)}</div>
        </div>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {clock(length)}
        </span>
        <Button size="sm" variant={open ? "outline" : "default"} onClick={toggle} aria-expanded={open}>
          {open ? t("guideVideo.hide") : t("guideVideo.watch")}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </Button>
      </div>

      {open && (
        <CardContent className="grid gap-4 border-t border-border p-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="relative aspect-video w-full overflow-hidden rounded-md bg-black">
            <video
              ref={video}
              className="h-full w-full"
              controls
              playsInline
              preload="metadata"
              poster={poster}
              onTimeUpdate={(e) => {
                setNow(e.currentTarget.currentTime);
                if (e.currentTarget.currentTime > 0.05) clearStall();
              }}
              onPlay={onPlay}
              onPause={clearStall}
              onLoadedMetadata={(e) => {
                if (Number.isFinite(e.currentTarget.duration)) setLength(e.currentTarget.duration);
              }}
              controlsList="nodownload"
              aria-label={t(titleKey)}
            >
              <source src={src} type="video/mp4" />
              {t("gettingStarted.noVideo")}
            </video>
          </div>

          <div className="h-fit rounded-md border border-border">
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold">{t("gettingStarted.chapters")}</span>
              <span className="text-[11px] text-muted-foreground">
                {t("gettingStarted.stepsCount").replace("{count}", String(chapters.length))}
              </span>
            </div>
            <ol className="border-t border-border">
              {chapters.map((c, i) => {
                const active = i === current;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => jump(c.at)}
                      className={cn(
                        "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        active && "bg-accent/10",
                      )}
                      aria-current={active ? "step" : undefined}
                    >
                      <span
                        className={cn(
                          "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-semibold tabular-nums",
                          active ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground",
                        )}
                      >
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className={cn("min-w-0 flex-1 truncate text-sm", active ? "font-semibold text-foreground" : "text-foreground/90")}>
                        {t(c.key)}
                      </span>
                      {active ? (
                        <CirclePlay className="h-3.5 w-3.5 shrink-0 text-accent" />
                      ) : (
                        <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">{clock(c.at)}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>
        </CardContent>
      )}
    </Card>
  );
}

/* ─── The two guides (CH-550) ─────────────────────────────────────────── */

/** Chapter start times read from each video's step cards. */
export const CAMPAIGN_GROUPS_GUIDE = {
  id: "campaign-groups",
  src: "/videos/avortyx-campaign-groups-v1.mp4",
  poster: "/videos/avortyx-campaign-groups-v1.jpg",
  titleKey: "guideVideo.cg.title",
  subtitleKey: "guideVideo.cg.subtitle",
  seconds: 200,
  chapters: [
    { key: "guideVideo.cg.what", at: 8 },
    { key: "guideVideo.ready", at: 30 },
    { key: "guideVideo.cg.open", at: 45 },
    { key: "guideVideo.cg.create", at: 53 },
    { key: "guideVideo.cg.destinations", at: 68 },
    { key: "guideVideo.cg.rate", at: 90 },
    { key: "guideVideo.cg.limits", at: 111 },
    { key: "guideVideo.check", at: 127 },
    { key: "guideVideo.lookAt", at: 143 },
    { key: "guideVideo.cg.picks", at: 165 },
    { key: "guideVideo.wrong", at: 180 },
  ],
} as const;

export const NUMBER_POOLS_GUIDE = {
  id: "number-pools",
  src: "/videos/avortyx-number-pools-v1.mp4",
  poster: "/videos/avortyx-number-pools-v1.jpg",
  titleKey: "guideVideo.np.title",
  subtitleKey: "guideVideo.np.subtitle",
  seconds: 168,
  chapters: [
    { key: "guideVideo.np.what", at: 8 },
    { key: "guideVideo.ready", at: 26 },
    { key: "guideVideo.np.create", at: 37 },
    { key: "guideVideo.np.lander", at: 45 },
    { key: "guideVideo.np.numbers", at: 63 },
    { key: "guideVideo.np.where", at: 80 },
    { key: "guideVideo.np.spam", at: 93 },
    { key: "guideVideo.np.install", at: 103 },
    { key: "guideVideo.check", at: 117 },
    { key: "guideVideo.lookAt", at: 131 },
    { key: "guideVideo.wrong", at: 149 },
  ],
} as const;

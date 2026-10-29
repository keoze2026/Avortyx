"use client";

/**
 * Getting Started (CH-306, Sir 27 Oct: "Below Workspace").
 *
 * The portal walkthrough video - "Go live step by step", from the first
 * publisher to the first call - with its chapters beside it: press a chapter
 * to jump there, and the chapter playing is highlighted. The video is served
 * from /public/videos (4K, web-optimised MP4 that starts playing before it has
 * fully downloaded).
 */

import * as React from "react";
import { CirclePlay, Clock, MessageCircle } from "lucide-react";

import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

// CH-329: re-encoded for every browser (1920x1080, H.264 High 4.1, a keyframe
// every 2 s). The 4K file was level 6.0, which some graphics cards will not
// decode: it stayed black at 0:00 until someone skipped forward. A new name,
// so no browser plays a cached piece of the old file.
// CH-365: Sir's final cut (29 Oct), encoded the same way as CH-329 so it
// plays at once in every browser; new names so no browser shows the old cut.
// CH-407: Sir's new cut (30 Oct, 4K source, same 2:38.6 and the same step
// timings), encoded the same way: 1920x1080 H.264 High 4.1, a keyframe every
// 2 s, index at the front so it starts at once; 12.7 MB instead of 36 MB.
// The earlier cuts are removed from the site.
const VIDEO_SRC = "/videos/avortyx-getting-started-v4.mp4";
const POSTER_SRC = "/videos/avortyx-getting-started-v4.jpg";

/** Chapter start times in seconds, read from the video's step cards. */
const CHAPTERS = [
  { key: "publisher", at: 7 },
  { key: "buyer", at: 24 },
  { key: "destinations", at: 38 },
  { key: "campaign", at: 56 },
  { key: "numbers", at: 74 },
  { key: "routing", at: 89 },
  { key: "cc", at: 108 },
  { key: "goLive", at: 123 },
  { key: "tools", at: 137 },
] as const;

function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function GettingStartedPage() {
  const { t } = useTranslation();
  const video = React.useRef<HTMLVideoElement>(null);
  const [now, setNow] = React.useState(0);
  const [length, setLength] = React.useState(158);

  const current = React.useMemo(() => {
    let idx = -1;
    CHAPTERS.forEach((c, i) => {
      if (now >= c.at) idx = i;
    });
    return idx;
  }, [now]);

  // Safety net: if Play is pressed and nothing has moved at 0:00 after 4
  // seconds, nudge the position - what people did by hand ("fast forward
  // before it loads") - so the decoder starts again from the first frame.
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
    // On a phone the chapter list sits under the video: bring the video back into view.
    v.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  return (
    <div className="space-y-6">
      <PageHeader title={t("gettingStarted.title")} description={t("gettingStarted.description")} className="pb-0" />

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="relative aspect-video w-full bg-black">
            <video
              ref={video}
              className="h-full w-full"
              controls
              playsInline
              preload="metadata"
              poster={POSTER_SRC}
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
              aria-label={t("gettingStarted.videoTitle")}
            >
              <source src={VIDEO_SRC} type="video/mp4" />
              {t("gettingStarted.noVideo")}
            </video>
          </div>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4">
            <div className="min-w-0">
              <div className="text-sm font-semibold">{t("gettingStarted.videoTitle")}</div>
              <div className="text-xs text-muted-foreground">{t("gettingStarted.videoSubtitle")}</div>
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                {clock(length)}
              </span>
              <span className="rounded border border-border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">4K</span>
            </div>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardContent className="p-0">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold">{t("gettingStarted.chapters")}</span>
              <span className="text-[11px] text-muted-foreground">
                {t("gettingStarted.stepsCount").replace("{count}", String(CHAPTERS.length))}
              </span>
            </div>
            <ol className="border-t border-border">
              {CHAPTERS.map((c, i) => {
                const active = i === current;
                return (
                  <li key={c.key}>
                    <button
                      type="button"
                      onClick={() => jump(c.at)}
                      className={cn(
                        "flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted/50",
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
                        {t(`gettingStarted.chapter.${c.key}`)}
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
            <div className="flex items-start gap-2 border-t border-border px-4 py-3 text-[11px] leading-snug text-muted-foreground">
              <MessageCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{t("gettingStarted.help")}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

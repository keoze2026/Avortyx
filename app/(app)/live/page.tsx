"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { LiveControls } from "@/components/live/live-controls";
import { LiveRadar } from "@/components/live/live-radar";
import { LiveStreamPanel } from "@/components/live/live-stream-panel";
import { RoutingPath } from "@/components/live/routing-path";
import { SessionMeter } from "@/components/live/session-meter";
import { LiveBadge } from "@/components/shared/live-badge";
import { PageHeader } from "@/components/shared/page-header";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { longestActiveToCall, useLiveSummary } from "@/hooks/use-live-summary";
import { useTranslation } from "@/hooks/use-translation";

export default function LivePage() {
  const { t, locale } = useTranslation();
  const [paused, setPaused] = useState(false);
  // WebSocket drives the radar (in-flight dots + count) and the stream.
  const { inFlight, history, totals: socketTotals, hangup } = useLiveSocket({ paused });
  // Counters and featured call come from the backend's day totals, polled.
  const summary = useLiveSummary({ paused });
  // The socket tally only stands in until the first poll lands.
  const totals = summary?.totals ?? socketTotals;

  // Today's date chip — defer formatting to after mount so SSR and the
  // first client paint don't disagree about the locale string.
  const [todayLabel, setTodayLabel] = useState("");
  useEffect(() => {
    setTodayLabel(
      new Date().toLocaleDateString(locale, {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
    );
  }, [locale]);

  // Featured = the backend's longest active call. The socket's copy of the
  // same call is preferred (it carries buyer, publisher and number for the
  // routing path); when the socket list doesn't hold it, a card is built from
  // the summary. With nothing live, falls back to the most recent settled call.
  const longestActive = summary?.longestActive ?? null;
  const featured = useMemo(() => {
    if (!longestActive) return history[0] ?? null;
    return inFlight.find((c) => c.id === longestActive.id) ?? longestActiveToCall(longestActive);
  }, [longestActive, inFlight, history]);

  return (
    <>
      <PageHeader
        title={t("page.live.title")}
        description={t("page.live.description")}
        actions={
          <>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/60 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground"
              suppressHydrationWarning
            >
              <CalendarDays className="h-3 w-3 text-accent" />
              {todayLabel || "—"}
            </span>
            <LiveBadge label={paused ? t("liveUI.badge.paused") : t("liveUI.badge.streaming")} />
            <LiveControls paused={paused} onTogglePause={() => setPaused((p) => !p)} />
          </>
        }
      />

      <LiveRadar inFlight={inFlight} featured={featured} totals={totals} />

      {/* Bento — 12 col */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <LiveStreamPanel inFlight={inFlight} history={history} onHangup={hangup} />
        </div>
        <div className="space-y-4 lg:col-span-4">
          <RoutingPath call={featured} />
          <SessionMeter totals={totals} inFlightCount={inFlight.length} />
        </div>
      </div>
    </>
  );
}
"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";

import { LiveControls } from "@/components/live/live-controls";
import { LiveRadar } from "@/components/live/live-radar";
import { LiveStreamPanel } from "@/components/live/live-stream-panel";
import { RoutingPath } from "@/components/live/routing-path";
import { SessionMeter } from "@/components/live/session-meter";
import { LiveBadge } from "@/components/shared/live-badge";
import { PageHeader } from "@/components/shared/page-header";
import { useLiveSocket } from "@/hooks/use-live-socket";
import { useTranslation } from "@/hooks/use-translation";

export default function LivePage() {
  const { t, locale } = useTranslation();
  const [paused, setPaused] = useState(false);
  const { inFlight, history, totals, hangup } = useLiveSocket({ paused });

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

  // Featured = longest-running in-flight call, falls back to most recent settled.
  const featured =
    inFlight.length > 0
      ? [...inFlight].sort((a, b) => a.startedAt - b.startedAt)[0]
      : history[0] ?? null;

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

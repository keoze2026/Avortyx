"use client";

import { useMemo } from "react";
import { Activity, DollarSign, Gauge, PhoneCall } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { useCallsStore } from "@/lib/store/calls-store";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import type { Destination } from "@/lib/types";

interface DestinationStatsRowProps {
  destination: Destination;
}

export function DestinationStatsRow({ destination }: DestinationStatsRowProps) {
  const { t } = useTranslation();
  const recentCalls = useCallsStore((s) => s.recent);
  const stats = useMemo(() => {
    // Revenue is still summed from the calls cache (it's the only place the
    // per-call revenue lives). Call count and the live/concurrent figure come
    // off the Destination record itself (`dailyCalls` / `liveCalls`,
    // backend-computed) — the cache is a completed-call log, so counting
    // `ringing`/`in-progress` rows in it could only ever produce 0.
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    let revenue = 0;
    for (const c of recentCalls) {
      if (c.destinationNumber !== destination.tfn) continue;
      if (c.startedAt >= startMs) revenue += c.revenue;
    }
    const cc = destination.liveCalls;
    const ccPct =
      destination.concurrencyCap > 0 ? (cc / destination.concurrencyCap) * 100 : 0;
    return { calls: destination.dailyCalls, revenue, cc, ccPct };
  }, [destination, recentCalls]);

  const tiles = [
    {
      icon: PhoneCall,
      label: t("networkUI.destinations.stats.callsToday"),
      value: formatCompact(stats.calls),
    },
    {
      icon: DollarSign,
      label: t("networkUI.destinations.stats.revenueToday"),
      value: formatCurrency(stats.revenue),
    },
    {
      icon: Activity,
      label: t("networkUI.destinations.stats.concurrentNow"),
      value: `${stats.cc} / ${destination.concurrencyCap}`,
    },
    {
      icon: Gauge,
      label: t("networkUI.destinations.stats.ccUtilization"),
      value: formatPercent(stats.ccPct, 0),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon;
        return (
          <div
            key={t.label}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-4"
          >
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="text-lg font-semibold tabular-nums">{t.value}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t.label}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

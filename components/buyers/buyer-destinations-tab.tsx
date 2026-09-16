"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Target } from "lucide-react";

import { DestinationBuilder } from "@/components/destinations/destination-builder";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useCallsStore } from "@/lib/store/calls-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { formatCurrency, formatNumber, toE164 } from "@/lib/format";
import type { Buyer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BuyerDestinationsTabProps {
  buyer: Buyer;
}

export function BuyerDestinationsTab({ buyer }: BuyerDestinationsTabProps) {
  const { t } = useTranslation();
  // Select the stable array, filter outside the selector to avoid Zustand v5's
  // useSyncExternalStore infinite-render trap (React error #185).
  const allDestinations = useDestinationsStore((s) => s.destinations);
  const destinations = useMemo(
    () => allDestinations.filter((d) => d.buyerId === buyer.id),
    [allDestinations, buyer.id],
  );
  const [builderOpen, setBuilderOpen] = useState(false);
  const recentCalls = useCallsStore((s) => s.recent);

  // Per-TFN revenue from today, recomputed when the calls cache refreshes.
  // Call counts and the live/concurrent figure come straight off each
  // Destination record (`dailyCalls` / `liveCalls`, backend-computed) — the
  // calls cache is a completed-call log, so counting `ringing`/`in-progress`
  // rows in it could only ever produce 0.
  const revenueByTfn = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const startMs = start.getTime();
    const m = new Map<string, number>();
    for (const c of recentCalls) {
      if (c.startedAt >= startMs) {
        m.set(c.destinationNumber, (m.get(c.destinationNumber) ?? 0) + c.revenue);
      }
    }
    return m;
  }, [recentCalls]);

  if (destinations.length === 0) {
    return (
      <>
        <EmptyState
          icon={Target}
          tone="cyan"
          title={t("networkUI.buyers.destinations.emptyTitle")}
          description={t("networkUI.buyers.destinations.emptyDesc")}
          actions={
            <Button onClick={() => setBuilderOpen(true)}>
              <Plus className="h-4 w-4" /> {t("networkUI.buyers.destinations.add")}
            </Button>
          }
        />
        <DestinationBuilder open={builderOpen} onOpenChange={setBuilderOpen} />
      </>
    );
  }

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {destinations.length}{" "}
          {destinations.length === 1
            ? t("networkUI.buyers.destinations.countOne")
            : t("networkUI.buyers.destinations.countOther")}
          {" · "}
          {t("networkUI.buyers.destinations.eachConcurrency")}
        </p>
        <Button size="sm" onClick={() => setBuilderOpen(true)}>
          <Plus className="h-4 w-4" /> {t("networkUI.buyers.destinations.add")}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {destinations.map((d) => {
          const callsToday = d.dailyCalls;
          const revenueToday = revenueByTfn.get(d.tfn) ?? 0;
          const cc = d.liveCalls;
          const capPct = d.dailyCap > 0 ? Math.min(100, (callsToday / d.dailyCap) * 100) : 0;
          const capColor =
            capPct >= 90 ? "bg-destructive" :
            capPct >= 70 ? "bg-[color:var(--warning)]" :
            "bg-accent";
          return (
            <Card
              key={d.id}
              className="overflow-hidden transition-all hover:-translate-y-0.5 hover:border-accent/40"
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`${ROUTES.destinations}/${d.id}`}
                      className="block truncate text-sm font-semibold transition-colors hover:text-accent"
                    >
                      {d.name}
                    </Link>
                    <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                      {toE164(d.tfn)}
                    </p>
                  </div>
                  {d.enabled ? (
                    <Badge variant="success">{t("networkUI.buyers.destinations.active")}</Badge>
                  ) : (
                    <Badge variant="outline">{t("networkUI.buyers.destinations.disabled")}</Badge>
                  )}
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("networkUI.buyers.destinations.cc")}
                    </dt>
                    <dd className="font-mono">
                      <span className={cn(cc > 0 ? "text-accent" : "text-muted-foreground")}>
                        {cc}
                      </span>
                      <span className="text-muted-foreground"> / {d.concurrencyCap}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("networkUI.buyers.destinations.calls")}
                    </dt>
                    <dd className="font-mono">{formatNumber(callsToday)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">
                      {t("networkUI.buyers.destinations.revenue")}
                    </dt>
                    <dd className="font-mono">{formatCurrency(revenueToday)}</dd>
                  </div>
                </dl>

                {d.dailyCap > 0 && (
                  <div className="mt-3">
                    <div className="mb-1 flex items-baseline justify-between text-[10px] text-muted-foreground">
                      <span className="uppercase tracking-wider">{t("networkUI.buyers.destinations.dailyCap")}</span>
                      <span className="font-mono tabular-nums">
                        {formatNumber(callsToday)} / {formatNumber(d.dailyCap)} · {Math.round(capPct)}%
                      </span>
                    </div>
                    <div className="h-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full transition-[width]", capColor)}
                        style={{ width: `${capPct}%` }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <DestinationBuilder open={builderOpen} onOpenChange={setBuilderOpen} />
    </>
  );
}

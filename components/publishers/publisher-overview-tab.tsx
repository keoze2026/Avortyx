"use client";

import { useMemo } from "react";
import { DollarSign, Hash, PhoneCall, TrendingUp } from "lucide-react";

import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { RecentCallsFeed } from "@/components/dashboard/recent-calls-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompact, formatCurrency, formatPercent, zonedDayKey } from "@/lib/format";
import { useCallsStore } from "@/lib/store/calls-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Publisher } from "@/lib/types";

export function PublisherOverviewTab({ publisher }: { publisher: Publisher }) {
  const { t } = useTranslation();
  const recentCalls = useCallsStore((s) => s.recent);
  const timeZone = useUIStore((s) => s.reportTimezone);
  // Today's calls for this publisher. This chart used to render with no
  // calls at all, which fell back to the static seeded mock series — fake
  // revenue on a real publisher's page.
  const todayCalls = useMemo(() => {
    const today = zonedDayKey(Date.now(), timeZone);
    return recentCalls.filter(
      (c) => c.publisherId === publisher.id && zonedDayKey(c.startedAt, timeZone) === today,
    );
  }, [recentCalls, publisher.id, timeZone]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <RevenueChart calls={todayCalls} dateLabel={t("sharedUI.dateRange.today")} />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("networkUI.publishers.overview.earnings")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("networkUI.publishers.overview.thisMonthLifetime")}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label={t("networkUI.publishers.overview.callsThisMonth")} value={formatCompact(publisher.callsMonth)} icon={PhoneCall} />
            <Row label={t("networkUI.publishers.overview.revenueThisMonth")} value={formatCurrency(publisher.revenueMonth)} icon={DollarSign} />
            <Row
              label={t("networkUI.publishers.overview.payoutShare")}
              value={t("networkUI.publishers.overview.ofBuyerPayout").replace("{pct}", formatPercent(publisher.payoutRate * 100, 0))}
              icon={TrendingUp}
            />
            <Row label={t("networkUI.publishers.overview.numbersAssigned")} value={publisher.numbersAssigned.toString()} icon={Hash} />

            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {t("networkUI.publishers.overview.lifetimeRevenue")}
                </span>
                <span className="font-mono text-base font-bold text-foreground">
                  {formatCurrency(publisher.lifetimeRevenue)}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <RecentCallsFeed />
    </div>
  );
}

function Row({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon: typeof PhoneCall;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="inline-flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5 text-accent" />
        {label}
      </span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

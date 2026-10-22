"use client";

import { motion } from "framer-motion";
import { CheckCircle2, DollarSign, Gauge, PhoneCall, Users } from "lucide-react";

import { BuyerFunnelChart } from "@/components/buyers/buyer-funnel-chart";
import { RecentCallsFeed } from "@/components/dashboard/recent-calls-feed";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import type { Buyer } from "@/lib/types";

export function BuyerOverviewTab({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const dailyUsage = buyer.dailyCap > 0 ? Math.min(1, buyer.callsToday / buyer.dailyCap) : 0;
  const monthlyUsage = buyer.monthlyCap > 0 ? Math.min(1, buyer.callsMonth / buyer.monthlyCap) : 0;

  return (
    <div className="space-y-4">
      {/* No buyer auto-schedule (CH-203): it was saved only in one browser and
          that browser's open tabs paused the buyer for everybody. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <BuyerFunnelChart buyer={buyer} />
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("networkUI.buyers.overview.pacingTitle")}</CardTitle>
            <p className="text-xs text-muted-foreground">{t("networkUI.buyers.overview.pacingDesc")}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <PacingBar
              label={t("networkUI.buyers.overview.daily")}
              consumed={buyer.callsToday}
              cap={buyer.dailyCap}
              usage={dailyUsage}
            />
            <PacingBar
              label={t("networkUI.buyers.overview.monthly")}
              consumed={buyer.callsMonth}
              cap={buyer.monthlyCap}
              usage={monthlyUsage}
            />

            <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border/40 pt-4 text-xs">
              <dt className="text-muted-foreground">{t("networkUI.buyers.overview.concurrencyCap")}</dt>
              <dd className="text-right font-mono">{buyer.concurrencyCap}</dd>
              <dt className="text-muted-foreground">{t("networkUI.buyers.overview.bidModel")}</dt>
              <dd className="text-right font-mono capitalize">{buyer.payoutModel}</dd>
              <dt className="text-muted-foreground">{t("networkUI.buyers.overview.lifetimeSpend")}</dt>
              <dd className="text-right font-mono">{formatCurrency(buyer.lifetimeSpend)}</dd>
            </dl>
          </CardContent>
        </Card>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { icon: PhoneCall, label: t("networkUI.buyers.overview.monthCalls"), value: formatCompact(buyer.callsMonth) },
          { icon: DollarSign, label: t("networkUI.buyers.overview.monthSpend"), value: formatCurrency(buyer.spendMonth) },
          { icon: CheckCircle2, label: t("networkUI.buyers.overview.acceptRate"), value: formatPercent(buyer.acceptRate * 100, 0) },
          { icon: Users, label: t("networkUI.buyers.overview.campaigns"), value: buyer.campaignIds.length.toString() },
        ].map((tile) => {
          const Icon = tile.icon;
          return (
            <div
              key={tile.label}
              className="flex items-center gap-3 rounded-lg border border-border bg-secondary/30 p-3"
            >
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <div className="font-mono text-lg font-semibold">{tile.value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{tile.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      <RecentCallsFeed />
    </div>
  );
}

function PacingBar({
  label,
  consumed,
  cap,
  usage,
}: {
  label: string;
  consumed: number;
  cap: number;
  usage: number;
}) {
  const pct = Math.round(usage * 100);
  const danger = usage > 0.85;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="inline-flex items-center gap-1.5">
          <Gauge className={`h-3.5 w-3.5 ${danger ? "text-[color:var(--warning)]" : "text-accent"}`} />
          <span className="font-medium">{label}</span>
        </span>
        <span className="font-mono">
          {formatCompact(consumed)} / {cap === 0 ? "∞" : formatCompact(cap)}
          <span className={`ml-1 ${danger ? "text-[color:var(--warning)]" : "text-muted-foreground"}`}>
            {cap === 0 ? "" : `(${pct}%)`}
          </span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-secondary/60">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`h-full rounded-full ${
            danger
              ? "bg-gradient-to-r from-[color:var(--warning)] to-[color:var(--destructive)]"
              : "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--vortyx-cyan)]"
          }`}
        />
      </div>
    </div>
  );
}

"use client";

import { TrendingDown, TrendingUp } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useCountUp } from "@/hooks/use-count-up";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompact, formatCurrency, formatDuration, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

interface KpiRowProps {
  callsToday: number;
  revenueToday: number;
  conversionRate: number; // 0..1
  avgDurationSec: number;
}

interface KpiConfig {
  label: string;
  labelKey: string;
  value: number;
  format: (v: number) => string;
  delta: number;
}

export function KpiRow({ callsToday, revenueToday, conversionRate, avgDurationSec }: KpiRowProps) {
  const kpis: KpiConfig[] = [
    {
      label: "Revenue",
      labelKey: "dashboard.revenue",
      value: revenueToday,
      format: (v) => formatCurrency(v),
      delta: 8.7,
    },
    {
      label: "Calls",
      labelKey: "dashboard.calls",
      value: callsToday,
      format: (v) => formatCompact(Math.round(v)),
      delta: 12.4,
    },
    {
      label: "Conv. rate",
      labelKey: "toolsUI.reports.summary.columns.conversionRate",
      value: conversionRate * 100,
      format: (v) => formatPercent(v),
      delta: -2.1,
    },
    {
      label: "Avg dur.",
      labelKey: "x5.kpi.avgDuration",
      value: avgDurationSec,
      format: (v) => formatDuration(Math.round(v)),
      delta: 5.2,
    },
  ];

  return (
    <Card className="overflow-hidden p-0">
      <div className="grid grid-cols-2 lg:grid-cols-4">
        {kpis.map((k, i) => (
          <div
            key={k.label}
            className={cn(
              "px-5 py-5",
              i % 2 === 1 && "border-l border-border",
              i >= 2 && "border-t border-border",
              "lg:border-t-0",
              i > 0 && "lg:border-l lg:border-border",
            )}
          >
            <KpiSection {...k} />
          </div>
        ))}
      </div>
    </Card>
  );
}

function KpiSection({ labelKey, value, format, delta }: KpiConfig) {
  const { t } = useTranslation();
  const animated = useCountUp(value);
  const positive = delta >= 0;
  return (
    <div className="min-w-0">
      <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground/80 truncate">
        {t(labelKey)}
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <span className="truncate text-2xl font-semibold tabular-nums tracking-tight text-foreground">
          {format(animated)}
        </span>
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
            positive
              ? "bg-[color:var(--success)]/12 text-[color:var(--success)]"
              : "bg-destructive/12 text-destructive",
          )}
        >
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {positive ? "+" : ""}
          {delta.toFixed(1)}%
        </span>
      </div>
    </div>
  );
}

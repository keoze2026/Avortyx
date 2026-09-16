"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";
import { bucketHourlyZoned } from "@/lib/dashboard-buckets";
import { formatCurrency } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";

interface RevenueChartProps {
  /** The selected day's calls — already date-scoped by the page. */
  calls: Call[];
  /** Shown under the title so the figure is never mistaken for "today". */
  dateLabel: string;
}

/**
 * Revenue by hour for one selected day.
 *
 * This used to bucket through `bucketHourly`, which silently dropped every
 * call before *today's* local midnight — so any historical date rendered as
 * a flat $0 line no matter what the page had fetched. It also carried its own
 * "24h / 14d" toggle, which has nothing to toggle to now that the dashboard
 * is a single-date view: the page's date picker is the only time control.
 */
export function RevenueChart({ calls, dateLabel }: RevenueChartProps) {
  const { t } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const data = React.useMemo(
    () => bucketHourlyZoned(calls, timeZone).map((p) => ({ x: p.label, revenue: p.revenue })),
    [calls, timeZone],
  );

  const total = data.reduce((s, p) => s + p.revenue, 0);
  const peak = data.length ? Math.max(...data.map((p) => p.revenue)) : 0;
  const avg = Math.round(total / Math.max(data.length, 1));

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{t("dashboard.revenue")}</CardTitle>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(total)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("dashboard.chart.peak")} {formatCurrency(peak)} · {t("dashboard.chart.avg")} {formatCurrency(avg)}
            </span>
          </div>
        </div>
        <span className="rounded-md border border-border bg-muted/30 px-2 py-1 text-[11px] font-medium tabular-nums text-muted-foreground">
          {dateLabel}
        </span>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 12, right: 8, left: -12, bottom: 0 }}>
              <defs>
                {/* Fill — single indigo fading to transparent */}
                <linearGradient id="rev-step-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.40} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                minTickGap={24}
                tickMargin={8}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                width={48}
              />
              <ReferenceLine
                y={avg}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.55}
                label={{
                  value: `avg`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <Tooltip
                {...CHART_TOOLTIP_PROPS}
                cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4, strokeWidth: 1 }}
                formatter={(value: number) => [formatCurrency(value), t("dashboard.revenue")]}
              />
              <Area
                type="stepAfter"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#rev-step-fill)"
                dot={{
                  r: 2.5,
                  stroke: "var(--accent)",
                  strokeWidth: 1.5,
                  fill: "var(--card)",
                }}
                activeDot={{
                  r: 4,
                  stroke: "var(--accent)",
                  strokeWidth: 2,
                  fill: "var(--card)",
                }}
                isAnimationActive
                animationDuration={500}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

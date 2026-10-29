"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
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
import { usePartnerHiddenColumns } from "@/hooks/use-partner-report-columns";
import { useAuthStore } from "@/lib/store/auth-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";

interface RevenueChartProps {
  /** The selected day's calls — already date-scoped by the page. */
  calls: Call[];
  /** Shown under the title so the figure is never mistaken for "today". */
  dateLabel: string;
  /** Hourly points (e.g. from the dashboard snapshot). When passed, revenue
   *  per hour is read from these instead of summing `calls`. `period` carries
   *  the report timezone's offset, so its hour is read as-is. */
  series?: Array<{ period: string; revenue: number; payout?: number }>;
}

/**
 * Which money this login is shown, from its own calls only (the server
 * already sends a partner only their own calls):
 *   admin / staff -> Revenue  (what the calls were sold for)
 *   publisher     -> Earnings (their payout - what we pay them)
 *   buyer         -> Spend    (what they pay us for the calls they received)
 * A publisher never gets revenue and a buyer never gets payout from the
 * server, which is why this card used to be empty for them.
 */
function useMoneyView() {
  const role = useAuthStore((s) => s.user?.role);
  const hidden = usePartnerHiddenColumns().summary;
  if (role === "publisher") {
    return { metric: "payout" as const, titleKey: "partnerMoney.earnings", hidden: hidden.has("payout") };
  }
  if (role === "buyer") {
    return { metric: "revenue" as const, titleKey: "partnerMoney.spend", hidden: hidden.has("revenue") };
  }
  return { metric: "revenue" as const, titleKey: "dashboard.revenue", hidden: false };
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
export function RevenueChart({ calls, dateLabel, series }: RevenueChartProps) {
  const { t } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const view = useMoneyView();
  const title = t(view.titleKey);
  // The plotted value is kept in the `revenue` field so the chart below is unchanged.
  const data = React.useMemo(() => {
    if (series) {
      const hours = bucketHourlyZoned([], timeZone).map((p) => ({ x: p.label, revenue: 0 }));
      for (const p of series) {
        const h = Number(p.period.slice(11, 13));
        if (!Number.isFinite(h) || h < 0 || h >= 24) continue;
        hours[h].revenue += (view.metric === "payout" ? p.payout : p.revenue) || 0;
      }
      return hours;
    }
    const source =
      view.metric === "payout" ? calls.map((c) => ({ ...c, revenue: c.payout || 0 })) : calls;
    return bucketHourlyZoned(source, timeZone).map((p) => ({ x: p.label, revenue: p.revenue || 0 }));
  }, [calls, series, timeZone, view.metric]);

  const total = data.reduce((s, p) => s + p.revenue, 0);
  const peak = data.length ? Math.max(...data.map((p) => p.revenue)) : 0;
  const avg = Math.round(total / Math.max(data.length, 1));
  // CH-398 (Sir's design): the peak hour is marked on the curve, "$173 at 12 PM".
  const peakIndex = peak > 0 ? data.findIndex((p) => p.revenue === peak) : -1;
  const peakTime = (() => {
    const h = peakIndex >= 0 ? Number(String(data[peakIndex].x).slice(0, 2)) : NaN;
    return Number.isFinite(h) ? `${h % 12 || 12} ${h < 12 ? "AM" : "PM"}` : "";
  })();
  // One label every 3 hours: 00:00, 03:00 ... 21:00.
  const ticks = data.filter((_, i) => i % 3 === 0).map((p) => p.x);

  // The admin unticked this money under the partner's Reporting visibility.
  if (view.hidden) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-10 text-center text-xs text-muted-foreground">{t("partnerMoney.notShown")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatCurrency(total)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("dashboard.chart.peak")} {formatCurrency(peak)} · {t("dashboard.chart.avg")} {formatCurrency(avg)}
              {t("x398.perHour")}
            </span>
          </div>
        </div>
        <span className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium tabular-nums text-foreground">
          {dateLabel}
        </span>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 28, right: 22, left: 22, bottom: 0 }}>
              <defs>
                {/* Fill - the theme accent fading to transparent */}
                <linearGradient id="rev-smooth-fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="x"
                ticks={ticks}
                interval={0}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={{ stroke: "var(--border)" }}
                tickLine={false}
                tickMargin={10}
              />
              {/* Scale only - Sir's design shows no y-axis numbers. */}
              <YAxis hide domain={[0, (max: number) => (max > 0 ? max * 1.15 : 1)]} />
              <ReferenceLine
                y={avg}
                stroke="var(--muted-foreground)"
                strokeDasharray="4 4"
                strokeOpacity={0.45}
                label={{
                  value: `${t("dashboard.chart.avg")} ${formatCurrency(avg)}`,
                  position: "insideTopRight",
                  fontSize: 10,
                  fill: "var(--muted-foreground)",
                }}
              />
              <Tooltip
                {...CHART_TOOLTIP_PROPS}
                cursor={{ stroke: "var(--accent)", strokeOpacity: 0.4, strokeWidth: 1 }}
                formatter={(value: number) => [formatCurrency(value), title]}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="var(--accent)"
                strokeWidth={2.5}
                fill="url(#rev-smooth-fill)"
                // Only the peak hour gets a dot, with its amount and time.
                dot={(props: { cx?: number; cy?: number; index?: number }) => {
                  const { cx, cy, index } = props;
                  if (index !== peakIndex || cx == null || cy == null) {
                    return <g key={`d-${index}`} />;
                  }
                  return (
                    <g key="peak">
                      <circle cx={cx} cy={cy} r={9} fill="var(--accent)" fillOpacity={0.25} />
                      <circle cx={cx} cy={cy} r={5} fill="#fff" stroke="var(--accent)" strokeWidth={2} />
                      <text
                        x={cx}
                        y={cy - 16}
                        textAnchor="middle"
                        fontSize={11}
                        fontWeight={600}
                        fill="var(--foreground)"
                      >
                        {t("x398.peakAt")
                          .replace("{amount}", formatCurrency(peak))
                          .replace("{time}", peakTime)}
                      </text>
                    </g>
                  );
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
"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  referralsService,
  type SpendPoint,
  type SpendingTrackerDays,
} from "@/lib/api/services/referrals.service";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type RangeId = "14d" | "30d" | "90d";

const RANGES: Array<{ id: RangeId; label: string; days: SpendingTrackerDays }> = [
  { id: "14d", label: "14d", days: 14 },
  { id: "30d", label: "30d", days: 30 },
  { id: "90d", label: "90d", days: 90 },
];

interface Bucket {
  label: string;
  ts: number;
  spend: number;
  commission: number;
}

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Format the per-bar X-axis label depending on the window width — "3. Sep"
 *  like the other date axes; a bare day number when 30 bars have to fit. */
function labelFor(ts: number, days: number): string {
  const date = new Date(ts);
  if (days > 14 && days <= 30) return `${date.getDate()}`;
  return `${date.getDate()}. ${MONTH_ABBR[date.getMonth()]}`;
}

export function ReferralSpendChart() {
  const { t } = useTranslation();
  const [range, setRange] = React.useState<RangeId>("30d");
  const [points, setPoints] = React.useState<SpendPoint[]>([]);
  const [loading, setLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch the time series whenever the selected range changes. The hook
  // tracks a `cancelled` flag so stale responses can't overwrite newer data
  // when the user clicks 14d/30d/90d rapidly.
  React.useEffect(() => {
    const days = RANGES.find((r) => r.id === range)?.days ?? 30;
    let cancelled = false;
    setLoading(true);
    setError(null);

    referralsService
      .getSpendingTracker(days)
      .then((res) => {
        if (cancelled) return;
        setPoints(res);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(friendlyErrorMessage(e, "Couldn't load spending tracker"));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [range]);

  const days = RANGES.find((r) => r.id === range)?.days ?? 30;

  const data = React.useMemo<Bucket[]>(
    () =>
      points.map((p) => ({
        label: labelFor(p.ts, days),
        ts: p.ts,
        spend: p.spend,
        commission: p.commission,
      })),
    [points, days],
  );

  const totals = React.useMemo(() => {
    let spend = 0;
    let commission = 0;
    for (const d of data) {
      spend += d.spend;
      commission += d.commission;
    }
    return { spend, commission };
  }, [data]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{t("toolsUI.referrals.chart.title")}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {t("toolsUI.referrals.chart.description").replace("{pct}", "5")}
          </p>
          <div className="mt-2 flex items-baseline gap-3">
            <span className="text-xl font-semibold tabular-nums">
              {formatCurrency(totals.spend)}
            </span>
            <span className="text-[11px] text-muted-foreground">{t("toolsUI.referrals.chart.spendLabel")}</span>
            <span className="text-[11px] tabular-nums text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
              · {formatCurrency(totals.commission)}{t("toolsUI.referrals.chart.earnedSuffix")}
            </span>
          </div>
        </div>
        <div
          role="tablist"
          aria-label={t("toolsUI.referrals.chart.rangeAria")}
          className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
        >
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-[5px] px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            );
          })}
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative h-72 w-full">
          {/* Loading veil — keeps the chart frame in place while data refetches
              so the page doesn't jump on range changes. */}
          {loading && (
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-card/60 backdrop-blur-[1px]">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          )}
          {error && !loading ? (
            <div className="flex h-full items-center justify-center text-xs text-destructive">
              {error}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 12, right: 36, left: -8, bottom: 0 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  minTickGap={16}
                  tickMargin={8}
                />
                <YAxis
                  yAxisId="spend"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={48}
                  tickFormatter={(v: number) => {
                    if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
                    return `$${v.toFixed(0)}`;
                  }}
                />
                <YAxis
                  yAxisId="commission"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  tickFormatter={(v: number) => {
                    if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
                    return `$${v.toFixed(0)}`;
                  }}
                />
                <Tooltip
                  {...CHART_TOOLTIP_PROPS}
                  cursor={false}
                  formatter={(v: number, name) => [
                    formatCurrency(v, true),
                    name === "spend" ? t("toolsUI.referrals.chart.spend") : t("toolsUI.referrals.chart.yourCommission"),
                  ]}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                  iconSize={8}
                  formatter={(v) => (v === "spend" ? t("toolsUI.referrals.chart.spend") : t("toolsUI.referrals.chart.yourCommission"))}
                />
                <Bar
                  yAxisId="spend"
                  dataKey="spend"
                  fill="var(--accent)"
                  radius={[3, 3, 0, 0]}
                  isAnimationActive
                  animationDuration={500}
                />
                <Line
                  yAxisId="commission"
                  type="monotone"
                  dataKey="commission"
                  stroke="oklch(0.62 0.18 155)"
                  strokeWidth={2}
                  dot={{
                    r: 2,
                    stroke: "oklch(0.62 0.18 155)",
                    strokeWidth: 1.5,
                    fill: "var(--card)",
                  }}
                  activeDot={{
                    r: 4,
                    stroke: "oklch(0.62 0.18 155)",
                    strokeWidth: 2,
                    fill: "var(--card)",
                  }}
                  isAnimationActive
                  animationDuration={500}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

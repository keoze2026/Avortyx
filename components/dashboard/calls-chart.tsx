"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";
import { bucketDaily, bucketHourly } from "@/lib/dashboard-buckets";
import { formatNumber } from "@/lib/format";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

type Range = "24h" | "14d";

const RANGES: Array<{ id: Range; label: string }> = [
  { id: "24h", label: "Today" },
  { id: "14d", label: "14 days" },
];

// Both bars use the active theme accent; the peak gets a CSS brightness
// filter so it stands out without introducing a second hue (and so theme
// swaps recolor every bar).
const BAR_COLOR = "var(--accent)";

interface CallsChartProps {
  /** The calls to chart. None = an empty chart (CH-414: never sample data). */
  calls?: Call[];
}

export function CallsChart({ calls }: CallsChartProps = {}) {
  const { t } = useTranslation();
  const [range, setRange] = React.useState<Range>("24h");
  const hourly = React.useMemo(
    // CH-414: real calls only - no calls handed in means an empty chart, never samples.
    () => bucketHourly(calls ?? []),
    [calls],
  );
  const daily = React.useMemo(
    () => bucketDaily(calls ?? [], 14),
    [calls],
  );
  const data =
    range === "24h"
      ? hourly.map((p) => ({ x: p.label.slice(0, 2), calls: p.calls, full: p.label }))
      : daily.map((p) => ({ x: p.label, calls: p.calls, full: p.label }));

  const total = data.reduce((s, p) => s + p.calls, 0);
  const peak = Math.max(...data.map((p) => p.calls));
  const avg = Math.round(total / Math.max(data.length, 1));
  const peakPoint = data.find((p) => p.calls === peak);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{t("y.chart.calls")}</CardTitle>
          <div className="mt-1.5 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight tabular-nums">
              {formatNumber(total)}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {t("y.chart.peak").replace("{n}", formatNumber(peak))}
              {range === "24h" && peakPoint ? ` ${t("y.chart.at").replace("{time}", peakPoint.full)}` : null}
              {" · "}
              {t("y.chart.avg").replace("{n}", formatNumber(avg))}
            </span>
          </div>
        </div>
        <div className="flex gap-1 rounded-md border border-border bg-muted p-0.5">
          {RANGES.map((r) => (
            <button
              key={r.id}
              onClick={() => setRange(r.id)}
              className={cn(
                "rounded px-2.5 py-1 text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                range === r.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`y.chart.range.${r.id}`)}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              // Bumped left margin so the YAxis has room for 3-digit ticks
              // (e.g. 600 / 750) without clipping the leading digit.
              margin={{ top: 12, right: 8, left: 0, bottom: 8 }}
              barCategoryGap={range === "24h" ? "18%" : "26%"}
            >
              <defs>
                {/* Both bars share the theme accent; the peak gets a
                    brightness filter on the cell to stand out. */}
                <linearGradient id="calls-bar-grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={BAR_COLOR} stopOpacity={1} />
                  <stop offset="100%" stopColor={BAR_COLOR} stopOpacity={1} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="x"
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                // Dashed baseline at y=0 — matches the rest of the CartesianGrid
                // so the chart floor reads as a gridline instead of a hard edge.
                axisLine={{ stroke: "var(--border)", strokeDasharray: "3 3" }}
                tickLine={false}
                interval={range === "24h" ? 2 : 0}
                tickMargin={10}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                // Widen the gutter so 3-4 digit tick labels (600, 1.2K) fit
                // without the leading digit getting clipped.
                width={48}
                allowDecimals={false}
              />
              <Tooltip
                {...CHART_TOOLTIP_PROPS}
                cursor={false}
                formatter={(value: number) => [formatNumber(value), "Calls"]}
                labelFormatter={(_, payload) => payload?.[0]?.payload?.full ?? ""}
              />
              <Bar
                dataKey="calls"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={500}
              >
                {data.map((d) => (
                  <Cell
                    key={d.x}
                    fill="url(#calls-bar-grad)"
                    style={
                      d.calls === peak
                        ? { filter: "brightness(1.25) saturate(1.1)" }
                        : undefined
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

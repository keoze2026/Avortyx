"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import type { Call } from "@/lib/types";
import { formatCurrency, formatNumber, zonedDayKey, zonedHour } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

type Grain = "H" | "D" | "M";

const GRAINS: Array<{ id: Grain; label: string }> = [
  { id: "H", label: "H" },
  { id: "D", label: "D" },
  { id: "M", label: "M" },
];

// Strict two-color binary: indigo for the positive outcome, red for the rest.
// "Not converted" and "No answer" both ride the destructive red so the chart
// reads as good-vs-bad at a glance; "No answer" sits at full strength while
// "Not converted" steps down in opacity to keep them distinguishable.
const COLOR_CONVERTED = "var(--accent)";
const COLOR_NOTCONV = "var(--destructive)";
const COLOR_NOANS = "var(--destructive)";
const COLOR_REVENUE = "var(--accent)";

interface HourlyDistributionProps {
  calls: Call[];
}

interface Bucket {
  label: string;
  /** Start-of-bucket timestamp (ms). Drives the tooltip header. */
  ts: number;
  converted: number;
  notConverted: number;
  noAnswer: number;
  revenue: number;
}

/** Binary classification — collapsed from three categories to two so the
 *  chart and donut tell the same story:
 *    "converted" — call connected and qualified (paying conversion)
 *    "noAnswer"  — everything else (missed, rejected, failed, in-flight)
 *
 *  The legacy `notConverted` bucket is kept in the Bucket type with a
 *  permanent 0 so the chart's data shape doesn't break, but no calls are
 *  routed to it at runtime. */
function classify(c: Call): "converted" | "noAnswer" {
  if (c.status === "completed" && c.payout > 0) return "converted";
  return "noAnswer";
}

/** Format an hour 0-23 as zero-padded 12-hour with lowercase am/pm —
 *  e.g. 0 → "12:00 am", 13 → "01:00 pm". Matches the advertising
 *  reference format ("02:00 am" · "04:00 am" · …). */
function fmt12Hour(h: number): string {
  const period = h < 12 ? "am" : "pm";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display.toString().padStart(2, "0")}:00 ${period}`;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-08-29" → the UTC-midnight instant for that key. Day keys are
 *  already timezone-resolved, so plain UTC arithmetic on them is exact —
 *  no DST drift. */
function dayKeyToUtcMs(key: string): number {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function utcMsToDayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** "MM-DD" axis label for a day key. */
function dayKeyLabel(key: string): string {
  const [, m, d] = key.split("-");
  return `${m}-${d}`;
}

/**
 * The day the window of D / M buckets ends on: the most recent call in the
 * set, falling back to today. Anchoring on `Date.now()` instead meant that
 * selecting any historical range slid every call out of the window and the
 * chart rendered flat while the donut beside it showed the right total.
 */
function anchorDayKey(calls: Call[], timeZone: string): string {
  let latest = -Infinity;
  for (const c of calls) if (c.startedAt > latest) latest = c.startedAt;
  return zonedDayKey(Number.isFinite(latest) ? latest : Date.now(), timeZone);
}

function bucketize(calls: Call[], grain: Grain, timeZone: string): Bucket[] {
  if (grain === "H") {
    // Hour-of-day distribution across every call handed in. The caller has
    // already scoped the set to the selected date range, so this must not
    // re-filter to "today" — doing that emptied the chart for every
    // historical range. Hours are resolved in the report timezone, not the
    // viewer's, so the peaks line up with the times shown in the Call Log.
    const slots: Bucket[] = Array.from({ length: 24 }, (_, h) => ({
      label: fmt12Hour(h),
      ts: h,
      converted: 0,
      notConverted: 0,
      noAnswer: 0,
      revenue: 0,
    }));
    for (const c of calls) {
      const hour = zonedHour(c.startedAt, timeZone);
      if (!Number.isFinite(hour) || hour < 0 || hour >= 24) continue;
      const k = classify(c);
      slots[hour][k] += 1;
      slots[hour].revenue += c.revenue;
    }
    return slots;
  }

  const anchorMs = dayKeyToUtcMs(anchorDayKey(calls, timeZone));

  if (grain === "D") {
    // 14 days ending on the most recent day in the set.
    const days = 14;
    const keys = Array.from({ length: days }, (_, i) =>
      utcMsToDayKey(anchorMs - (days - 1 - i) * DAY_MS),
    );
    const indexByKey = new Map(keys.map((k, i) => [k, i]));
    const slots: Bucket[] = keys.map((key) => ({
      label: dayKeyLabel(key),
      ts: dayKeyToUtcMs(key),
      converted: 0,
      notConverted: 0,
      noAnswer: 0,
      revenue: 0,
    }));
    for (const c of calls) {
      const idx = indexByKey.get(zonedDayKey(c.startedAt, timeZone));
      if (idx === undefined) continue;
      const k = classify(c);
      slots[idx][k] += 1;
      slots[idx].revenue += c.revenue;
    }
    return slots;
  }

  // M: the 35 days ending on the anchor, grouped into 5 weekly buckets.
  const weeks = 5;
  const slots: Bucket[] = Array.from({ length: weeks }, (_, i) => {
    const startMs = anchorMs - (weeks - 1 - i) * 7 * DAY_MS;
    return {
      label: dayKeyLabel(utcMsToDayKey(startMs)),
      ts: startMs,
      converted: 0,
      notConverted: 0,
      noAnswer: 0,
      revenue: 0,
    };
  });
  for (const c of calls) {
    const callDayMs = dayKeyToUtcMs(zonedDayKey(c.startedAt, timeZone));
    const offsetDays = Math.round((anchorMs - callDayMs) / DAY_MS);
    if (offsetDays < 0 || offsetDays >= weeks * 7) continue;
    const weekFromOldest = weeks - 1 - Math.floor(offsetDays / 7);
    const k = classify(c);
    slots[weekFromOldest][k] += 1;
    slots[weekFromOldest].revenue += c.revenue;
  }
  return slots;
}

export function HourlyDistribution({ calls }: HourlyDistributionProps) {
  const { t } = useTranslation();
  const timeZone = useUIStore((s) => s.reportTimezone);
  const [grain, setGrain] = React.useState<Grain>("H");
  // Track the actual CHART CONTAINER width via ResizeObserver — the
  // viewport can be 1200px while the chart card only gets ~600px because
  // of the sidebar + donut neighbour. Three tiers:
  //   ≥ 760px → full "08:00 am" labels, every 2 hours
  //   500–759 → compact "8a" labels,    every 2 hours
  //   < 500px → compact "8a" labels,    every 4 hours
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = React.useState(1024);
  React.useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const useCompactLabel = containerWidth < 760;
  const tickInterval = containerWidth < 500 ? 3 : 1;
  // Buckets + a derived `total` field so the LabelList on the topmost bar
  // can render the column's full call count above the stack (matching the
  // advertising reference: "181 · 267 · 444 · 607 · …" labels per column).
  const data = React.useMemo(
    () =>
      bucketize(calls, grain, timeZone).map((b) => ({
        ...b,
        total: b.converted + b.notConverted + b.noAnswer,
      })),
    [calls, grain, timeZone],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5">
          {GRAINS.map((g) => (
            <button
              key={g.id}
              onClick={() => setGrain(g.id)}
              className={cn(
                "h-7 w-7 rounded text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                grain === g.id
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex-1 text-center text-xs text-muted-foreground">
          {t("dashboard.chart.callsByHour")}
        </div>
      </CardHeader>
      <CardContent>
        <div ref={containerRef} className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 12, right: 4, left: 4, bottom: 0 }}>
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                // Responsive hour-grain ticks driven by the *chart container*
                // width (not viewport) so the labels adapt even when the
                // sidebar + donut squeeze the chart card down to ~600px on a
                // wide screen. See `useCompactLabel` / `tickInterval` above
                // for the three-tier rules.
                interval={grain === "H" ? tickInterval : "preserveStartEnd"}
                minTickGap={grain === "H" ? 0 : 12}
                tickMargin={8}
                tickFormatter={(label: string) => {
                  if (grain !== "H" || !useCompactLabel) return label;
                  // Collapse "08:00 am" → "8am" / "12:00 pm" → "12pm" so the
                  // axis fits inside a narrow chart card without dropping
                  // the readable am/pm suffix.
                  const m = label.match(/^(\d{2}):00 (am|pm)$/);
                  if (!m) return label;
                  return `${parseInt(m[1], 10)}${m[2]}`;
                }}
              />
              <YAxis
                yAxisId="count"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                // 3-digit ticks (e.g. 600, 750) need at least ~44px so the
                // leading digit isn't clipped on narrow mobile viewports.
                width={44}
                allowDecimals={false}
                tickMargin={4}
              />
              {/* Right-side revenue axis — $ ticks for the Revenue line. */}
              <YAxis
                yAxisId="rev"
                orientation="right"
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(v: number) => {
                  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
                  return `$${v}`;
                }}
              />
              <Tooltip
                cursor={{ fill: "var(--muted)", fillOpacity: 0.5 }}
                content={<HourlyTooltipWrapper grain={grain} />}
              />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 8 }}
                iconSize={8}
                // Filter out the now-hidden `notConverted` entry — only show
                // Converted, No Answer, and Revenue in the legend so it
                // matches the simplified 2-category donut.
                payload={[
                  { value: "converted",  type: "square", color: COLOR_CONVERTED },
                  { value: "noAnswer",   type: "square", color: COLOR_NOANS },
                  { value: "revenue",    type: "square", color: COLOR_REVENUE },
                ]}
                formatter={(v) =>
                  v === "converted"
                    ? t("toolsUI.reports.hourly.legend.converted")
                    : v === "noAnswer"
                      ? t("toolsUI.reports.hourly.legend.noAnswer")
                      : t("toolsUI.reports.hourly.legend.revenue")
                }
              />
              {/* Stack order — bottom to top:
                   1. noAnswer    (red sliver at bottom)
                   2. converted   (purple, dominant, top of stack)
                  The old `notConverted` (yellow) segment was removed
                  entirely so the chart matches the 2-category donut:
                  Total = Converted + No Answer. */}
              <Bar
                yAxisId="count"
                dataKey="noAnswer"
                stackId="calls"
                fill={COLOR_NOANS}
                radius={[0, 0, 0, 0]}
              />
              <Bar
                yAxisId="count"
                dataKey="converted"
                stackId="calls"
                fill={COLOR_CONVERTED}
                radius={[3, 3, 0, 0]}
              >
                {/* Total-count label above each stacked column. Lives on the
                    topmost bar (converted) so the label sits above the full
                    stack height. `total` is the pre-computed sum of all
                    three segments; hidden when 0 so empty hours stay clean. */}
                <LabelList
                  dataKey="total"
                  position="top"
                  offset={6}
                  fill="var(--foreground)"
                  fontSize={10}
                  fontWeight={600}
                  formatter={(v: number) => (v > 0 ? formatNumber(v) : "")}
                />
              </Bar>
              <Line
                yAxisId="rev"
                type="monotone"
                dataKey="revenue"
                stroke={COLOR_REVENUE}
                strokeWidth={2}
                dot={{ r: 2, stroke: COLOR_REVENUE, strokeWidth: 1.5, fill: "var(--card)" }}
                activeDot={{ r: 4, stroke: COLOR_REVENUE, strokeWidth: 2, fill: "var(--card)" }}
                isAnimationActive
                animationDuration={500}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Custom tooltip                                                      */
/* ─────────────────────────────────────────────────────────────────── */

interface TooltipPayload {
  payload?: Bucket;
}

interface HourlyTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  grain: Grain;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function headerForBucket(b: Bucket, grain: Grain, weekOfLabel: string): string {
  if (grain === "H") {
    // An H bucket is an hour-of-day across the whole selected range, not one
    // hour of one day — so the header is just the hour: "01:00 pm".
    return b.label;
  }
  // D / M buckets carry a UTC-midnight instant for an already
  // timezone-resolved day, so read them with the UTC getters — the local
  // ones would slide the label a day for viewers west of UTC.
  const d = new Date(b.ts);
  if (grain === "D") {
    // "Friday, May 29"
    return `${DOW[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
  }
  // M: "Week of May 22"
  return `${weekOfLabel} ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

function HourlyTooltipWrapper(props: HourlyTooltipProps) {
  const { t } = useTranslation();
  return <HourlyTooltipInner {...props} t={t} />;
}

function HourlyTooltipInner({ active, payload, grain, t }: HourlyTooltipProps & { t: (k: string) => string }) {
  if (!active || !payload || payload.length === 0) return null;
  const b = payload[0]?.payload;
  if (!b) return null;

  const total = b.converted + b.notConverted + b.noAnswer;
  const rows: Array<{ color: string; label: string; value: string }> = [
    { color: "var(--muted-foreground)", label: t("toolsUI.reports.hourly.tooltip.totalCalls"), value: formatNumber(total) },
    { color: COLOR_CONVERTED, label: t("toolsUI.reports.hourly.tooltip.converted"), value: formatNumber(b.converted) },
    { color: COLOR_NOTCONV, label: t("toolsUI.reports.hourly.tooltip.notConverted"), value: formatNumber(b.notConverted) },
    { color: COLOR_NOANS, label: t("toolsUI.reports.hourly.tooltip.noAnswer"), value: formatNumber(b.noAnswer) },
    { color: COLOR_REVENUE, label: t("toolsUI.reports.hourly.tooltip.revenue"), value: formatCurrency(b.revenue, true) },
  ];

  return (
    <div className="rounded-md border border-border bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
      <div className="mb-1.5 font-semibold text-foreground">
        {headerForBucket(b, grain, t("toolsUI.reports.hourly.tooltip.weekOf"))}
      </div>
      <ul className="space-y-1">
        {rows.map((r) => (
          <li key={r.label} className="flex items-center gap-2">
            <span
              aria-hidden
              className="inline-block h-2 w-2 shrink-0 rounded-full"
              style={{ background: r.color }}
            />
            <span className="text-muted-foreground">{r.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-foreground">
              {r.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

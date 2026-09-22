"use client";

import * as React from "react";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { matchesCallStatusFilter } from "@/lib/call-status";
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

/** Heading noun per grain, so the title follows the H/D/M toggle. */
const GRAIN_NOUN_KEYS: Record<Grain, string> = {
  H: "dashboard.chart.grainHour",
  D: "dashboard.chart.grainDay",
  M: "dashboard.chart.grainMonth",
};

// Strict two-color binary: indigo for the positive outcome, red for the rest.
// "Not converted" and "No answer" both ride the destructive red so the chart
// reads as good-vs-bad at a glance; "No answer" sits at full strength while
// "Not converted" steps down in opacity to keep them distinguishable.
const COLOR_CONVERTED = "var(--accent)";
const COLOR_NOTCONV = "var(--destructive)";
const COLOR_NOANS = "var(--destructive)";
// Revenue is money, not calls — it gets the app's money-green, NOT the
// accent. Sharing the accent with the Connected bars put two identical
// blue squares in the legend and made the line read as part of the stack.
const COLOR_REVENUE = "var(--success)";

interface HourlyDistributionProps {
  calls: Call[];
  /**
   * Applied to the Card. Pass `h-full` where the chart shares a grid row with
   * a taller column and should match its height — the content then centres in
   * the extra space. Left off, the card sizes to its content as before, so
   * other surfaces using this chart are unaffected.
   */
  className?: string;
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
 *    "converted" — completed OR still in-progress (connected)
 *    "noAnswer"  — everything else (missed/no-answer, rejected, failed)
 *
 *  Reuses the same `matchesCallStatusFilter("connected")` the Call Summary
 *  totals and click-filters use — this used to be its own local check
 *  (`status === "completed" && payout > 0`), which routed every in-progress
 *  call, and every completed call with no payout yet recorded, into the red
 *  bucket. That's also why this chart's blue count could disagree with the
 *  Connected total sitting right above it on the same page.
 *
 *  The legacy `notConverted` bucket is kept in the Bucket type with a
 *  permanent 0 so the chart's data shape doesn't break, but no calls are
 *  routed to it at runtime. */
function classify(c: Call): "converted" | "noAnswer" {
  return matchesCallStatusFilter(c, "connected") ? "converted" : "noAnswer";
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

const MONTH_ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** 1 · 2 · 2.5 · 5 × 10ⁿ rounding for axis tick steps. */
/** Axis ticks and the line's own value labels read from one formatter, so
 *  a point sitting on a gridline shows the same figure as that gridline. */
function compactMoney(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${Math.round(v)}`;
}

/** Both panels reserve the same gutter for their Y axis, which is what
 *  keeps a column sitting exactly above its revenue point. */
const AXIS_WIDTH = 46;

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const m = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return m * pow;
}

/** "3. Sep" axis label for a day key ("2026-09-03"). Numeric "09-03" read
 *  as an ambiguous month/day pair; the month name doesn't. */
function dayKeyLabel(key: string): string {
  const [, m, d] = key.split("-").map(Number);
  return `${d}. ${MONTH_ABBR[m - 1] ?? m}`;
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

export function HourlyDistribution({ calls, className }: HourlyDistributionProps) {
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

  // Count axis: round ticks with headroom above the tallest column, so the
  // total label drawn above that column stays inside the plot. Recharts'
  // auto domain sits the ceiling exactly on the max, which clipped the top
  // half of the label; a raw `max * 1.12` gives ugly ticks like "1120".
  const countAxis = React.useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.total));
    const step = niceStep(Math.max(max, 4) / 4);
    const top = Math.max(step, Math.ceil((max * 1.12) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { top, ticks };
  }, [data]);

  // Revenue panel ceiling — rounded up with headroom so the area never
  // touches the top edge and its value labels stay inside the strip.
  const revAxis = React.useMemo(() => {
    const max = Math.max(0, ...data.map((d) => d.revenue));
    const step = niceStep(Math.max(max, 1) * 1.25 / 2);
    return { top: Math.max(step * 2, step), ticks: [0, Math.max(step * 2, step)] };
  }, [data]);

  // Value labels on the revenue area, but only while the points are sparse
  // enough to read. A day with revenue in every hour would otherwise stack
  // 24 figures into an 86px strip; there the axis + tooltip carry it.
  const showRevenueLabels = React.useMemo(
    () => data.filter((d) => d.revenue > 0).length <= 12,
    [data],
  );

  return (
    <Card className={cn("flex flex-col", className)}>
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
        {/* Cased in CSS rather than in the copy, so translations stay
            natural-cased and every locale gets the same treatment. */}
        <div className="flex-1 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {`${t("dashboard.chart.callsBy")} : ${t(GRAIN_NOUN_KEYS[grain])}`}
        </div>
      </CardHeader>
      {/* justify-end, not justify-center: the legend is the last element
          rendered inside the fixed-height chart block below. Bottom-anchoring
          the block means the legend lands flush with the card's bottom edge —
          the same edge the donut cards anchor their own legend to — so the
          two rows line up exactly regardless of chart vs. donut proportions
          above them. Centering would leave that alignment to chance. */}
      <CardContent className="flex flex-1 flex-col justify-end">
        {/* Two panels, one x-axis.
            Calls and revenue are different units, so overlaying them meant
            the line rode along the column tops: neither series could carry
            a readable value, and the right-hand $ ticks sat between the
            gridlines the left-hand counts sat on. Stacking them — columns
            above, a revenue strip below, both driven by the same buckets —
            keeps every hour aligned vertically while giving each series its
            own scale, its own labels and its own colour. */}
        <div ref={containerRef} className="flex h-72 w-full flex-col">
          {/* ── Calls ──────────────────────────────────────────────── */}
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                // bottom: room for the baseline "0" tick, which sat half
                // outside the panel with the x-axis hidden.
                margin={{ top: 18, right: 14, left: 4, bottom: 8 }}
                // Recharts' default (10%) packs bars nearly edge-to-edge — a
                // modest bump so each column reads as distinct without
                // shrinking the bars so much the chart looks sparse.
                barCategoryGap="28%"
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                {/* Hidden here — the revenue strip below owns the shared
                    x-axis, so the two panels line up on one set of labels. */}
                <XAxis dataKey="label" hide />
                <YAxis
                  yAxisId="count"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, countAxis.top]}
                  ticks={countAxis.ticks}
                  // Matches the revenue axis width exactly so both plot
                  // areas start at the same x and the columns sit directly
                  // above their revenue point.
                  width={AXIS_WIDTH}
                  allowDecimals={false}
                  tickMargin={4}
                />
                <Tooltip cursor={false} content={<HourlyTooltipWrapper grain={grain} />} />
                {/* Stack order — bottom to top:
                     1. noAnswer    (red sliver at bottom)
                     2. converted   (accent, dominant, top of stack) */}
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
                  {/* Total above each column — the space above is the
                      columns' own again now that the revenue line has
                      moved to its own panel. */}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Revenue ────────────────────────────────────────────── */}
          <div className="h-[86px] min-h-0">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data} margin={{ top: 14, right: 14, left: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="hourlyRevenueFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={COLOR_REVENUE} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={COLOR_REVENUE} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  // Responsive hour-grain ticks driven by the *chart container*
                  // width (not viewport) so the labels adapt even when the
                  // sidebar + donut squeeze the chart card down to ~600px on a
                  // wide screen. See `useCompactLabel` / `tickInterval` above.
                  interval={grain === "H" ? tickInterval : "preserveStartEnd"}
                  minTickGap={grain === "H" ? 0 : 12}
                  tickMargin={8}
                  tickFormatter={(label: string) => {
                    if (grain !== "H" || !useCompactLabel) return label;
                    // "08:00 am" → "8am" / "12:00 pm" → "12pm" so the axis
                    // fits a narrow card without dropping the am/pm suffix.
                    const m = label.match(/^(\d{2}):00 (am|pm)$/);
                    if (!m) return label;
                    return `${parseInt(m[1], 10)}${m[2]}`;
                  }}
                />
                <YAxis
                  yAxisId="rev"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, revAxis.top]}
                  ticks={revAxis.ticks}
                  width={AXIS_WIDTH}
                  tickFormatter={compactMoney}
                  tickMargin={4}
                />
                <Tooltip cursor={false} content={<HourlyTooltipWrapper grain={grain} />} />
                <Area
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLOR_REVENUE}
                  strokeWidth={2}
                  fill="url(#hourlyRevenueFill)"
                  dot={false}
                  activeDot={{ r: 3.5, stroke: COLOR_REVENUE, strokeWidth: 2, fill: "var(--card)" }}
                  isAnimationActive
                  animationDuration={500}
                >
                  {showRevenueLabels && (
                    <LabelList
                      dataKey="revenue"
                      position="top"
                      offset={6}
                      fill={COLOR_REVENUE}
                      fontSize={10}
                      fontWeight={600}
                      formatter={(v: number) => (v > 0 ? compactMoney(v) : "")}
                    />
                  )}
                </Area>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          {/* ── Legend ─────────────────────────────────────────────── */}
          <div className="flex items-center justify-center gap-5 pt-2">
            <LegendKey color={COLOR_CONVERTED} label={t("toolsUI.reports.hourly.legend.converted")} />
            <LegendKey color={COLOR_NOANS} label={t("toolsUI.reports.hourly.legend.noAnswer")} />
            <LegendKey color={COLOR_REVENUE} label={t("toolsUI.reports.hourly.legend.revenue")} />
          </div>
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

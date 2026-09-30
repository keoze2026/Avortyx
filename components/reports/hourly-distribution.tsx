"use client";

import * as React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
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
  rangeStartKey?: string;
  rangeEndKey?: string;
  /**
   * Ready-made hourly points from /api/analytics/snapshot. When passed, the
   * chart is built from these (the backend's own connected / no-answer split)
   * instead of from `calls`. Pages that don't pass it are unaffected.
   */
  series?: ChartSeriesPoint[];
}

/** One hourly point: `period` carries the report timezone's offset
 *  ("2026-08-26T11:00:00-04:00"), so its date and hour are read as-is. */
export interface ChartSeriesPoint {
  period: string;
  connected: number;
  noAnswer: number;
  revenue: number;
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

/**
 * Rounding for axis tick steps. The ladder is deliberately fine: each rung
 * is the smallest tick the axis may round up to, and a coarse ladder
 * overshoots badly here — with only 1 · 2 · 2.5 · 5 available, a step of
 * 270 rounded to 500, doubling the axis ceiling and squashing the columns
 * to a third of their height.
 */
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

/**
 * Call count printed on top of its column.
 *
 * Rendered by a zero-height bar stacked on top of each column and placed
 * after the revenue line in the chart, so the figures are drawn over the
 * line rather than under it. A thin halo in the card colour around the
 * digits keeps them clearly readable where the line runs close by. With the
 * tight revenue scale the line normally rides just above the figures, as in
 * the reference layout.
 */
function ColumnCountLabel({
  viewBox,
  index,
  data,
}: {
  viewBox?: { x?: number; y?: number; width?: number };
  index?: number;
  data?: Array<{ total: number }>;
}) {
  const row = index === undefined ? undefined : data?.[index];
  if (!row || row.total <= 0) return null;

  const x = Number(viewBox?.x);
  const columnTop = Number(viewBox?.y);
  const width = Number(viewBox?.width);
  if (![x, columnTop, width].every(Number.isFinite)) return null;

  return (
    <text
      x={x + width / 2}
      y={columnTop - 4}
      textAnchor="middle"
      fontSize={11}
      fontWeight={700}
      fill="var(--foreground)"
      stroke="var(--card)"
      strokeWidth={3}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {formatNumber(row.total)}
    </text>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
      <span aria-hidden className="h-2 w-2 rounded-[2px]" style={{ background: color }} />
      {label}
    </span>
  );
}

/** Gridline count on both axes. Shared so the $ ticks on the right land on
 *  the same lines as the call counts on the left. */
const DIVISIONS = 6;

function niceStep(raw: number): number {
  if (raw <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const f = raw / pow;
  const m =
    f <= 1 ? 1
    : f <= 1.2 ? 1.2
    : f <= 1.5 ? 1.5
    : f <= 2 ? 2
    : f <= 2.5 ? 2.5
    : f <= 3 ? 3
    : f <= 4 ? 4
    : f <= 5 ? 5
    : f <= 6 ? 6
    : f <= 8 ? 8
    : 10;
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

function bucketize(
  calls: Call[],
  grain: Grain,
  timeZone: string,
  rangeStartKey?: string,
  rangeEndKey?: string,
): Bucket[] {
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

  if (rangeStartKey) {
    const startMs = dayKeyToUtcMs(rangeStartKey);
    const endMs = Math.max(startMs, rangeEndKey ? dayKeyToUtcMs(rangeEndKey) : anchorMs);
    const weekCount = Math.floor(Math.round((endMs - startMs) / DAY_MS) / 7) + 1;
    const weekSlots: Bucket[] = Array.from({ length: weekCount }, (_, i) => {
      const weekStartMs = startMs + i * 7 * DAY_MS;
      return {
        label: dayKeyLabel(utcMsToDayKey(weekStartMs)),
        ts: weekStartMs,
        converted: 0,
        notConverted: 0,
        noAnswer: 0,
        revenue: 0,
      };
    });
    for (const c of calls) {
      const callDayMs = dayKeyToUtcMs(zonedDayKey(c.startedAt, timeZone));
      if (callDayMs < startMs || callDayMs > endMs) continue;
      const idx = Math.floor(Math.round((callDayMs - startMs) / DAY_MS) / 7);
      const k = classify(c);
      weekSlots[idx][k] += 1;
      weekSlots[idx].revenue += c.revenue;
    }
    return weekSlots;
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

function bucketizeSeries(
  series: ChartSeriesPoint[],
  grain: Grain,
  timeZone: string,
  rangeStartKey?: string,
  rangeEndKey?: string,
): Bucket[] {
  const entries = series
    .map((p) => ({
      dayKey: p.period.slice(0, 10),
      hour: Number(p.period.slice(11, 13)),
      connected: p.connected,
      noAnswer: p.noAnswer,
      revenue: p.revenue,
    }))
    .filter((e) => /^\d{4}-\d{2}-\d{2}$/.test(e.dayKey));

  const add = (slot: Bucket, e: (typeof entries)[number]) => {
    slot.converted += e.connected;
    slot.noAnswer += e.noAnswer;
    slot.revenue += e.revenue;
  };

  if (grain === "H") {
    const slots: Bucket[] = Array.from({ length: 24 }, (_, h) => ({
      label: fmt12Hour(h),
      ts: h,
      converted: 0,
      notConverted: 0,
      noAnswer: 0,
      revenue: 0,
    }));
    for (const e of entries) {
      if (!Number.isFinite(e.hour) || e.hour < 0 || e.hour >= 24) continue;
      add(slots[e.hour], e);
    }
    return slots;
  }

  let anchorKey = "";
  for (const e of entries) {
    if (e.connected + e.noAnswer > 0 && e.dayKey > anchorKey) anchorKey = e.dayKey;
  }
  const anchorMs = dayKeyToUtcMs(anchorKey || zonedDayKey(Date.now(), timeZone));

  if (grain === "D") {
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
    for (const e of entries) {
      const idx = indexByKey.get(e.dayKey);
      if (idx === undefined) continue;
      add(slots[idx], e);
    }
    return slots;
  }

  if (rangeStartKey) {
    const startMs = dayKeyToUtcMs(rangeStartKey);
    const endMs = Math.max(startMs, rangeEndKey ? dayKeyToUtcMs(rangeEndKey) : anchorMs);
    const weekCount = Math.floor(Math.round((endMs - startMs) / DAY_MS) / 7) + 1;
    const weekSlots: Bucket[] = Array.from({ length: weekCount }, (_, i) => {
      const weekStartMs = startMs + i * 7 * DAY_MS;
      return {
        label: dayKeyLabel(utcMsToDayKey(weekStartMs)),
        ts: weekStartMs,
        converted: 0,
        notConverted: 0,
        noAnswer: 0,
        revenue: 0,
      };
    });
    for (const e of entries) {
      const dayMs = dayKeyToUtcMs(e.dayKey);
      if (dayMs < startMs || dayMs > endMs) continue;
      add(weekSlots[Math.floor(Math.round((dayMs - startMs) / DAY_MS) / 7)], e);
    }
    return weekSlots;
  }

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
  for (const e of entries) {
    const offsetDays = Math.round((anchorMs - dayKeyToUtcMs(e.dayKey)) / DAY_MS);
    if (offsetDays < 0 || offsetDays >= weeks * 7) continue;
    add(slots[weeks - 1 - Math.floor(offsetDays / 7)], e);
  }
  return slots;
}

export function HourlyDistribution({
  calls,
  className,
  rangeStartKey,
  rangeEndKey,
  series,
}: HourlyDistributionProps) {
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
      (series
        ? bucketizeSeries(series, grain, timeZone, rangeStartKey, rangeEndKey)
        : bucketize(calls, grain, timeZone, rangeStartKey, rangeEndKey)
      ).map((b) => ({
        ...b,
        total: b.converted + b.notConverted + b.noAnswer,
        // Zero-height segment stacked on top of each column; it only carries
        // the call-count label (see ColumnCountLabel).
        labelAnchor: 0,
      })),
    [calls, series, grain, timeZone, rangeStartKey, rangeEndKey],
  );

  // Each axis is sized from its own data only.
  //
  //   1. The count axis follows the busiest period's call total. It used to
  //      be stretched by a calls-per-dollar ratio to force the revenue line
  //      above every column, which pushed a 49-call peak onto a 240 axis and
  //      made the revenue line read as a call count. Removed on request:
  //      the left scale is set by hourly calls, not by a ratio.
  //   2. Both axes still use the same number of divisions, so the $ ticks on
  //      the right land on the same gridlines as the call counts on the left.
  const axes = React.useMemo(() => {
    const maxCalls = Math.max(0, ...data.map((d) => d.total));
    const maxRevenue = Math.max(0, ...data.map((d) => d.revenue));

    // Revenue ceiling: kept tight to the peak (2% headroom) so the revenue
    // line rides above the columns and normally clears the call counts
    // printed on top of them. The dollar scale on the right stays exact.
    const revStep = Math.max(1, Math.ceil(niceStep((Math.max(maxRevenue, 1) * 1.02) / DIVISIONS)));
    const revTop = revStep * DIVISIONS;

    // Count ceiling from the calls alone — 12% headroom so the tallest
    // column doesn't touch the top of the chart.
    const countStep = Math.max(1, Math.ceil(niceStep(Math.max(maxCalls * 1.12, 4) / DIVISIONS)));
    const countTop = countStep * DIVISIONS;

    const ticksFor = (step: number) =>
      Array.from({ length: DIVISIONS + 1 }, (_, i) => Math.round(step * i));
    return {
      countTop,
      countTicks: ticksFor(countStep),
      revTop,
      revTicks: ticksFor(revStep),
    };
  }, [data]);

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
        {/* One chart, two scales. The revenue line is kept clear of the
            columns by the axis maths above rather than by hiding one of
            them: the line rides above every stick, the stick carries its
            call count inside its own top, and the line carries its dollar
            figure above itself. */}
        <div ref={containerRef} className="flex h-72 w-full flex-col">
          <div className="min-h-0 flex-1">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart
                data={data}
                margin={{ top: 20, right: 14, left: 4, bottom: 0 }}
                // The reference build's spacing — columns read as distinct
                // sticks rather than a solid block.
                barCategoryGap="28%"
              >
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
                  yAxisId="count"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, axes.countTop]}
                  ticks={axes.countTicks}
                  width={AXIS_WIDTH}
                  allowDecimals={false}
                  tickMargin={4}
                />
                {/* Right-side revenue axis — four divisions, same as the
                    count axis, so both sets of numbers sit on the same
                    gridlines instead of floating between them. */}
                <YAxis
                  yAxisId="rev"
                  orientation="right"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  axisLine={false}
                  tickLine={false}
                  domain={[0, axes.revTop]}
                  ticks={axes.revTicks}
                  width={AXIS_WIDTH}
                  tickFormatter={compactMoney}
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
                />
                <Line
                  yAxisId="rev"
                  type="monotone"
                  dataKey="revenue"
                  stroke={COLOR_REVENUE}
                  strokeWidth={2}
                  dot={grain === "M" ? false : { r: 2, stroke: COLOR_REVENUE, strokeWidth: 1.5, fill: "var(--card)" }}
                  activeDot={{ r: 4, stroke: COLOR_REVENUE, strokeWidth: 2, fill: "var(--card)" }}
                  isAnimationActive
                  animationDuration={500}
                >
                  {/* No value labels on the line: the numbers are printed
                      on top of the sticks only. Stacking a
                      second figure above the line collided with the count
                      on every short column, where the proportional gap
                      between the two is only a few pixels. The line's
                      value is on the right axis and in the tooltip. */}
                </Line>
                {/* Call counts on top of each column. A zero-height bar on
                    the same stack, placed after the line so the figures are
                    drawn over it; hidden from the tooltip and legend. */}
                <Bar
                  yAxisId="count"
                  dataKey="labelAnchor"
                  stackId="calls"
                  fill="transparent"
                  legendType="none"
                  tooltipType="none"
                >
                  <LabelList dataKey="total" content={<ColumnCountLabel data={data} />} />
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>

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
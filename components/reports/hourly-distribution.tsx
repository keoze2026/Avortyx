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

/** How far above a column the revenue line rides, as a multiple of the
 *  column's height — enough to clear the call-count label printed on top
 *  of the column with a little air either side. */
const LABEL_GAP = 1.3;

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

export function HourlyDistribution({
  calls,
  className,
  rangeStartKey,
  rangeEndKey,
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
      bucketize(calls, grain, timeZone, rangeStartKey, rangeEndKey).map((b) => ({
        ...b,
        total: b.converted + b.notConverted + b.noAnswer,
      })),
    [calls, grain, timeZone, rangeStartKey, rangeEndKey],
  );

  // Both axes in one calculation, because they constrain each other.
  //
  //   1. The revenue line must sit ABOVE every column (client request:
  //      "line always above stick"). A point is above a column when
  //      rev/revTop > calls/countTop, so the count axis needs enough
  //      headroom to satisfy the worst hour — the one with the most calls
  //      per dollar. Solving for countTop gives the `needed` term below.
  //   2. Both axes use four divisions, so the $ ticks on the right land on
  //      the same gridlines as the call counts on the left.
  const axes = React.useMemo(() => {
    const maxCalls = Math.max(0, ...data.map((d) => d.total));
    const maxRevenue = Math.max(0, ...data.map((d) => d.revenue));

    // Revenue ceiling first — 10% headroom so the peak's label has room.
    // Five divisions, not four: a coarser split rounds the ceiling far above
    // the data (a $777 peak landed on a $1,000 axis, which then dragged the
    // count axis to 2,000 and left the columns a third of their height).
    const revStep = Math.max(1, Math.ceil(niceStep((Math.max(maxRevenue, 1) * 1.1) / DIVISIONS)));
    const revTop = revStep * DIVISIONS;

    // Worst calls-per-dollar hour. Hours with no revenue are skipped: a
    // column can't be cleared by a line sitting on the baseline.
    let callsPerDollar = 0;
    for (const d of data) {
      if (d.revenue > 0 && d.total > 0) callsPerDollar = Math.max(callsPerDollar, d.total / d.revenue);
    }
    // The line sits above the column *and* above the count label printed
    // on top of it, so the gap has to cover both.
    const needed = revTop * callsPerDollar * LABEL_GAP;

    const countStep = Math.max(1, Math.ceil(niceStep(Math.max(maxCalls * 1.12, needed, 4) / DIVISIONS)));
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
                >
                  {/* Above the column, as in the reference layout. The
                      revenue line clears these too — see LABEL_GAP. */}
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
                  dot={grain === "M" ? false : { r: 2, stroke: COLOR_REVENUE, strokeWidth: 1.5, fill: "var(--card)" }}
                  activeDot={{ r: 4, stroke: COLOR_REVENUE, strokeWidth: 2, fill: "var(--card)" }}
                  isAnimationActive
                  animationDuration={500}
                >
                  {/* No value labels on the line: the reference layout
                      prints numbers above the sticks only. Stacking a
                      second figure above the line collided with the count
                      on every short column, where the proportional gap
                      between the two is only a few pixels. The line's
                      value is on the right axis and in the tooltip. */}
                </Line>
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
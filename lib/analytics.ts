/**
 * Analytics helpers — pure functions over a `Call[]` slice.
 * All consumed by the /reports page so widgets share one consistent view of
 * the filtered call universe.
 */

import { zonedDayKey } from "@/lib/format";
import type { Call, CallStatus } from "@/lib/types";

const DAY = 1000 * 60 * 60 * 24;

/* ===========================================================
   Date-range filtering
   =========================================================== */

export type DateRange = "today" | "7d" | "14d" | "30d";

const RANGE_DAYS: Record<DateRange, number> = { today: 1, "7d": 7, "14d": 14, "30d": 30 };

/**
 * Calendar-day bounds for a range, as "YYYY-MM-DD" keys in `timeZone`:
 * "today" is the current day in that zone (not a rolling 24 hours — the
 * old definition let yesterday-evening calls show under "Today"), "7d" is
 * the last 7 calendar days including today, and so on.
 */
export function rangeDayKeys(
  range: DateRange,
  timeZone: string,
  now = Date.now(),
): { from: string; to: string } {
  const to = zonedDayKey(now, timeZone);
  const from = zonedDayKey(now - (RANGE_DAYS[range] - 1) * DAY, timeZone);
  return { from, to };
}

/** Keep the calls whose start falls inside `range`'s calendar days in `timeZone`. */
export function filterByRange(calls: Call[], range: DateRange, timeZone: string, now = Date.now()): Call[] {
  const { from, to } = rangeDayKeys(range, timeZone, now);
  return calls.filter((c) => {
    const day = zonedDayKey(c.startedAt, timeZone);
    return day >= from && day <= to;
  });
}

/* ===========================================================
   Top-line totals
   =========================================================== */

export interface Totals {
  count: number;
  completed: number;
  missed: number;
  revenue: number;
  payout: number;
  avgDurationSec: number;
  conversionRate: number; // 0..1
}

export function totals(calls: Call[]): Totals {
  const count = calls.length;
  const completed = calls.filter((c) => c.status === "completed");
  const missed = calls.filter((c) => c.status === "missed" || c.status === "rejected" || c.status === "failed");
  const revenue = calls.reduce((s, c) => s + c.revenue, 0);
  const payout = calls.reduce((s, c) => s + c.payout, 0);
  const totalDuration = completed.reduce((s, c) => s + c.durationSec, 0);
  return {
    count,
    completed: completed.length,
    missed: missed.length,
    revenue,
    payout,
    avgDurationSec: completed.length > 0 ? Math.round(totalDuration / completed.length) : 0,
    conversionRate: count > 0 ? completed.length / count : 0,
  };
}

/* ===========================================================
   Funnel
   =========================================================== */

export interface FunnelStep {
  key: "incoming" | "connected" | "qualified" | "paid";
  label: string;
  count: number;
}

/** Classic call-tracking funnel — same dataset, 4 increasingly strict cuts. */
export function funnel(calls: Call[]): FunnelStep[] {
  const incoming = calls.length;
  const connected = calls.filter(
    (c) => c.status !== "rejected" && c.status !== "failed",
  ).length;
  const qualified = calls.filter(
    (c) => (c.status === "completed" || c.status === "in-progress") && c.durationSec >= 60,
  ).length;
  const paid = calls.filter((c) => c.status === "completed" && c.payout > 0).length;
  return [
    { key: "incoming", label: "Incoming", count: incoming },
    { key: "connected", label: "Connected", count: connected },
    { key: "qualified", label: "Qualified", count: qualified },
    { key: "paid", label: "Paid", count: paid },
  ];
}

/* ===========================================================
   Group-by primitives
   =========================================================== */

export interface GroupAggregate {
  key: string;
  label: string;
  count: number;
  completed: number;
  revenue: number;
  conversionRate: number;
}

function aggregate(
  calls: Call[],
  keyFn: (c: Call) => string | undefined,
  labelFn: (c: Call) => string,
): GroupAggregate[] {
  const m = new Map<string, GroupAggregate>();
  for (const c of calls) {
    const k = keyFn(c);
    if (!k) continue;
    let g = m.get(k);
    if (!g) {
      g = { key: k, label: labelFn(c), count: 0, completed: 0, revenue: 0, conversionRate: 0 };
      m.set(k, g);
    }
    g.count += 1;
    if (c.status === "completed") g.completed += 1;
    g.revenue += c.revenue;
  }
  for (const g of m.values()) {
    g.conversionRate = g.count > 0 ? g.completed / g.count : 0;
  }
  return [...m.values()].sort((a, b) => b.revenue - a.revenue);
}

export function byCampaign(calls: Call[]) {
  return aggregate(calls, (c) => c.campaignId, (c) => c.campaignName);
}
export function byBuyer(calls: Call[]) {
  return aggregate(calls, (c) => c.buyerId, (c) => c.buyerName ?? "—");
}
export function byPublisher(calls: Call[]) {
  return aggregate(calls, (c) => c.publisherId, (c) => c.publisherName ?? "—");
}
export function byGeo(calls: Call[]) {
  return aggregate(calls, (c) => c.geo.state, (c) => c.geo.state ?? "—");
}

/* ===========================================================
   Time series
   =========================================================== */

export interface DayPoint {
  /** YYYY-MM-DD */
  date: string;
  /** Days ago — 0 = today */
  offset: number;
  calls: number;
  revenue: number;
  conversions: number;
}

/** Aggregate calls into N daily buckets ending today. */
export function byDay(calls: Call[], days: number): DayPoint[] {
  const out: DayPoint[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(start.getTime() - i * DAY);
    const next = d.getTime() + DAY;
    const slice = calls.filter((c) => c.startedAt >= d.getTime() && c.startedAt < next);
    out.push({
      date: d.toISOString().slice(0, 10),
      offset: i,
      calls: slice.length,
      revenue: slice.reduce((s, c) => s + c.revenue, 0),
      conversions: slice.filter((c) => c.status === "completed").length,
    });
  }
  return out;
}

/**
 * 7 × 24 heatmap matrix [dayOfWeek][hour] => call count.
 * dayOfWeek 0=Sun..6=Sat to match JS Date.
 */
export function heatmap(calls: Call[]): number[][] {
  const grid: number[][] = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const c of calls) {
    const d = new Date(c.startedAt);
    grid[d.getDay()][d.getHours()] += 1;
  }
  return grid;
}

/* ===========================================================
   CSV export
   =========================================================== */

const CSV_COLUMNS: Array<{ key: keyof Call | "geoState" | "startedAtISO"; label: string }> = [
  { key: "id", label: "ID" },
  { key: "startedAtISO", label: "Started" },
  { key: "callerNumber", label: "Caller" },
  { key: "destinationNumber", label: "Destination" },
  { key: "campaignName", label: "Campaign" },
  { key: "buyerName", label: "Buyer" },
  { key: "publisherName", label: "Publisher" },
  { key: "geoState", label: "State" },
  { key: "status", label: "Status" },
  { key: "durationSec", label: "Duration (s)" },
  { key: "payout", label: "Payout" },
  { key: "revenue", label: "Revenue" },
];

function escape(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = typeof value === "string" ? value : String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCSV(calls: Call[]): string {
  const header = CSV_COLUMNS.map((c) => escape(c.label)).join(",");
  const rows = calls.map((c) => {
    const flat: Record<string, unknown> = {
      ...c,
      geoState: c.geo.state ?? "",
      startedAtISO: new Date(c.startedAt).toISOString(),
    };
    return CSV_COLUMNS.map((col) => escape(flat[col.key as string])).join(",");
  });
  return [header, ...rows].join("\n");
}

/** Triggers a CSV download in the browser. */
export function downloadCSV(calls: Call[], filename = "calls.csv") {
  const csv = toCSV(calls);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ===========================================================
   Status helpers
   =========================================================== */

export const ALL_STATUSES: CallStatus[] = [
  "ringing",
  "in-progress",
  "completed",
  "missed",
  "rejected",
  "failed",
];

export const STATUS_LABEL: Record<CallStatus, string> = {
  ringing: "Ringing",
  "in-progress": "In progress",
  completed: "Completed",
  missed: "Missed",
  rejected: "Rejected",
  failed: "Failed",
};

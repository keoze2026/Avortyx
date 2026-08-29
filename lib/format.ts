/**
 * Display formatters. All deterministic — fine for SSR.
 */

const NF = new Intl.NumberFormat("en-US");
const CF = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const CF_PRECISE = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatNumber(n: number) {
  return NF.format(n);
}

/** "1234" → "1.2K", "1234567" → "1.2M" */
export function formatCompact(n: number) {
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatCurrency(n: number, precise = false) {
  return precise ? CF_PRECISE.format(n) : CF.format(n);
}

export function formatPercent(n: number, fractionDigits = 1) {
  return `${n.toFixed(fractionDigits)}%`;
}

/** Seconds → "3m 24s" or "47s" */
export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s === 0 ? `${m}m` : `${m}m ${s}s`;
}

/** Pad seconds → "MM:SS" timer style */
export function formatTimer(seconds: number) {
  const m = Math.floor(seconds / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/** Pad seconds → "HH:MM:SS" — used for call-log durations.
 *  416 → "00:06:56", 3725 → "01:02:05". */
export function formatHMS(seconds: number): string {
  const n = Math.max(0, Math.floor(seconds));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const s = n % 60;
  const pad = (x: number) => x.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

const RELATIVE_THRESHOLDS: Array<[number, string]> = [
  [60, "s"],
  [3600, "m"],
  [86400, "h"],
];

/** Timestamp (ms) → "2m ago", "5h ago" — small + monospace-safe. */
export function formatRelativeTime(timestamp: number, now = Date.now()) {
  const diff = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diff < 10) return "just now";
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Translation-aware variant — pass `t` from `useTranslation()` and the same
 * timestamp; resolves into the active locale via `common.relativeTime.*` keys.
 * Falls back to the English `formatRelativeTime()` output if those keys are
 * missing in the chosen locale.
 */
export function formatRelativeTimeT(
  t: (key: string) => string,
  timestamp: number,
  now = Date.now(),
) {
  const diff = Math.max(0, Math.floor((now - timestamp) / 1000));
  const fallback = formatRelativeTime(timestamp, now);
  const resolve = (key: string, value: number | undefined) => {
    const r = t(key);
    if (r === key) return fallback; // not translated → English
    return value === undefined ? r : r.replace("{n}", String(value));
  };
  if (diff < 10) return resolve("common.relativeTime.justNow", undefined);
  if (diff < 60) return resolve("common.relativeTime.secondsAgo", diff);
  if (diff < 3600) return resolve("common.relativeTime.minutesAgo", Math.floor(diff / 60));
  if (diff < 86400) return resolve("common.relativeTime.hoursAgo", Math.floor(diff / 3600));
  return resolve("common.relativeTime.daysAgo", Math.floor(diff / 86400));
}

// Reference to avoid unused-import warning if a consumer only takes the array.
void RELATIVE_THRESHOLDS;

/**
 * Normalize any phone-number-shaped string to compact E.164 — no spaces,
 * no parens, no dashes, leading "+". US numbers come out as "+1XXXXXXXXXX".
 *
 *   "+1 (809) 373-1379" → "+18093731379"
 *   "8093731379"         → "+18093731379"   (10-digit US assumed)
 *   "18093731379"        → "+18093731379"
 *   ""                   → ""               (pass-through for empties)
 *
 * Use this everywhere a phone number is rendered so the UI is consistent.
 */
export function toE164(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  // 10-digit input → assume US, prefix with country code "1".
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/* ─── Timezone-aware timestamp rendering ───────────────────────────────
 *
 * Every reporting surface renders call times in one explicitly chosen
 * timezone (see `useUIStore().reportTimezone`) instead of whatever zone the
 * viewer's machine happens to sit in. Reading the raw `Date` getters applies
 * the browser's UTC offset on top of the instant the backend already sent,
 * so the same CDR read 8 hours apart for an operator in UTC+8 and one in UTC.
 *
 * `Intl.DateTimeFormat` construction is the expensive part, so formatters are
 * memoized per timezone — a 50-row call log rebuilds none of them.
 */

const PARTS_FORMATTERS = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = PARTS_FORMATTERS.get(timeZone);
  if (cached) return cached;
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  } catch {
    // Unknown/typo'd IANA id — fall back to the viewer's zone rather than
    // throwing inside a render.
    fmt = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
  }
  PARTS_FORMATTERS.set(timeZone, fmt);
  return fmt;
}

export interface ZonedParts {
  year: number;
  /** Abbreviated month name, e.g. "Aug". */
  month: string;
  /** Day of month, 1-31. */
  day: number;
  /** Hour of day in the target zone, 0-23. */
  hour: number;
  minute: number;
  second: number;
}

/** Break a timestamp (ms) into calendar parts as seen in `timeZone`. */
export function zonedParts(timestamp: number, timeZone: string): ZonedParts {
  const parts = partsFormatter(timeZone).formatToParts(new Date(timestamp));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  // `hourCycle: "h23"` still emits "24" for midnight in some engines.
  const hour = Number(get("hour")) % 24;
  return {
    year: Number(get("year")),
    month: get("month"),
    day: Number(get("day")),
    hour: Number.isFinite(hour) ? hour : 0,
    minute: Number(get("minute")),
    second: Number(get("second")),
  };
}

/** Hour of day (0-23) a timestamp falls in, as seen in `timeZone`. */
export function zonedHour(timestamp: number, timeZone: string): number {
  return zonedParts(timestamp, timeZone).hour;
}

const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Calendar day key ("2026-08-29") a timestamp falls on in `timeZone`.
 *  Use for day bucketing so rows near midnight land on the right day. */
export function zonedDayKey(timestamp: number, timeZone: string): string {
  const p = zonedParts(timestamp, timeZone);
  const monthIndex = MONTH_ABBR.indexOf(p.month);
  const mm = (monthIndex >= 0 ? monthIndex + 1 : 1).toString().padStart(2, "0");
  return `${p.year}-${mm}-${p.day.toString().padStart(2, "0")}`;
}

/**
 * Call-log timestamp → "Aug 29, 8:30:00 AM" rendered in `timeZone`.
 * Replaces the old browser-local `new Date(ts).getHours()` formatting.
 */
export function formatCallTime(timestamp: number, timeZone: string): string {
  const p = zonedParts(timestamp, timeZone);
  const ampm = p.hour >= 12 ? "PM" : "AM";
  const h12 = p.hour % 12 || 12;
  const mm = p.minute.toString().padStart(2, "0");
  const ss = p.second.toString().padStart(2, "0");
  return `${p.month} ${p.day}, ${h12}:${mm}:${ss} ${ampm}`;
}

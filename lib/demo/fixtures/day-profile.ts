/**
 * The demo's intraday profile — the dataset the client specified for the
 * demo workspace. Every "today" figure in the portal derives from it:
 *
 *   slot          live calls   calls started   cumulative
 *   08:00–09:00        50            300             300
 *   09:00–10:00        90            400             700
 *   10:00–11:00       150            200             900
 *   11:00–12:00   230–260          1 000           1 900
 *   12:00–13:00   230–260            500           2 400
 *   13:00–14:00   190–210            600           3 000
 *   14:00–15:00       210          1 500           4 500
 *   15:00–16:00       230          1 000           5 500
 *   16:00–17:00       130          1 000           6 500
 *   17:00            end of day — 0 live, total holds at 6 500
 *
 * "Total calls" in the source table is cumulative, so `calls` here is the
 * per-hour increment. The table is the *shape* and the ceiling: each
 * calendar day lands somewhere between 5 000 and 6 500 calls (see
 * `dayTotalFor`), with every hour scaled by the same factor, so
 * consecutive days never end on the same figure. The day is read against the clock of the report
 * timezone (see `../clock.ts`): before 08:00 nothing has happened yet,
 * during the day the totals grow through each hour, after 17:00 the full
 * day is on the books.
 */

import { bucketInt } from "../bucket";
import { demoClock } from "../clock";

export interface DaySlot {
  /** Hour of day the slot starts (local time). */
  hour: number;
  /** Concurrent in-flight calls during the slot — a fixed value or a range. */
  live: [number, number];
  /** Calls started during the slot. */
  calls: number;
}

export const DAY_PROFILE: readonly DaySlot[] = [
  { hour: 8, live: [50, 50], calls: 300 },
  { hour: 9, live: [90, 90], calls: 400 },
  { hour: 10, live: [150, 150], calls: 200 },
  { hour: 11, live: [230, 260], calls: 1_000 },
  { hour: 12, live: [230, 260], calls: 500 },
  { hour: 13, live: [190, 210], calls: 600 },
  { hour: 14, live: [210, 210], calls: 1_500 },
  { hour: 15, live: [230, 230], calls: 1_000 },
  // From 16:00 concurrency is held to 100–120 (client spec 2026-09-23).
  { hour: 16, live: [100, 120], calls: 1_000 },
];

/** Calls in a full day at the profile's ceiling: 6 500. */
export const DAY_TOTAL = DAY_PROFILE.reduce((s, slot) => s + slot.calls, 0);

/** A day's total falls in this band (client spec: "between 5k and 6.5k"). */
export const DAY_TOTAL_MIN = 5_000;
export const DAY_TOTAL_MAX = DAY_TOTAL;

/** 0–1 from a date string. FNV-1a over the characters, then a murmur3
 *  finaliser — consecutive dates differ in one character, and without the
 *  mix they'd all land within a few percent of each other. */
function hashDayKey(dayKey: string): number {
  let h = 2166136261;
  for (let i = 0; i < dayKey.length; i++) h = Math.imul(h ^ dayKey.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

/**
 * How many calls a given calendar day ("YYYY-MM-DD") ends on — a stable
 * pick inside 5 000–6 500 that depends only on the date, so today's figure
 * doesn't move between reloads and each day differs from the last.
 */
export function dayTotalFor(dayKey: string): number {
  const span = DAY_TOTAL_MAX - DAY_TOTAL_MIN;
  // Round to a "reported" figure (tens) so it reads like a real count.
  return DAY_TOTAL_MIN + Math.round((hashDayKey(dayKey) * span) / 10) * 10;
}

/** Per-hour call counts for a day: the profile's shape scaled to that
 *  day's total (the last slot absorbs rounding so the sum is exact). */
export function daySlotsFor(dayKey: string): Array<{ hour: number; calls: number }> {
  const total = dayTotalFor(dayKey);
  const scale = total / DAY_TOTAL;
  const slots = DAY_PROFILE.map((s) => ({ hour: s.hour, calls: Math.round(s.calls * scale) }));
  const sum = slots.reduce((a, s) => a + s.calls, 0);
  slots[slots.length - 1].calls += total - sum;
  return slots;
}

export const DAY_OPEN_HOUR = DAY_PROFILE[0].hour;
/** Calls stop being *started* after the last slot; the floor keeps a
 *  dwindling number of them in flight until 17:30 (see LIVE_TAIL). */
export const DAY_CLOSE_HOUR = DAY_PROFILE[DAY_PROFILE.length - 1].hour + 1;

export function slotForHour(hour: number): DaySlot | undefined {
  return DAY_PROFILE.find((s) => s.hour === hour);
}

/**
 * End-of-day wind-down, at half-hour resolution (client spec 2026-09-23):
 *
 *   16:30  120 live
 *   17:00   30 live
 *   17:30   0 — end of day
 *
 * Concurrency from 16:00 onward stays inside 100–120.
 *
 * The hourly slots above only reach whole hours, so these override them
 * from 16:30 onward. Ordered latest-first for the lookup below.
 */
const LIVE_TAIL: Array<{ atMinute: number; live: number }> = [
  { atMinute: 17 * 60 + 30, live: 0 },
  { atMinute: 17 * 60, live: 30 },
  // 120, not the 150 first specified: the later instruction caps
  // concurrency at 100–120 from 16:00 onward, and 150 would break it.
  { atMinute: 16 * 60 + 30, live: 120 },
];

/**
 * Live (in-flight) calls right now. A ranged slot ("230–260") resolves to
 * one stable value inside the range for the duration of the hour, so the
 * counter doesn't flicker between renders. From 16:30 the wind-down above
 * takes over. Outside business hours: 0.
 */
export function liveTargetAt(now: number = Date.now()): number {
  const { hour, minute } = demoClock(now);
  const sinceMidnight = hour * 60 + minute;
  for (const step of LIVE_TAIL) {
    if (sinceMidnight >= step.atMinute) return step.live;
  }
  const slot = slotForHour(hour);
  if (!slot) return 0;
  const [lo, hi] = slot.live;
  if (lo === hi) return lo;
  // Salted by the hour so each ranged slot gets its own stable pick.
  return bucketInt(900 + hour, lo, hi);
}

/** Calls started so far today, pro-rated inside the current hour. */
export function callsExpectedAt(now: number = Date.now()): number {
  const { hour, minute, second, dayKey } = demoClock(now);
  let total = 0;
  for (const slot of daySlotsFor(dayKey)) {
    if (slot.hour < hour) total += slot.calls;
    else if (slot.hour === hour) total += Math.round((slot.calls * (minute * 60 + second)) / 3600);
  }
  return total;
}

/** Normalised 24-entry hour weights (sum = 1) for spreading a day's calls. */
export function hourWeights(): number[] {
  const weights = new Array<number>(24).fill(0);
  for (const slot of DAY_PROFILE) weights[slot.hour] = slot.calls / DAY_TOTAL;
  return weights;
}

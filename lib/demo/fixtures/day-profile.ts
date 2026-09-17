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
 * per-hour increment. The day is read against the clock of the report
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
  { hour: 16, live: [130, 130], calls: 1_000 },
];

/** Calls in a full day: 6 500. */
export const DAY_TOTAL = DAY_PROFILE.reduce((s, slot) => s + slot.calls, 0);

export const DAY_OPEN_HOUR = DAY_PROFILE[0].hour;
export const DAY_CLOSE_HOUR = DAY_PROFILE[DAY_PROFILE.length - 1].hour + 1;

export function slotForHour(hour: number): DaySlot | undefined {
  return DAY_PROFILE.find((s) => s.hour === hour);
}

/**
 * Live (in-flight) calls right now. A ranged slot ("230–260") resolves to
 * one stable value inside the range for the duration of the hour, so the
 * counter doesn't flicker between renders. Outside business hours: 0.
 */
export function liveTargetAt(now: number = Date.now()): number {
  const { hour } = demoClock(now);
  const slot = slotForHour(hour);
  if (!slot) return 0;
  const [lo, hi] = slot.live;
  if (lo === hi) return lo;
  // Salted by the hour so each ranged slot gets its own stable pick.
  return bucketInt(900 + hour, lo, hi);
}

/** Calls started so far today, pro-rated inside the current hour. */
export function callsExpectedAt(now: number = Date.now()): number {
  const { hour, minute, second } = demoClock(now);
  let total = 0;
  for (const slot of DAY_PROFILE) {
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

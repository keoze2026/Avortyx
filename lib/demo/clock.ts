/**
 * The demo's clock — the current time *in the report timezone*.
 *
 * The demo's business day (see `fixtures/day-profile.ts`) runs 08:00–17:00.
 * Anchoring it to the report timezone rather than the browser's means the
 * dashboard's hourly chart, the Live / Total counters and the date filters
 * all describe the same day in the zone the portal is displaying — an
 * operator in Seoul looking at the workspace in New York time sees New
 * York's business day, exactly as they would against the real backend.
 */

import { zonedDayKey, zonedParts } from "@/lib/format";
import { useUIStore } from "@/lib/store/ui-store";

export function demoTimeZone(): string {
  try {
    return useUIStore.getState().reportTimezone || "Etc/UTC";
  } catch {
    return "Etc/UTC";
  }
}

export interface DemoClock {
  timeZone: string;
  /** "YYYY-MM-DD" of today in the report zone. */
  dayKey: string;
  hour: number;
  minute: number;
  second: number;
  /** Epoch ms of 00:00 today in the report zone. */
  startOfToday: number;
  /** Epoch ms of the 1st of this month, 00:00, in the report zone. */
  startOfMonth: number;
}

export function demoClock(now: number = Date.now()): DemoClock {
  const timeZone = demoTimeZone();
  const p = zonedParts(now, timeZone);
  const dayKey = zonedDayKey(now, timeZone);
  const [y, m, d] = dayKey.split("-").map(Number);
  // The zone's UTC offset right now: wall-clock parts read as UTC, minus the
  // real instant. Good to the second; DST transitions inside a demo day
  // aren't worth more machinery.
  const offset = Date.UTC(y, m - 1, d, p.hour, p.minute, p.second) - now;
  return {
    timeZone,
    dayKey,
    hour: p.hour,
    minute: p.minute,
    second: p.second,
    startOfToday: Date.UTC(y, m - 1, d) - offset,
    startOfMonth: Date.UTC(y, m - 1, 1) - offset,
  };
}

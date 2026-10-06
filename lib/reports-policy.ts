/**
 * Product rules for the Reports page, kept in one place so they are easy to
 * find and to flip if the client changes their mind.
 *
 *   includeToday  false -> Reports covers COMPLETED days only (yesterday and
 *                 earlier). Today's numbers live on the Dashboard, the Live
 *                 Monitor and the Live / Total figures in the top bar.
 *   showLive      false -> no live (in-progress) figures inside Reports: no
 *                 Live chip in the toolbar and no Live column in the summary.
 *                 Today's live counters used to leak into reports for past
 *                 dates; the top bar's Live / Total are the only live figures.
 */
import { calendarDayKey, dayKeyToLocalDate, zonedDayKey } from "@/lib/format";

export interface ReportsPolicy {
  includeToday: boolean;
  showLive: boolean;
}

export const REPORTS_POLICY: ReportsPolicy = {
  includeToday: false,
  showLive: false,
};

/** "YYYY-MM-DD" of the newest day a report may cover, in the portal time zone. */
export function latestReportDayKey(timeZone: string): string {
  const todayKey = zonedDayKey(Date.now(), timeZone);
  if (REPORTS_POLICY.includeToday) return todayKey;
  const d = dayKeyToLocalDate(todayKey);
  d.setDate(d.getDate() - 1);
  return calendarDayKey(d);
}

/** The same day as a local calendar date (what the date picker works in). */
export function latestReportDay(timeZone: string): Date {
  return dayKeyToLocalDate(latestReportDayKey(timeZone));
}

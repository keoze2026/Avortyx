/**
 * Instant Reports.
 *
 * A Reports view (date range + time zone) needs the full call list plus four
 * aggregates. Downloading them took a few seconds on every switch - including
 * back to a day that had just been shown. Like the Dashboard (see
 * lib/dashboard-snapshot.ts), the last data of each view is now kept and shown
 * at once, with a refresh behind it, and the views people open most are loaded
 * in advance:
 *
 *   - memory (and this tab's sessionStorage when small) per signed-in user;
 *   - identical requests are shared, so a prefetch and the page never ask twice;
 *   - only ever the data OF THAT VIEW - never another day's figures;
 *   - when the reports PIN locks again, saved copies of earlier days are dropped;
 *   - a view that ends before today never changes, so once loaded it is kept
 *     for the whole session (no 6-hour expiry) and opens with no download -
 *     but only a copy downloaded after that day was over (CH-286, see
 *     `isFinalReport`);
 *   - the last 7 days are loaded in advance, one at a time, so opening any of
 *     them is instant too.
 */

import {
  analyticsService,
  type EntitySummary,
  type SummaryEntity,
} from "@/lib/api/services/analytics.service";
import { zonedDayKey } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSecurityStore } from "@/lib/store/security-store";
import type { Call } from "@/lib/types";

export interface ReportView {
  dateFrom: string;
  dateTo: string;
  timeZone: string;
}

export interface ReportData {
  calls: Call[];
  summaries: Record<SummaryEntity, EntitySummary[]>;
  takenAt: number;
}

/* v2 (CH-286): copies saved by v1 may be a day's report taken while that day
 * was still running, kept as if final. They are never read again. */
const STORAGE_PREFIX = "vortyx.reports-view.v2:";
/**
 * A day is final this long after it ends. A call is recorded when it ENDS but
 * belongs to the day it started, so a call still running at midnight joins
 * that day's report after midnight.
 */
const DAY_SETTLE_MS = 2 * 60 * 60 * 1000;
/** Views kept in memory: today, yesterday, the 7 days loaded in advance, and a few more. */
const MAX_ENTRIES = 14;
/** Past days loaded in advance (yesterday back to this many days ago). */
const PREFETCH_PAST_DAYS = 7;
/** Saved data older than this is not shown while a fresh copy loads. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
/**
 * Today's saved copy is shown while a fresh one loads only if it is this young.
 * Older than that (a page refresh, or coming back after a while) it is half a
 * report: the chart and summary showed a copy hours old, up to 6, and then
 * jumped when the real one landed. Past days never change, so they are exempt.
 */
export const TODAY_SHOW_MAX_AGE_MS = 30_000;
/** A prefetch is skipped if the saved copy is younger than this. */
const PREFETCH_FRESH_MS = 60_000;
/** Larger views stay in memory only (sessionStorage holds ~5 MB). */
const MAX_STORED_CHARS = 1_500_000;

const memory = new Map<string, ReportData>(); // insertion order = oldest first
const inFlight = new Map<string, Promise<ReportData>>();

/** Identifies one view for the signed-in user. Null when nobody is signed in. */
export function reportKey(view: ReportView): string | null {
  const uid = useAuthStore.getState().user?.id;
  if (!uid) return null;
  return [uid, view.dateFrom, view.dateTo, view.timeZone].join("|");
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function looksLikeReport(v: unknown): v is ReportData {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return typeof r.takenAt === "number" && Array.isArray(r.calls) && !!r.summaries && typeof r.summaries === "object";
}

/** Does this view end before today in its own time zone? Such a view never changes. */
export function isPastView(view: ReportView): boolean {
  return view.dateTo < zonedDayKey(Date.now(), view.timeZone);
}

/** A view key's own "ends before today" check (key = user|from|to|zone). */
function keyIsPast(key: string): boolean {
  const [, , to, tz] = key.split("|");
  if (!to || !tz) return false;
  try {
    return to < zonedDayKey(Date.now(), tz);
  } catch {
    return false;
  }
}

/**
 * Was this copy downloaded after the view's last day was over? Only then is
 * it the whole report.
 *
 * Sir, 26 Oct: Friday 23 Oct showed 11 calls on one admin's screen, 40 on
 * another's and 1,591 on a third. Each had looked at "today" on the 23rd in a
 * tab still open (11 calls at about 7 am, 40 at 8 am). From the 24th that
 * copy counted as a past day - "never changes" - so it was shown with no
 * download, the timer never reloads a past day, and the export took its
 * statuses from it.
 */
function takenAfterEnd(dateTo: string, timeZone: string, takenAt: number): boolean {
  try {
    return dateTo < zonedDayKey(takenAt - DAY_SETTLE_MS, timeZone);
  } catch {
    return false;
  }
}

/** Is this saved copy the finished report of a past view, safe to show with no download? */
export function isFinalReport(view: ReportView, data: ReportData): boolean {
  return isPastView(view) && takenAfterEnd(view.dateTo, view.timeZone, data.takenAt);
}

/** Saved data still good to show: a past view's finished copy always, any other for MAX_AGE_MS. */
function stillGood(key: string, data: ReportData): boolean {
  const [, , to, tz] = key.split("|");
  const final = keyIsPast(key) && !!to && !!tz && takenAfterEnd(to, tz, data.takenAt);
  return final || Date.now() - data.takenAt <= MAX_AGE_MS;
}

/** The saved data of exactly this view, or null. */
export function getCachedReport(key: string | null): ReportData | null {
  if (!key) return null;
  const hit = memory.get(key);
  if (hit) return stillGood(key, hit) ? hit : null;
  const ss = storage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!looksLikeReport(parsed) || !stillGood(key, parsed)) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function putCachedReport(key: string, data: ReportData): void {
  memory.delete(key);
  memory.set(key, data);
  const ss = storage();
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
    try {
      ss?.removeItem(STORAGE_PREFIX + oldest);
    } catch {
      /* ignore */
    }
  }
  if (!ss) return;
  try {
    const json = JSON.stringify(data);
    if (json.length <= MAX_STORED_CHARS) ss.setItem(STORAGE_PREFIX + key, json);
    else ss.removeItem(STORAGE_PREFIX + key);
  } catch {
    /* storage full: memory is enough */
  }
}

/**
 * The past days of a range that reaches today, kept for the session (CH-232).
 *
 * A month opened on the 23rd took over 10 seconds (Sir, 23 Oct). A range that
 * includes today has live calls in it, and the backend then reads every row up
 * to the page asked for, page after page - page 22 of a month re-read about
 * 11,000 calls. A range that ended yesterday takes the backend's fast path and
 * its finished-days cache. So the call list of such a range is loaded as two:
 * the past days (fast, cached by the backend, and kept here so a refresh or the
 * automatic update never downloads them again) and today (small, live).
 */
const PAST_CALLS_KEEP = 6;
const PAST_CALLS_RECHECK_MS = 10 * 60 * 1000;
const pastCalls = new Map<string, { calls: Promise<Call[]>; takenAt: number }>();

/** "2026-10-23" -> "2026-10-22", whatever the time zone. */
function dayBefore(dayKey: string): string {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function callsForView(view: ReportView): Promise<Call[]> {
  const load = (dateFrom: string, dateTo: string) =>
    analyticsService.allCalls({ dateFrom, dateTo }, { timeZone: view.timeZone });
  const today = zonedDayKey(Date.now(), view.timeZone);
  if (!(view.dateFrom < today && view.dateTo >= today)) return load(view.dateFrom, view.dateTo);

  const pastTo = dayBefore(today);
  const key = [useAuthStore.getState().user?.id ?? "", view.dateFrom, pastTo, view.timeZone].join("|");
  // Kept for the session only once yesterday was over when it was downloaded
  // (CH-286); a copy taken just after midnight lacks the calls that were still
  // running, so it is downloaded again every 10 minutes until then.
  const kept = pastCalls.get(key);
  const keep =
    !!kept &&
    (takenAfterEnd(pastTo, view.timeZone, kept.takenAt) || Date.now() - kept.takenAt < PAST_CALLS_RECHECK_MS);
  let past = keep ? kept.calls : undefined;
  if (!past) {
    const loading = load(view.dateFrom, pastTo);
    past = loading;
    pastCalls.delete(key);
    pastCalls.set(key, { calls: loading, takenAt: Date.now() });
    loading.catch(() => {
      if (pastCalls.get(key)?.calls === loading) pastCalls.delete(key);
    });
    while (pastCalls.size > PAST_CALLS_KEEP) {
      const oldest = pastCalls.keys().next().value;
      if (oldest === undefined) break;
      pastCalls.delete(oldest);
    }
  }
  // Newest first, as the backend returns them: today, then the earlier days.
  return Promise.all([load(today, view.dateTo), past]).then(([now, earlier]) => [...now, ...earlier]);
}

/** Download a view (calls + the four aggregates), sharing an identical request in flight. */
export function loadReportShared(view: ReportView): Promise<ReportData> {
  const key = reportKey(view);
  const shared = key ? inFlight.get(key) : undefined;
  if (shared) return shared;
  const range = { dateFrom: view.dateFrom, dateTo: view.dateTo, timezone: view.timeZone };
  const request = Promise.all([
    callsForView(view),
    // Each aggregate is independent - a failing one just leaves its tab on the
    // call-log derivation instead of blanking the others.
    Promise.all(
      (["campaign", "buyer", "publisher", "carrier"] as const).map((entity) =>
        analyticsService.entitySummary(entity, range).catch(() => [] as EntitySummary[]),
      ),
    ),
  ]).then(([calls, [campaign, buyer, publisher, carrier]]) => {
    const data: ReportData = { calls, summaries: { campaign, buyer, publisher, carrier }, takenAt: Date.now() };
    if (key) putCachedReport(key, data);
    return data;
  });
  if (!key) return request;
  const tracked = request.finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
}

/** Is history (yesterday and earlier) open right now? Only then is it prefetched. */
function historyOpen(): boolean {
  const s = useSecurityStore.getState();
  if (s.load === "unavailable") return true;
  return s.load === "ready" && (!s.configured || s.unlocked);
}

/** Load a view in the background, quietly, unless a fresh copy is already saved. */
export function prefetchReport(view: ReportView): void {
  const key = reportKey(view);
  if (!key) return;
  const today = zonedDayKey(Date.now(), view.timeZone);
  if (view.dateFrom < today && !historyOpen()) return; // would only be refused (PIN)
  const cached = getCachedReport(key);
  if (cached && Date.now() - cached.takenAt < PREFETCH_FRESH_MS) return;
  loadReportShared(view).catch(() => undefined);
}

/**
 * Load the last PREFETCH_PAST_DAYS days in the background, one day at a time
 * (never a burst of requests), skipping any already saved. Past days never
 * change, so each is downloaded at most once per session.
 */
let pastPrefetchRunning = false;
export function prefetchRecentDays(timeZone: string): void {
  if (pastPrefetchRunning || !historyOpen()) return;
  pastPrefetchRunning = true;
  void (async () => {
    try {
      for (let back = 1; back <= PREFETCH_PAST_DAYS; back++) {
        if (!historyOpen()) return;
        const day = zonedDayKey(Date.now() - back * 24 * 60 * 60 * 1000, timeZone);
        const view = { dateFrom: day, dateTo: day, timeZone };
        const saved = getCachedReport(reportKey(view));
        if (saved && isFinalReport(view, saved)) continue;
        await loadReportShared(view).catch(() => undefined);
      }
    } finally {
      pastPrefetchRunning = false;
    }
  })();
}

/** Today's and yesterday's views in this time zone - the two people switch between. */
export function todayAndYesterday(timeZone: string): [ReportView, ReportView] {
  const today = zonedDayKey(Date.now(), timeZone);
  const yesterday = zonedDayKey(Date.now() - 24 * 60 * 60 * 1000, timeZone);
  return [
    { dateFrom: today, dateTo: today, timeZone },
    { dateFrom: yesterday, dateTo: yesterday, timeZone },
  ];
}

/** Forget saved copies of views that start before today (keep today's). */
export function dropHistoricalReports(): void {
  const historical = (key: string) => {
    const [, from, , tz] = key.split("|");
    return !!from && !!tz && from < zonedDayKey(Date.now(), tz);
  };
  for (const k of [...memory.keys()]) if (historical(k)) memory.delete(k);
  // The kept past days of month-to-date views go too (CH-232).
  pastCalls.clear();
  const ss = storage();
  if (!ss) return;
  const doomed: string[] = [];
  for (let i = 0; i < ss.length; i++) {
    const k = ss.key(i);
    if (k && k.startsWith(STORAGE_PREFIX) && historical(k.slice(STORAGE_PREFIX.length))) doomed.push(k);
  }
  doomed.forEach((k) => ss.removeItem(k));
}

if (typeof window !== "undefined") {
  let wasUnlocked = useSecurityStore.getState().unlocked;
  useSecurityStore.subscribe((s) => {
    if (wasUnlocked && !s.unlocked) dropHistoricalReports();
    wasUnlocked = s.unlocked;
  });
}
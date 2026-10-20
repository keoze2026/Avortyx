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
 *     for the whole session (no 6-hour expiry) and opens with no download;
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

const STORAGE_PREFIX = "vortyx.reports-view.v1:";
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

/** Saved data still good to show: a past view always, today's for MAX_AGE_MS. */
function stillGood(key: string, data: ReportData): boolean {
  return keyIsPast(key) || Date.now() - data.takenAt <= MAX_AGE_MS;
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

/** Download a view (calls + the four aggregates), sharing an identical request in flight. */
export function loadReportShared(view: ReportView): Promise<ReportData> {
  const key = reportKey(view);
  const shared = key ? inFlight.get(key) : undefined;
  if (shared) return shared;
  const range = { dateFrom: view.dateFrom, dateTo: view.dateTo, timezone: view.timeZone };
  const request = Promise.all([
    analyticsService.allCalls({ dateFrom: view.dateFrom, dateTo: view.dateTo }, { timeZone: view.timeZone }),
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
        if (getCachedReport(reportKey(view))) continue;
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
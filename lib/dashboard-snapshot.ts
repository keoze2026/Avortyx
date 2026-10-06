/**
 * Instant Dashboard.
 *
 * Everything on the Dashboard comes from one request (GET /api/analytics/snapshot)
 * and that request is not quick: the server builds the totals, campaigns, the
 * hourly series and every destination's counters on demand. The page used to
 * (a) start it only after the page had mounted, behind the ~17 requests the app
 * fires at sign-in, and (b) throw away what it was showing the moment anything
 * changed - so every visit began with empty panels, and so did every date or
 * destination change.
 *
 * This module fixes that without touching the server:
 *   - the last snapshot of each view is kept (memory + this tab's sessionStorage),
 *     so the page paints it in the same frame and refreshes behind it;
 *   - identical requests are shared, so the prefetch and the page never ask twice;
 *   - the snapshot for "today" is requested at sign-in (prefetchDashboardSnapshot),
 *     before the other stores, so it is usually waiting when the page opens.
 *
 * A cached snapshot is always shown with its own "Updated hh:mm" time, and the
 * cache is per signed-in user.
 */

import {
  analyticsService,
  type DashboardSnapshot,
  type SnapshotQuery,
} from "@/lib/api/services/analytics.service";
import { zonedDayKey } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";

const STORAGE_PREFIX = "vortyx.dashboard-snapshot.v1:";
const MAX_ENTRIES = 8;
/** A snapshot older than this is not shown while waiting for a fresh one. */
const MAX_AGE_MS = 6 * 60 * 60 * 1000;
/** prefetch does nothing if the cached "today" snapshot is younger than this. */
const PREFETCH_FRESH_MS = 20_000;

const memory = new Map<string, DashboardSnapshot>(); // insertion order = oldest first
const inFlight = new Map<string, Promise<DashboardSnapshot>>();

export type SnapshotView = Pick<SnapshotQuery, "dateFrom" | "dateTo" | "timeZone" | "destination">;

/** Identifies one view (user + range + zone + destination). Null when nobody is signed in. */
export function snapshotKey(view: SnapshotView): string | null {
  const uid = useAuthStore.getState().user?.id;
  if (!uid) return null;
  return [uid, view.dateFrom ?? "", view.dateTo ?? "", view.timeZone ?? "", view.destination ?? "*"].join("|");
}

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.sessionStorage;
  } catch {
    return null;
  }
}

function looksLikeSnapshot(v: unknown): v is DashboardSnapshot {
  if (!v || typeof v !== "object") return false;
  const s = v as Record<string, unknown>;
  return (
    typeof s.takenAt === "number" &&
    !!s.kpis && typeof s.kpis === "object" &&
    Array.isArray(s.campaigns) &&
    Array.isArray(s.timeSeries) &&
    Array.isArray(s.destinations)
  );
}

/** The last snapshot for this view, or null. Safe on the server (returns null). */
export function getCachedSnapshot(key: string | null): DashboardSnapshot | null {
  if (!key) return null;
  const hit = memory.get(key);
  if (hit) return Date.now() - hit.takenAt <= MAX_AGE_MS ? hit : null;
  const ss = storage();
  if (!ss) return null;
  try {
    const raw = ss.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!looksLikeSnapshot(parsed) || Date.now() - parsed.takenAt > MAX_AGE_MS) return null;
    memory.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

export function putCachedSnapshot(key: string | null, snap: DashboardSnapshot): void {
  if (!key) return;
  memory.delete(key);
  memory.set(key, snap);
  const ss = storage();
  while (memory.size > MAX_ENTRIES) {
    const oldest = memory.keys().next().value;
    if (oldest === undefined) break;
    memory.delete(oldest);
    // Keep the tab's storage to the same latest few views.
    try {
      ss?.removeItem(STORAGE_PREFIX + oldest);
    } catch {
      /* ignore */
    }
  }
  if (!ss) return;
  try {
    ss.setItem(STORAGE_PREFIX + key, JSON.stringify(snap));
  } catch {
    // Storage full: drop our old entries and try once more; otherwise memory is enough.
    clearStoredSnapshots(ss);
    try {
      ss.setItem(STORAGE_PREFIX + key, JSON.stringify(snap));
    } catch {
      /* ignore */
    }
  }
}

function clearStoredSnapshots(ss: Storage): void {
  const doomed: string[] = [];
  for (let i = 0; i < ss.length; i++) {
    const k = ss.key(i);
    if (k && k.startsWith(STORAGE_PREFIX)) doomed.push(k);
  }
  doomed.forEach((k) => ss.removeItem(k));
}

/** Forget every cached snapshot (call after changing something the dashboard
 *  adds up - for example a campaign's price - so no stale figure is shown). */
export function invalidateSnapshots(): void {
  memory.clear();
  const ss = storage();
  if (ss) clearStoredSnapshots(ss);
}

/**
 * Fetch a snapshot, sharing the request with anyone else asking for the same
 * view right now, and remember the answer. The Dashboard always asks for the
 * hourly series (it adds hours up into days and weeks itself).
 */
export function loadSnapshotShared(view: SnapshotView): Promise<DashboardSnapshot> {
  const key = snapshotKey(view);
  const shared = key ? inFlight.get(key) : undefined;
  if (shared) return shared;

  const request = analyticsService
    .snapshot({ ...view, granularity: "hour" })
    .then((snap) => {
      putCachedSnapshot(key, snap);
      return snap;
    });
  if (!key) return request;

  const tracked = request.finally(() => {
    if (inFlight.get(key) === tracked) inFlight.delete(key);
  });
  inFlight.set(key, tracked);
  return tracked;
}

/**
 * Start loading today's all-destinations snapshot now (at sign-in), so it is
 * ready or nearly ready by the time the Dashboard opens. Quiet on failure.
 */
export function prefetchDashboardSnapshot(timeZone: string): void {
  const today = zonedDayKey(Date.now(), timeZone);
  const view: SnapshotView = { dateFrom: today, dateTo: today, timeZone };
  const key = snapshotKey(view);
  if (!key) return;
  const cached = getCachedSnapshot(key);
  if (cached && Date.now() - cached.takenAt < PREFETCH_FRESH_MS) return;
  loadSnapshotShared(view).catch(() => undefined);
}
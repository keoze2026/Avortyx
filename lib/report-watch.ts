"use client";

/**
 * Keeps today's report current by itself, auto refresh or not (CH-220).
 *
 * With auto refresh Off the Reports page never reloaded: the candles, the
 * donut, the summary and the call log stayed as they were until someone
 * pressed Refresh (Sir, 23 Oct). Reloading the whole day on a short timer just
 * to find out would be wasteful, so the page asks the backend a cheap question
 * instead - GET /api/analytics/report-stamp, a fingerprint of the calls in the
 * very same view (days, time zone, partner scope) plus the server's time - and
 * reloads only when the fingerprint changes:
 *
 *   - every WATCH_MS while the tab is visible, and straight away when the tab
 *     comes back into view;
 *   - only for a range that includes today (past days never change);
 *   - a change starts a quiet reload: the figures on screen stay until the new
 *     ones arrive, exactly like an auto refresh;
 *   - if a reload is already running the change is kept for the next check,
 *     so nothing is missed.
 *
 * It also returns the server time at which the data on screen was last
 * confirmed current, for the "Updated" label beside the Refresh button.
 */
import { useEffect, useRef, useState } from "react";

import { http } from "@/lib/api/http";

/** How often the page asks whether the report has changed. */
export const REPORT_WATCH_MS = 10_000;

export interface ReportWatchView {
  dateFrom: string;
  dateTo: string;
  timeZone: string;
}

interface StampWire {
  stamp?: string;
  asOf?: string;
}

const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

export function useReportChangeWatch({
  view,
  enabled,
  onChange,
}: {
  view: ReportWatchView | null;
  /** False for past ranges, while the reports PIN is locked, or with no view. */
  enabled: boolean;
  /** Reload the report quietly. Returns false when it could not start now
   *  (a load is already running), so the change is checked again next time. */
  onChange: () => boolean;
}): number | null {
  const [confirmedAt, setConfirmedAt] = useState<number | null>(null);
  const known = useRef<{ key: string; stamp: string } | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const dateFrom = view?.dateFrom ?? "";
  const dateTo = view?.dateTo ?? "";
  const timeZone = view?.timeZone ?? "";

  useEffect(() => {
    setConfirmedAt(null);
    if (!enabled || !dateFrom) return;
    const key = `${dateFrom}|${dateTo}|${timeZone}`;
    let cancelled = false;
    let running = false;

    const check = async () => {
      if (running || cancelled || !visible()) return;
      running = true;
      try {
        const wire = await http.get<StampWire>("/api/analytics/report-stamp", {
          query: { dateFrom, dateTo, timezone: timeZone },
        });
        if (cancelled || !wire?.stamp) return;
        const serverTime = wire.asOf ? Date.parse(wire.asOf) : NaN;
        const prev = known.current;
        if (!prev || prev.key !== key || prev.stamp === wire.stamp) {
          // First look at this view, or nothing changed: what is on screen is
          // current as of the server's time.
          known.current = { key, stamp: wire.stamp };
          if (Number.isFinite(serverTime)) setConfirmedAt(serverTime);
          return;
        }
        // Something changed. Remember the new fingerprint only once the reload
        // has started; otherwise the next check sees the change again.
        if (onChangeRef.current()) known.current = { key, stamp: wire.stamp };
      } catch {
        // Quiet: a failed check changes nothing on screen; the next one retries.
      } finally {
        running = false;
      }
    };

    void check();
    const timer = window.setInterval(() => void check(), REPORT_WATCH_MS);
    const onWake = () => void check();
    window.addEventListener("focus", onWake);
    document.addEventListener("visibilitychange", onWake);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      window.removeEventListener("focus", onWake);
      document.removeEventListener("visibilitychange", onWake);
    };
  }, [enabled, dateFrom, dateTo, timeZone]);

  return confirmedAt;
}

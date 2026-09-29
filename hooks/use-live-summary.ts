"use client";

/**
 * Live Monitor counters — polled from `GET /api/analytics/live/summary`.
 *
 * Started / Completed / Missed / Revenue and the featured call used to be
 * tallied from WebSocket events seen since the page opened. A call that began
 * before the page loaded was never counted, so a refresh showed calls in flight
 * with every counter at 0. The backend now returns today's totals, so they are
 * read from there and survive a refresh.
 *
 * The radar (in-flight dots and count) still runs on the WebSocket — see
 * useLiveSocket. This hook only supplies the counters and the featured call.
 */

import { useEffect, useState } from "react";

import { http } from "@/lib/api/http";
import type { Call } from "@/lib/types";

/** How often the counters refresh. */
const POLL_MS = 10_000;

/** Response after the HTTP client's snake_case → camelCase conversion. */
interface LiveSummaryWire {
  asOf: string;
  inFlight: number;
  started: number;
  completed: number;
  missed: number;
  /** Django Decimal — arrives as a string ("52.00"). */
  revenue: string | number;
  longestActive: {
    id: string;
    callerNumber: string;
    campaignName: string;
    startedAt: string;
    seconds: number;
  } | null;
}

export interface LiveSummary {
  inFlight: number;
  totals: { started: number; completed: number; missed: number; revenue: number };
  longestActive: {
    id: string;
    callerNumber: string;
    campaignName: string;
    /** Local-clock start (ms), derived from the backend's elapsed seconds so a
     *  skewed browser clock can't throw the featured call's timer off. */
    startedAt: number;
    seconds: number;
  } | null;
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

function fromWire(w: LiveSummaryWire): LiveSummary {
  const la = w.longestActive;
  const seconds = la ? toNumber(la.seconds) : 0;
  return {
    inFlight: toNumber(w.inFlight),
    totals: {
      started: toNumber(w.started),
      completed: toNumber(w.completed),
      missed: toNumber(w.missed),
      revenue: toNumber(w.revenue),
    },
    longestActive: la
      ? {
          id: String(la.id),
          callerNumber: la.callerNumber ?? "",
          campaignName: la.campaignName ?? "",
          startedAt: Date.now() - seconds * 1000,
          seconds,
        }
      : null,
  };
}

/** A card-ready Call for the featured slot when the WebSocket list doesn't
 *  hold the longest active call (e.g. it began before the page opened and
 *  fell outside the in-flight cap). Only the fields the summary carries are
 *  filled; the rest are neutral. */
export function longestActiveToCall(la: NonNullable<LiveSummary["longestActive"]>): Call {
  return {
    id: la.id,
    campaignId: "",
    campaignName: la.campaignName,
    callerNumber: la.callerNumber,
    destinationNumber: "",
    startedAt: la.startedAt,
    durationSec: la.seconds,
    status: "in-progress",
    payout: 0,
    revenue: 0,
    geo: { country: "" },
  };
}

interface UseLiveSummaryOptions {
  /** Mirrors the page's pause toggle: while paused the figures hold still. */
  paused: boolean;
}

/** Returns null until the first response lands. Failed polls keep the last
 *  good figures on screen rather than dropping back to zero. */
export function useLiveSummary({ paused }: UseLiveSummaryOptions): LiveSummary | null {
  const [summary, setSummary] = useState<LiveSummary | null>(null);

  useEffect(() => {
    if (paused) return;

    let cancelled = false;
    let busy = false;
    let timer: number | undefined;

    const tick = async () => {
      window.clearTimeout(timer);
      // Skip the request while the tab is hidden — nobody is looking, and it
      // keeps a background tab from spending the API rate limit.
      if (!busy && document.visibilityState !== "hidden") {
        busy = true;
        try {
          const wire = await http.get<LiveSummaryWire>("/api/analytics/live/summary");
          if (!cancelled) setSummary(fromWire(wire));
        } catch {
          // Keep the last good figures; the next poll retries.
        } finally {
          busy = false;
        }
      }
      if (!cancelled) timer = window.setTimeout(tick, POLL_MS);
    };

    // Refresh straight away when the tab comes back into view. If a request
    // is already running it schedules the next poll itself.
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !busy) void tick();
    };

    void tick();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused]);

  return summary;
}
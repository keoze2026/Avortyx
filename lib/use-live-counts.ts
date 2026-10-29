"use client";

/**
 * Calls up right now, per tracking number and per destination (CH-212).
 *
 * Feeds the LIVE column on the campaign page (Routed Destinations and
 * Tracking Numbers), as Revo shows it. Asks the backend's live-counts endpoint
 * (two grouped queries, backend CH-211) every few seconds while the page is
 * open and the tab is visible. "Live" is the Destinations page's own rule, so
 * both pages show the same figure. Counts are keyed by the number's last 10
 * digits; `liveFor` accepts the number written any way.
 */

import { useCallback, useEffect, useState } from "react";

import { http } from "@/lib/api/http";

const POLL_MS = 20_000; // CH-381: was 10 s

export interface LiveCounts {
  tracking: Record<string, number>;
  destinations: Record<string, number>;
}

const EMPTY: LiveCounts = { tracking: {}, destinations: {} };

export function last10(number: string | null | undefined): string {
  return (number ?? "").replace(/\D/g, "").slice(-10);
}

export function liveFor(counts: Record<string, number>, number: string | null | undefined): number {
  return counts[last10(number)] ?? 0;
}

export function useLiveCounts(): LiveCounts & { loaded: boolean } {
  const [counts, setCounts] = useState<LiveCounts>(EMPTY);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    try {
      // Read raw: the keys are digits and must reach us exactly as sent.
      const res = await http.get<Partial<LiveCounts>>("/api/routing/calls/live-counts", {
        rawResponse: true,
      });
      setCounts({ tracking: res?.tracking ?? {}, destinations: res?.destinations ?? {} });
      setLoaded(true);
    } catch {
      // Keep the last figures; the next tick tries again.
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    document.addEventListener("visibilitychange", load);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", load);
    };
  }, [load]);

  return { ...counts, loaded };
}

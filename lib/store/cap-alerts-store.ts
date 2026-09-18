/**
 * Cap alerts — the operator-facing record of "this destination / campaign
 * is about to hit (or has hit) its cap".
 *
 * Produced by `useCapWatchRuntime` from the live counters the app already
 * polls; nothing here talks to the network. Two jobs:
 *
 *   1. `fired` — dedupe. Each (entity, metric, level, period) fires exactly
 *      once, so the 15 s poll doesn't re-announce the same 97 / 100 every
 *      tick, but a new day / month (or the counter climbing from "almost"
 *      to "reached") does announce again.
 *   2. `alerts` — the feed the bell menu shows, newest first, capped.
 *
 * Persisted so a refresh doesn't replay banners the operator already saw.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type CapEntityType = "destination" | "campaign";
export type CapMetric = "daily" | "monthly" | "concurrency";
export type CapLevel = "near" | "reached";

export interface CapAlert {
  /** Stable id: `${entityType}:${entityId}:${metric}:${level}:${period}`. */
  id: string;
  entityType: CapEntityType;
  entityId: string;
  entityName: string;
  /** Destination TFN (destinations only). */
  tfn?: string;
  /** Owning buyer's name (destinations only). */
  buyer?: string;
  metric: CapMetric;
  level: CapLevel;
  used: number;
  cap: number;
  /** 0–100. */
  pct: number;
  at: number;
}

const MAX_ALERTS = 50;

interface CapAlertsState {
  alerts: CapAlert[];
  fired: Record<string, true>;
  /** Record an alert if its id hasn't fired yet. Returns true when it was new. */
  record: (alert: CapAlert) => boolean;
  clear: () => void;
}

export const useCapAlertsStore = create<CapAlertsState>()(
  persist(
    (set, get) => ({
      alerts: [],
      fired: {},
      record: (alert) => {
        if (get().fired[alert.id]) return false;
        set((s) => {
          // Keep `fired` bounded to what the feed still remembers plus a
          // margin, so it can't grow forever across months of use.
          const alerts = [alert, ...s.alerts].slice(0, MAX_ALERTS);
          const fired: Record<string, true> = { ...s.fired, [alert.id]: true };
          const keys = Object.keys(fired);
          if (keys.length > MAX_ALERTS * 4) {
            for (const k of keys.slice(0, keys.length - MAX_ALERTS * 4)) delete fired[k];
          }
          return { alerts, fired };
        });
        return true;
      },
      clear: () => set({ alerts: [], fired: {} }),
    }),
    {
      name: "avortyx.cap-alerts",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

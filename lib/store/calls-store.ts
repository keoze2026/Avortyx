/**
 * Calls store — backed by /api/analytics/calls (paginated) and
 * /api/analytics/dashboard for the headline KPIs.
 *
 * Keeps a rolling cache of recent calls (last `pageSize` rows) so the
 * dashboard, reports page, and topbar counters can read synchronously.
 * Heavy filtering / pagination is delegated to the backend via the
 * `fetchPage()` method which the Call Log table uses directly.
 */

"use client";

import { create } from "zustand";

import { useOnboardingStore } from "@/lib/store/onboarding-store";
import {
  analyticsService,
  type CallLogPage,
  type CallLogQuery,
  type DashboardKpis,
  type TimeSeriesPoint,
} from "@/lib/api/services/analytics.service";
import type { Call } from "@/lib/types";

interface CallsState {
  /** Most recent N calls — used by the dashboard's chart components. */
  recent: Call[];
  /** Headline KPIs from /api/analytics/dashboard. */
  kpis: DashboardKpis | null;
  /** Cached time-series for the dashboard hourly/day chart. */
  timeSeries: TimeSeriesPoint[];
  /** In-flight call count for the header, kept fresh by lib/live-count.ts (one
   *  writer for the whole app). The topbar reads this in preference to the
   *  slower kpis.liveCalls - but only while `liveCountAt` is set. */
  liveCount: number;
  /** When `liveCount` was last confirmed by the server (ms since epoch), or
   *  null when it is unknown - for example before the first answer, or after
   *  the server stopped answering. Null makes the header fall back to kpis. */
  liveCountAt: number | null;
  /** True while the Dashboard supplies the header figures from its snapshot,
   *  so the topbar skips its own poll and both read the same moment. */
  snapshotDrivesKpis: boolean;

  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetchRecent: (pageSize?: number) => Promise<void>;
  fetchKpis: () => Promise<void>;
  fetchTimeSeries: (query?: { dateFrom?: string; dateTo?: string; granularity?: "hour" | "day" | "week" | "month" }) => Promise<void>;
  fetchPage: (query: CallLogQuery) => Promise<CallLogPage>;
  setLiveCount: (n: number) => void;
  /** Forget the live count (it can no longer be trusted). */
  clearLiveCount: () => void;
  setKpis: (kpis: DashboardKpis) => void;
  setSnapshotDrivesKpis: (on: boolean) => void;
}

const RECENT_DEFAULT = 200;

export const useCallsStore = create<CallsState>()((set) => ({
  recent: [],
  kpis: null,
  timeSeries: [],
  liveCount: 0,
  liveCountAt: null,
  snapshotDrivesKpis: false,
  loading: false,
  error: null,
  hydrated: false,

  fetchRecent: async (pageSize = RECENT_DEFAULT) => {
    set({ loading: true, error: null });
    try {
      const page = await analyticsService.calls({ page: 1, pageSize });
      set({ recent: page.items, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  fetchKpis: async () => {
    try {
      const kpis = await analyticsService.dashboard();
      set({ kpis });
      // The dashboard payload carries the account balance alongside the
      // call counters, and the topbar polls it every 15s — so it is the
      // freshest balance the app has. Mirror it into the onboarding store,
      // which the header wallet and the balance gate read, instead of
      // leaving those on the one-shot /api/billing/account fetch.
      if (kpis.balance !== undefined) {
        useOnboardingStore.getState().setBalance(kpis.balance);
      }
    } catch (e) {
      set({ error: messageFromError(e) });
    }
  },

  fetchTimeSeries: async (query = {}) => {
    try {
      const timeSeries = await analyticsService.timeSeries(query);
      set({ timeSeries });
    } catch (e) {
      set({ error: messageFromError(e) });
    }
  },

  // Pass-through to the analytics service; callers manage their own paging UI.
  fetchPage: (query) => analyticsService.calls(query),

  setLiveCount: (n) => set({ liveCount: n, liveCountAt: Date.now() }),

  clearLiveCount: () => set({ liveCountAt: null }),

  setKpis: (kpis) => {
    set({ kpis });
    if (kpis.balance !== undefined) {
      useOnboardingStore.getState().setBalance(kpis.balance);
    }
  },

  setSnapshotDrivesKpis: (on) => set({ snapshotDrivesKpis: on }),
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Calls request failed";
}
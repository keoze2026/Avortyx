"use client";

import { PushNotifications } from "./push-notifications";
import { useAutoScheduleRuntime } from "@/lib/auto-schedule-runtime";
import * as React from "react";

import { useAnomalyPopupRuntime } from "@/lib/anomaly-popup-runtime";
import { useCapWatchRuntime } from "@/lib/cap-watch-runtime";
import { useAlertPreferencesStore } from "@/lib/store/alert-preferences-store";

/**
 * Mounted once at the (app) layout level. Boots client-side runtimes:
 * iPhone-style push banner stack, and the auto-schedule runtime that flips
 * campaigns / buyers / destinations between active and paused on schedule.
 *
 * The previous `useScheduledReportsRuntime()` that fired toast/push events
 * pretending to "send" scheduled report emails has been removed — backend
 * scheduling at /api/analytics/reports/* is now the source of truth; the
 * FE just persists the user's preference and the worker delivers.
 *
 * The legacy `useNotificationSimulator()` that injected synthetic alerts
 * ("Buyer hit cap", "Acceptance dipped") has been removed — the topbar
 * dropdown reads real AI anomalies via the AI Insights store, plus the
 * cap-watch alerts below, which come from the live destination / campaign
 * counters the app polls (see lib/cap-watch-runtime.ts). Both the cap
 * watch and the anomaly runtime only pop a banner for the kinds the
 * operator switched on under "Pop-up alerts" in the bell menu.
 */
export function NotificationRuntime() {
  // Pop-up preferences come from the backend (per user) — load them once
  // so the runtimes below gate banners on the operator's real choices.
  const fetchPrefs = useAlertPreferencesStore((s) => s.fetch);
  React.useEffect(() => {
    void fetchPrefs();
  }, [fetchPrefs]);
  useAutoScheduleRuntime();
  useCapWatchRuntime();
  useAnomalyPopupRuntime();
  return <PushNotifications />;
}

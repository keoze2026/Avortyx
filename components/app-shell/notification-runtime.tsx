"use client";

import { PushNotifications } from "./push-notifications";
import * as React from "react";

import { useAnomalyPopupRuntime } from "@/lib/anomaly-popup-runtime";
import { useCapWatchRuntime } from "@/lib/cap-watch-runtime";
import { useDeletedTfnsRuntime } from "@/lib/deleted-tfns-runtime";
import { useAlertPreferencesStore } from "@/lib/store/alert-preferences-store";

/**
 * Mounted once at the (app) layout level. Boots client-side runtimes:
 * the iPhone-style push banner stack and the alert watchers below.
 *
 * The browser auto-schedule runtime is gone (CH-203, Sir 22 Oct: "tfns
 * getting switched off automatically"). Every open tab ran it every 30
 * seconds and switched campaigns, buyers and destination lines on or off
 * from schedules saved in THAT browser's localStorage, using whoever was
 * logged in. A forgotten schedule in one browser kept switching lines off
 * for everybody, and it showed in the activity log as that person.
 * Campaign schedules are run by the server (tasks.apply_auto_schedules);
 * nothing in a browser changes anything by itself any more.
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
  useCapWatchRuntime();
  useAnomalyPopupRuntime();
  useDeletedTfnsRuntime();
  return <PushNotifications />;
}

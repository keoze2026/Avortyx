"use client";

/**
 * Mounts once inside the authenticated shell and triggers `fetch()` on the
 * core data stores so the dashboard, navigation badges, and detail pages
 * have data to read against. Re-runs only on full app remount, not on
 * route changes — each store keeps its own cached data.
 */

import { useEffect } from "react";

import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { useBlockedNumbersStore } from "@/lib/store/blocked-numbers-store";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCallsStore } from "@/lib/store/calls-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useSecurityStore } from "@/lib/store/security-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { useRoutingStore } from "@/lib/store/routing-store";
import { useIntegrationsStore } from "@/lib/store/integrations-store";
import { useNotificationsRulesStore } from "@/lib/store/notifications-rules-store";
import { useTcpaShieldStore } from "@/lib/store/tcpa-shield-store";
import { useVoipShieldStore } from "@/lib/store/voip-shield-store";
import { useWebhooksStore } from "@/lib/store/webhooks-store";
import { useWorkspaceMetaStore } from "@/lib/store/workspace-meta-store";
import { useAuthStore } from "@/lib/store/auth-store";

export function StoreHydrator() {
  const isAuthed = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthed) return;
    // Essentials first — what the header and the pages people open first
    // read. Each store handles its own loading + error state.
    // The reports PIN state applies to every login (buyers and publishers too).
    void useSecurityStore.getState().fetchStatus();
    void useBuyersStore.getState().fetch();
    void useCampaignsStore.getState().fetch();
    void usePublishersStore.getState().fetch();
    void useNumbersStore.getState().fetch();
    void useDestinationsStore.getState().fetch();
    void useDestinationsStore.getState().fetchStats();
    // Dashboard + reports data — KPIs, recent calls, time series.
    void useCallsStore.getState().fetchRecent();
    void useCallsStore.getState().fetchKpis();
    void useCallsStore.getState().fetchTimeSeries({ granularity: "hour" });

    // Everything else a moment later. Firing all ~17 requests together, on
    // top of the page's own, went past the server's limit of 20 requests in
    // flight per IP, and the last ones came back 429.
    const secondary = window.setTimeout(() => {
      loadSecondaryStores();
    }, SECONDARY_LOAD_DELAY_MS);
    return () => window.clearTimeout(secondary);
  }, [isAuthed]);

  // The per-entity live/hourly/daily counters (`liveCalls` on campaigns and
  // destinations, which buyers roll up from) only ever change server-side,
  // so a single fetch at login leaves every LIVE column frozen at whatever
  // it was when the app opened. Re-pull both lists on the same cadence the
  // topbar refreshes its KPI snapshot. Paused while the tab is hidden —
  // nobody's looking, and it keeps a backgrounded tab from hammering the API.
  useEffect(() => {
    if (!isAuthed) return;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      // On the Dashboard these figures come from its single snapshot
      // request, so the separate polls are skipped while it's showing.
      if (useCallsStore.getState().snapshotDrivesKpis) return;
      void useCampaignsStore.getState().fetch();
      void useDestinationsStore.getState().fetch();
      void useDestinationsStore.getState().fetchStats();
    };
    const id = window.setInterval(tick, LIVE_COUNTER_POLL_MS);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [isAuthed]);

  return null;
}

function loadSecondaryStores() {
  // AI Insights — recommendations + anomalies (cheap, rule-based on the backend).
  void useAiInsightsStore.getState().fetchAll();
  // Suppression list — blocked numbers (blacklist).
  void useBlockedNumbersStore.getState().fetch();
  // VoIP + TCPA shields (named policies).
  void useVoipShieldStore.getState().fetch();
  void useTcpaShieldStore.getState().fetch();
  // Routing plans (visual graphs ↔ flat backend rules via routing-bridge).
  void useRoutingStore.getState().fetch();
  // Webhooks (Integrations → Webhooks section).
  void useWebhooksStore.getState().fetch();
  // Notification rules (Settings → Notifications preferences matrix).
  void useNotificationsRulesStore.getState().fetch();
  // Integrations marketplace catalog.
  void useIntegrationsStore.getState().fetch();
  // Workspace meta: activity log + sessions + role catalog.
  void useWorkspaceMetaStore.getState().fetch();
}

const LIVE_COUNTER_POLL_MS = 15_000;

/** Delay before the non-essential stores load after sign-in / page load. */
const SECONDARY_LOAD_DELAY_MS = 1_500;
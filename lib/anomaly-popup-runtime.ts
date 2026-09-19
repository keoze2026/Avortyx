/**
 * AI-anomaly banners.
 *
 * The bell menu already lists every anomaly `/api/ai/anomalies` returns
 * (buyer with a high no-answer rate, AHT dipping, volume drops, …). This
 * hook additionally pops a banner at the top of the screen the first time
 * an anomaly shows up each day — but only for the kinds the operator has
 * switched on under "Pop-up alerts" (alert-preferences store).
 *
 *   missed   → "buyerMissed"   a buyer is missing / not answering calls
 *   low-aht  → "lowAht"        AHT below its normal range
 *   cap-over → handled by the cap-watch runtime (live counters); skipped
 *   other    → "other"         only when the anomaly is warning / critical
 */

"use client";

import * as React from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { zonedDayKey } from "@/lib/format";
import { anomalyToNotification } from "@/lib/notifications/mappers";
import { useAiInsightsStore } from "@/lib/store/ai-insights-store";
import { popupAllowed, type PopupAlertKind } from "@/lib/store/alert-preferences-store";
import { pushNotification } from "@/lib/store/push-notifications-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { NotificationItem } from "@/lib/mock/notifications";

const MAX_FIRED = 300;

interface LedgerState {
  fired: Record<string, true>;
  /** Mark a key fired; returns false when it already was. */
  mark: (key: string) => boolean;
}

/** Which (anomaly, day) pairs already popped — so a 60 s re-poll of the
 *  same anomaly doesn't re-announce it, but tomorrow's recurrence does. */
const useAnomalyPopupLedger = create<LedgerState>()(
  persist(
    (set, get) => ({
      fired: {},
      mark: (key) => {
        if (get().fired[key]) return false;
        set((s) => {
          const fired: Record<string, true> = { ...s.fired, [key]: true };
          const keys = Object.keys(fired);
          if (keys.length > MAX_FIRED) for (const k of keys.slice(0, keys.length - MAX_FIRED)) delete fired[k];
          return { fired };
        });
        return true;
      },
    }),
    { name: "avortyx.anomaly-popups", storage: createJSONStorage(() => localStorage) },
  ),
);

function popupKindFor(item: NotificationItem): PopupAlertKind | null {
  switch (item.alertKind) {
    case "missed":
      return "buyerMissed";
    case "low-aht":
      return "lowAht";
    case "cap-over":
      return null;
    default:
      // Generic anomalies only interrupt when the backend flags them.
      return item.severity === "critical" || item.severity === "warn" ? "other" : null;
  }
}

export function useAnomalyPopupRuntime() {
  const { t } = useTranslation();
  const anomalies = useAiInsightsStore((s) => s.anomalies);
  const timeZone = useUIStore((s) => s.reportTimezone);
  const mark = useAnomalyPopupLedger((s) => s.mark);

  React.useEffect(() => {
    if (anomalies.length === 0) return;
    const day = zonedDayKey(Date.now(), timeZone);
    for (const a of anomalies) {
      const item = anomalyToNotification(a);
      const kind = popupKindFor(item);
      if (!kind) continue;
      // Dedupe before the preference check so switching a kind on later
      // doesn't replay everything that was suppressed earlier today.
      if (!mark(`${a.id}|${day}`)) continue;
      if (!popupAllowed(kind)) continue;
      pushNotification({
        severity: item.severity === "critical" ? "critical" : "warn",
        icon: kind === "buyerMissed" ? "phone" : "alert",
        title: item.title,
        body: item.body,
        source: item.source,
        action: t("notificationsUI.capWatch.viewInsights"),
        actionHref: ROUTES.insights,
        durationMs: 12_000,
      });
    }
  }, [anomalies, timeZone, mark, t]);
}

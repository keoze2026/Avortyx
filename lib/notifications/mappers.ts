/**
 * Notification feed mappers.
 *
 * The "alert console" UI (topbar dropdown + /notifications page) renders a
 * shared `NotificationItem` shape. The real backend doesn't have a dedicated
 * alert-feed endpoint — instead we synthesize the feed from:
 *
 *   - `/api/ai/anomalies`       → critical / warn alerts (volume drops,
 *                                 cap-reached events, latency spikes, …)
 *   - `/api/ai/recommendations` → insight-tier nudges (retire numbers,
 *                                 scale buyer caps, rebalance traffic, …)
 *
 * Both flow through `useAiInsightsStore`. The mappers here keep the rendering
 * surfaces decoupled from the AI service shape so a backend rename / addition
 * doesn't ripple into the UI.
 */

import { formatRelativeTime } from "@/lib/format";
import type { AlertKind, NotificationItem } from "@/lib/mock/notifications";
import type { CapAlert } from "@/lib/store/cap-alerts-store";
import type { AiRecommendation, Anomaly } from "@/lib/types";

/**
 * Map an AI anomaly to a NotificationItem. The anomaly's `severity` becomes
 * the alert tier; `alertKind` is derived from the metric label so the topbar
 * sub-chips (missed / cap / AHT) keep working without backend support.
 */
export function anomalyToNotification(a: Anomaly): NotificationItem {
  const sev: NotificationItem["severity"] =
    a.severity === "critical"
      ? "critical"
      : a.severity === "warning"
        ? "warn"
        : "insight";
  const metric = (a.delta.metric ?? "").toLowerCase();
  const alertKind: AlertKind =
    metric.includes("miss") || metric.includes("no-answer")
      ? "missed"
      : metric.includes("cap")
        ? "cap-over"
        : metric.includes("aht") || metric.includes("duration")
          ? "low-aht"
          : "other";
  return {
    id: a.id,
    severity: sev,
    alertKind,
    title: a.title,
    body: a.body,
    time: formatRelativeTime(a.detectedAt),
    delta: a.delta.pct,
    read: false,
    source: a.scope.name,
  };
}

/**
 * Map an AI recommendation to a NotificationItem. Recommendations are always
 * insight-tier — they're nudges, not alerts. The impact value becomes the
 * row's action chip (e.g. "Scale up", "Pause", "Rebalance").
 */
export function recommendationToNotification(r: AiRecommendation): NotificationItem {
  return {
    id: r.id,
    severity: "insight",
    title: r.title,
    body: r.body,
    time: formatRelativeTime(r.createdAt),
    read: false,
    source: r.scope?.name ?? "AI Insights",
    action: r.impact?.value,
  };
}

/**
 * Map a cap-watch alert (destination / campaign at ≥ 90 % or ≥ 100 % of a
 * cap, from the live counters) to a NotificationItem. `t` resolves the same
 * title / body strings the banner used, so the bell entry reads identically.
 */
export function capAlertToNotification(
  a: CapAlert,
  t: (key: string) => string,
): NotificationItem {
  const root = `notificationsUI.capWatch.${a.metric}.${a.level}`;
  return {
    id: a.id,
    severity: a.level === "reached" ? "critical" : "warn",
    alertKind: "cap-over",
    title: t(`${root}.title`),
    body: t(`${root}.body`)
      .replace("{used}", String(a.used))
      .replace("{cap}", String(a.cap))
      .replace("{pct}", String(a.pct)),
    time: formatRelativeTime(a.at),
    read: false,
    destination: a.entityType === "destination" ? (a.tfn ? `${a.entityName} · ${a.tfn}` : a.entityName) : undefined,
    campaign: a.entityType === "campaign" ? a.entityName : undefined,
    buyer: a.entityType === "buyer" ? a.entityName : a.buyer,
    source: a.entityName,
  };
}

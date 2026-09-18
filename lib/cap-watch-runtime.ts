/**
 * Cap watch — turns the live counters into "cap almost reached" / "cap
 * reached" alerts.
 *
 * Every 15 s the app re-pulls destinations and campaigns with their
 * backend-computed counters (`dailyCalls`, `monthlyCalls`, `liveCalls`, …).
 * This hook watches those numbers against each entity's caps and, the
 * first time one crosses a threshold in the current period, pops a banner
 * and logs it to the bell menu. Thresholds:
 *
 *   near     ≥ 90 % of the cap  → warning banner ("about to hit")
 *   reached  ≥ 100 %            → critical banner ("cap reached")
 *
 * Each (entity, metric, level, period) fires once — see the cap-alerts
 * store — so the operator hears about it when it happens, not every tick.
 */

"use client";

import * as React from "react";

import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { zonedDayKey } from "@/lib/format";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useUIStore } from "@/lib/store/ui-store";
import { pushNotification } from "@/lib/store/push-notifications-store";
import { useCapAlertsStore, type CapAlert, type CapLevel, type CapMetric } from "@/lib/store/cap-alerts-store";

/** "About to hit" threshold. */
export const CAP_NEAR_PCT = 90;

interface Candidate {
  entityType: CapAlert["entityType"];
  entityId: string;
  entityName: string;
  tfn?: string;
  buyer?: string;
  metric: CapMetric;
  used: number;
  cap: number;
}

function levelFor(used: number, cap: number): CapLevel | null {
  if (cap <= 0) return null;
  const pct = (used / cap) * 100;
  if (pct >= 100) return "reached";
  if (pct >= CAP_NEAR_PCT) return "near";
  return null;
}

/** The period an alert belongs to — a day, a month, or (for concurrency,
 *  which resets as calls end) the current hour, so a sustained ceiling
 *  re-announces at most hourly. */
function periodKey(metric: CapMetric, timeZone: string): string {
  const day = zonedDayKey(Date.now(), timeZone);
  if (metric === "monthly") return day.slice(0, 7);
  if (metric === "concurrency") return `${day}T${new Date().getUTCHours()}`;
  return day;
}

export function useCapWatchRuntime() {
  const { t } = useTranslation();
  const destinations = useDestinationsStore((s) => s.destinations);
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const buyers = useBuyersStore((s) => s.buyers);
  const timeZone = useUIStore((s) => s.reportTimezone);
  const record = useCapAlertsStore((s) => s.record);

  React.useEffect(() => {
    const buyerName = new Map(buyers.map((b) => [b.id, b.name]));
    const candidates: Candidate[] = [];

    for (const d of destinations) {
      if (!d.enabled) continue;
      const base = {
        entityType: "destination" as const,
        entityId: d.id,
        entityName: d.name,
        tfn: d.tfn,
        buyer: buyerName.get(d.buyerId) ?? d.buyerName,
      };
      candidates.push({ ...base, metric: "daily", used: d.dailyCalls, cap: d.dailyCap });
      candidates.push({ ...base, metric: "monthly", used: d.monthlyCalls, cap: d.monthlyCap });
      candidates.push({ ...base, metric: "concurrency", used: d.liveCalls, cap: d.concurrencyCap });
    }
    for (const c of campaigns) {
      if (c.status !== "active") continue;
      const base = { entityType: "campaign" as const, entityId: c.id, entityName: c.name };
      candidates.push({ ...base, metric: "daily", used: c.callsToday, cap: c.dailyCap });
      candidates.push({ ...base, metric: "monthly", used: c.callsMonth, cap: c.monthlyCap });
    }

    for (const cand of candidates) {
      const level = levelFor(cand.used, cand.cap);
      if (!level) continue;
      const pct = Math.min(999, Math.round((cand.used / cand.cap) * 100));
      const alert: CapAlert = {
        id: `${cand.entityType}:${cand.entityId}:${cand.metric}:${level}:${periodKey(cand.metric, timeZone)}`,
        entityType: cand.entityType,
        entityId: cand.entityId,
        entityName: cand.entityName,
        tfn: cand.tfn,
        buyer: cand.buyer,
        metric: cand.metric,
        level,
        used: cand.used,
        cap: cand.cap,
        pct,
        at: Date.now(),
      };
      if (!record(alert)) continue;

      const root = `notificationsUI.capWatch.${cand.metric}.${level}`;
      pushNotification({
        severity: level === "reached" ? "critical" : "warn",
        icon: "alert",
        title: t(`${root}.title`),
        body: t(`${root}.body`)
          .replace("{used}", String(cand.used))
          .replace("{cap}", String(cand.cap))
          .replace("{pct}", String(pct)),
        source: cand.tfn ? `${cand.entityName} · ${cand.tfn}` : cand.entityName,
        action: t(
          cand.entityType === "destination"
            ? "notificationsUI.capWatch.viewDestinations"
            : "notificationsUI.capWatch.viewCampaigns",
        ),
        actionHref: cand.entityType === "destination" ? ROUTES.destinations : ROUTES.campaigns,
        // Cap alerts stay up until dismissed — they're actionable, not FYI.
        durationMs: level === "reached" ? 0 : 12_000,
      });
    }
  }, [destinations, campaigns, buyers, timeZone, record, t]);
}

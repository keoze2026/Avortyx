"use client";

import { useMemo } from "react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { matchesCallStatusFilter } from "@/lib/call-status";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { EntitySummary } from "@/lib/api/services/analytics.service";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { Call, Destination } from "@/lib/types";

interface Row {
  id: string;
  name: string;
  connected: number;
}

interface TopCampaignsBarsProps {
  /** The selected day's calls — already date-scoped by the page. */
  calls: Call[];
  /** Shown in the card subtitle so the ranking is never mistaken for "today". */
  dateLabel: string;
  /** Per-campaign totals (e.g. from the dashboard snapshot). When passed, the
   *  ranking uses their connected counts instead of counting `calls`. */
  campaignSummaries?: EntitySummary[];
  /** CH-404: a buyer login ranks its own destinations instead (it does not
   *  see our campaigns) - calls per TFN for the day, same card and design. */
  destinations?: Destination[];
}

/**
 * Top 6 campaigns by connected calls, for one selected day.
 *
 * This used to carry its own "today / 14d / 30d" toggle and threw away any
 * call before *today's* local midnight regardless of what the page passed
 * in — which is why every historical date ranked nothing. The page's date
 * picker is the only time control now; this card ranks exactly what it's
 * handed.
 */
export function TopCampaignsBars({ calls, dateLabel, campaignSummaries, destinations }: TopCampaignsBarsProps) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);

  const data = useMemo<Row[]>(() => {
    if (destinations) {
      return destinations
        .map((d) => ({ id: d.id, name: d.name || d.tfn, connected: d.dailyCalls || 0 }))
        .filter((r) => r.connected > 0)
        .sort((a, b) => b.connected - a.connected)
        .slice(0, 6);
    }
    const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
    if (campaignSummaries) {
      return campaignSummaries
        .map((s) => ({
          id: s.entityId,
          name: nameById.get(s.entityId) ?? s.entityName,
          connected: s.connectedCalls ?? 0,
        }))
        .filter((r) => r.connected > 0)
        .sort((a, b) => b.connected - a.connected)
        .slice(0, 6);
    }
    const m = new Map<string, Row>();
    for (const call of calls) {
      if (!matchesCallStatusFilter(call, "connected")) continue;
      if (!call.campaignId) continue;
      let row = m.get(call.campaignId);
      if (!row) {
        row = {
          id: call.campaignId,
          // Prefer the store's current name, but a campaign that's since been
          // archived (or hasn't loaded yet) still ranks under the name the
          // call record carries — dropping it made historical days lie.
          name: nameById.get(call.campaignId) ?? call.campaignName,
          connected: 0,
        };
        m.set(call.campaignId, row);
      }
      row.connected += 1;
    }
    return Array.from(m.values())
      .filter((r) => r.connected > 0)
      .sort((a, b) => b.connected - a.connected)
      .slice(0, 6);
  }, [calls, campaigns, campaignSummaries, destinations]);

  const isToday = dateLabel === t("sharedUI.dateRange.today");
  const subLabel = destinations
    ? isToday
      ? t("x404.topDestToday")
      : t("x404.topDestOn").replace("{date}", dateLabel)
    : isToday
      ? t("x398.topShareToday")
      : t("x398.topShareOn").replace("{date}", dateLabel);
  // CH-398 (Sir's design): each campaign's share of the top 6, and the bar
  // measured against the busiest one. No rank numbers (Sir: "just don't add
  // serial numbers").
  const top = data.length ? data[0].connected : 0;
  const sum = data.reduce((n, r) => n + r.connected, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">
            {destinations ? t("x404.topDest") : t("dashboard.topCampaigns")}
          </CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subLabel}</p>
        </div>
        <Link
          href={destinations ? ROUTES.destinations : ROUTES.campaigns}
          className="text-xs font-medium text-accent transition-opacity hover:opacity-80"
        >
          {t("common.viewAll")}
        </Link>
      </CardHeader>
      <CardContent>
        <div className="flex h-72 w-full flex-col justify-center">
          {data.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground">{t("trafficUI.common.noData")}</p>
          ) : (
            // One grid for every row, so names, bars, counts and shares line
            // up in columns whatever the name lengths.
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-x-4 gap-y-6">
              {data.map((r) => (
                <div key={r.id} className="contents" title={`${r.name}: ${formatNumber(r.connected)}`}>
                  <span className="max-w-[10rem] truncate text-sm font-semibold">{r.name}</span>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted/40">
                    <div
                      className="h-full rounded-full transition-[width] duration-500"
                      style={{
                        width: `${top ? Math.max(2, (r.connected / top) * 100) : 0}%`,
                        // CH-401: #3A72E8 -> #7FAEFF on the default blue.
                        background: "linear-gradient(90deg, var(--bar-from), var(--bar-to))",
                      }}
                    />
                  </div>
                  <span className="text-right text-sm font-semibold tabular-nums">{formatNumber(r.connected)}</span>
                  <span className="w-12 text-right text-xs tabular-nums text-muted-foreground">
                    {sum ? `${((r.connected / sum) * 100).toFixed(1)}%` : "—"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

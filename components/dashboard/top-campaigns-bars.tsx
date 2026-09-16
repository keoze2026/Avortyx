"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { matchesCallStatusFilter } from "@/lib/call-status";
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { Call } from "@/lib/types";

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
export function TopCampaignsBars({ calls, dateLabel }: TopCampaignsBarsProps) {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);

  const data = useMemo<Row[]>(() => {
    const nameById = new Map(campaigns.map((c) => [c.id, c.name]));
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
  }, [calls, campaigns]);

  const subLabel = t("dashboard.topCampaignsHintOn").replace("{date}", dateLabel);

  // Recharts BarChart with layout="vertical" renders horizontal bars (y = category, x = value).
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 gap-3 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{t("dashboard.topCampaigns")}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {subLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={ROUTES.campaigns}
            className="inline-flex items-center gap-0.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("common.viewAll")} <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 72, left: 4, bottom: 4 }}
              barCategoryGap={12}
            >
              <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="name"
                axisLine={false}
                tickLine={false}
                width={160}
                interval={0}
                // Custom tick: render the label at the LEFT edge of the YAxis
                // area, with text-anchor:start. That way every campaign name
                // starts in the same column instead of right-justifying to the
                // bar (which makes them wander as names vary in length).
                tick={(props: {
                  x: number;
                  y: number;
                  payload: { value: string };
                }) => {
                  const { x, y, payload } = props;
                  const v = payload.value;
                  const label = v.length > 22 ? `${v.slice(0, 20)}…` : v;
                  return (
                    <text
                      x={x - 156}
                      y={y}
                      dy={4}
                      fontSize={11}
                      fill="var(--foreground)"
                      textAnchor="start"
                    >
                      {label}
                    </text>
                  );
                }}
              />
              <Tooltip
                {...CHART_TOOLTIP_PROPS}
                cursor={false}
                formatter={(v: number) => [formatNumber(v), t("dashboard.tooltips.connected")]}
              />
              <Bar
                dataKey="connected"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={500}
              >
                {/* Top bar gets the brand accent at full strength, others fade
                    slightly so the ranking reads at a glance — single hue only. */}
                {data.map((d, i) => (
                  <Cell
                    key={d.id}
                    fill="var(--accent)"
                    fillOpacity={1 - i * 0.10}
                  />
                ))}
                <LabelList
                  dataKey="connected"
                  position="right"
                  formatter={(value: number) => formatNumber(value)}
                  fill="var(--muted-foreground)"
                  fontSize={11}
                  className="tabular-nums"
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

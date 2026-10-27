"use client";

import { useMemo, useState } from "react";
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
import { CHART_TOOLTIP_PROPS } from "@/lib/chart-tooltip";
import { formatNumber } from "@/lib/format";
import { useCallsStore } from "@/lib/store/calls-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Buyer, Call } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ─── Funnel categories ────────────────────────────────────────────── */

type FunnelKey = "incoming" | "connected" | "notConnected" | "converted" | "paid";

/* ─── Range selector ───────────────────────────────────────────────── */

type RangeId = "today" | "14d" | "30d";

const DAY_MS = 24 * 60 * 60 * 1000;

/* ─── Categorization rules ─────────────────────────────────────────── */

function isConnected(s: Call["status"]) {
  return s === "completed" || s === "in-progress";
}
function isNotConnected(s: Call["status"]) {
  return s === "missed" || s === "rejected" || s === "failed" || s === "ringing";
}

interface BuyerFunnelChartProps {
  buyer: Buyer;
}

export function BuyerFunnelChart({ buyer }: BuyerFunnelChartProps) {
  const { t } = useTranslation();
  const [range, setRange] = useState<RangeId>("30d");
  const recentCalls = useCallsStore((s) => s.recent);

  const CATEGORIES: Array<{ key: FunnelKey; label: string }> = [
    { key: "incoming", label: t("networkUI.buyers.funnel.incoming") },
    { key: "connected", label: t("networkUI.buyers.funnel.connected") },
    { key: "notConnected", label: t("networkUI.buyers.funnel.notConnected") },
    { key: "converted", label: t("networkUI.buyers.funnel.converted") },
    { key: "paid", label: t("networkUI.buyers.funnel.paid") },
  ];

  const RANGES: Array<{ id: RangeId; label: string; days: number }> = [
    { id: "today", label: t("networkUI.buyers.funnel.today"), days: 1 },
    { id: "14d", label: t("networkUI.buyers.funnel.last14"), days: 14 },
    { id: "30d", label: t("networkUI.buyers.funnel.monthly"), days: 30 },
  ];

  // Pre-compute the TFN set owned by this buyer (cheap; recomputes when the
  // destinations cache changes).
  const destinations = useDestinationsStore((s) => s.destinations);
  const buyerTfns = useMemo(() => {
    const s = new Set<string>();
    for (const d of destinations) {
      if (d.buyerId === buyer.id) s.add(d.tfn);
    }
    return s;
  }, [destinations, buyer.id]);

  const data = useMemo(() => {
    // Time-window cutoff.
    let cutoffMs: number;
    if (range === "today") {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      cutoffMs = d.getTime();
    } else {
      const days = RANGES.find((r) => r.id === range)?.days ?? 30;
      cutoffMs = Date.now() - days * DAY_MS;
    }

    // Tally funnel counts off the buyer-scoped slice.
    let incoming = 0;
    let connected = 0;
    let notConnected = 0;
    let converted = 0;
    let paid = 0;
    for (const c of recentCalls) {
      if (c.startedAt < cutoffMs) continue;
      if (!buyerTfns.has(c.destinationNumber)) continue;
      incoming += 1;
      if (isConnected(c.status)) connected += 1;
      if (isNotConnected(c.status)) notConnected += 1;
      // Converted = completed (qualified outcome).
      if (c.status === "completed") converted += 1;
      // Paid = completed with a non-zero payout actually billed.
      if (c.status === "completed" && c.payout > 0) paid += 1;
    }

    const counts: Record<FunnelKey, number> = {
      incoming,
      connected,
      notConnected,
      converted,
      paid,
    };
    return CATEGORIES.map((c) => ({
      key: c.key,
      label: c.label,
      value: counts[c.key],
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, buyerTfns, recentCalls, t]);

  const subLabel =
    range === "today"
      ? t("networkUI.buyers.funnel.subToday")
      : range === "14d"
        ? t("networkUI.buyers.funnel.sub14")
        : t("networkUI.buyers.funnel.sub30");

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 pb-2">
        <div>
          <CardTitle className="text-sm font-semibold">{t("networkUI.buyers.funnel.title")}</CardTitle>
          <p className="mt-0.5 text-[11px] text-muted-foreground">{subLabel}</p>
        </div>
        <div
          role="tablist"
          aria-label={t("networkUI.buyers.funnel.range")}
          className="inline-flex rounded-md border border-border bg-muted/30 p-0.5"
        >
          {RANGES.map((r) => {
            const active = range === r.id;
            return (
              <button
                key={r.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setRange(r.id)}
                className={cn(
                  "rounded-[5px] px-2 py-1 text-[10px] font-medium uppercase tracking-wider transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {r.label}
              </button>
            );
          })}
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
                dataKey="label"
                axisLine={false}
                tickLine={false}
                width={160}
                interval={0}
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
                formatter={(v: number) => [formatNumber(v), t("networkUI.buyers.funnel.callsTooltip")]}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                isAnimationActive
                animationDuration={500}
              >
                {/* Top of the funnel gets the brand accent at full strength,
                    deeper stages fade slightly so the funnel shape reads at
                    a glance — single hue only. */}
                {data.map((d, i) => (
                  <Cell
                    key={d.key}
                    fill="var(--accent)"
                    fillOpacity={1 - i * 0.12}
                  />
                ))}
                <LabelList
                  dataKey="value"
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

"use client";

/**
 * Expenses tracker — date-ranged breakdown of metered billing.
 *
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  Expenses           [date range]  [refresh]              │
 *   ├──────────────────────────┬───────────────────────────────┤
 *   │  Total $87.675           │      ╭─────╮                  │
 *   │  ── breakdown list ──    │     ╱ TOTAL ╲                 │
 *   │  Voice Minutes $78.96    │    │ $87.67 │                 │
 *   │  Rejected Call $3.075    │     ╲       ╱                 │
 *   │  …                       │      ╰─────╯                  │
 *   │                          │  ● Rent ● Minutes ● Shield… │
 *   └──────────────────────────┴───────────────────────────────┘
 *
 * Data is mocked but reflects per-day usage that scales with the selected
 * range. Categories match the screenshot legend.
 */

import * as React from "react";
import { RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { useTranslation } from "@/hooks/use-translation";
import { billingService, type ExpensesReport } from "@/lib/api/services/billing.service";
import { calendarDayKey } from "@/lib/format";

interface CategoryDef {
  key: string;
  /** Dotted translation key resolved at render time. */
  labelKey: string;
  /** English fallback used when t() can't resolve. */
  label: string;
  color: string;
  /** Per-day average dollar amount, used to derive the range total. */
  perDay: number;
}

const CATEGORIES: CategoryDef[] = [
  { key: "rent",     labelKey: "billing.categories.rentNumbers",    label: "Rent Numbers",    color: "#10B981", perDay: 0 },
  { key: "voice",    labelKey: "billing.categories.voiceMinutes",   label: "Voice Minutes",   color: "#8B5CF6", perDay: 78.96 },
  { key: "voip",     labelKey: "billing.categories.voipShield",     label: "VoIP Shield",     color: "#F97316", perDay: 0 },
  { key: "rejected", labelKey: "billing.categories.rejectedCall",   label: "Rejected Call",   color: "#FACC15", perDay: 3.075 },
  { key: "identity", labelKey: "billing.categories.callerIdentity", label: "Caller Identity", color: "#22D3EE", perDay: 0 },
  { key: "rec",      labelKey: "billing.categories.callRecording",  label: "Call Recording",  color: "#EC4899", perDay: 5.64 },
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function daysInRange(range: DateRange | undefined): number {
  if (!range?.from) return 1;
  const from = startOfDay(range.from).getTime();
  const to = startOfDay(range.to ?? range.from).getTime();
  return Math.max(1, Math.round((to - from) / 86_400_000) + 1);
}

interface CategoryRow extends CategoryDef {
  amount: number;
}

function buildRows(range: DateRange | undefined): CategoryRow[] {
  const days = daysInRange(range);
  return CATEGORIES.map((c) => ({ ...c, amount: Number((c.perDay * days).toFixed(4)) }));
}

export function ExpensesCard() {
  const { t } = useTranslation();
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [remote, setRemote] = React.useState<ExpensesReport | null>(null);

  // Fetch from /api/billing/expenses whenever the range changes or the
  // refresh button is clicked. Falls back to the local per-day estimate when
  // the endpoint isn't available (older backends or empty orgs).
  React.useEffect(() => {
    let cancelled = false;
    // Calendar days go out as their own Y-M-D — `toISOString()` would shift
    // them to the previous UTC day for any browser east of Greenwich.
    const fromIso = range?.from ? calendarDayKey(range.from) : undefined;
    const toIso = range?.to ? calendarDayKey(range.to) : fromIso;
    void (async () => {
      try {
        const res = await billingService.expenses({ dateFrom: fromIso, dateTo: toIso });
        if (!cancelled) setRemote(res);
      } catch {
        if (!cancelled) setRemote(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [range, refreshNonce]);

  // Merge: backend categories take precedence; per-category color/label
  // metadata comes from the local CATEGORIES list. Categories the backend
  // doesn't return are shown as $0 so the legend stays visually stable.
  const rows = React.useMemo(() => {
    const remoteByKey = new Map<string, number>();
    if (remote) {
      for (const c of remote.categories) {
        remoteByKey.set(c.key.toLowerCase(), c.amount);
        if (c.label) remoteByKey.set(c.label.toLowerCase(), c.amount);
      }
    }
    return CATEGORIES.map((c) => {
      const fallback = c.perDay * daysInRange(range);
      const amount = remote
        ? (remoteByKey.get(c.key) ?? remoteByKey.get(c.label.toLowerCase()) ?? 0)
        : Number(fallback.toFixed(4));
      return { ...c, amount, label: t(c.labelKey) };
    });
  }, [range, refreshNonce, remote, t]);

  const total = remote?.total ?? rows.reduce((s, r) => s + r.amount, 0);
  const pieData = rows.filter((r) => r.amount > 0);

  return (
    <Card className="p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold tracking-tight">{t("billing.expenses")}</h2>
        <div className="flex items-center gap-2">
          <DateRangePicker value={range} onChange={setRange} />
          <Button
            variant="outline"
            size="icon"
            aria-label="Refresh expenses"
            onClick={() => setRefreshNonce((n) => n + 1)}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Breakdown list */}
        <div className="rounded-lg border border-border p-5">
          <div className="border-b border-border pb-3">
            <div className="text-xs text-muted-foreground">{t("billing.total")}</div>
            <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">
              ${total.toFixed(3)}
            </div>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-xs text-muted-foreground">{r.label}</div>
                  <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">
                    ${r.amount.toFixed(4)}
                  </div>
                </div>
                <span
                  aria-hidden
                  className="h-6 w-1 shrink-0 rounded-sm"
                  style={{ background: r.color }}
                />
              </li>
            ))}
          </ul>
        </div>

        {/* Donut */}
        <div className="flex flex-col items-center justify-between rounded-lg border border-border p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
            {t("billing.totalExpenses")}
          </div>
          <div className="relative h-56 w-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={
                    pieData.length > 0
                      ? pieData
                      : [
                          {
                            key: "empty",
                            label: "No expenses",
                            amount: 1,
                            color: "var(--muted)",
                            perDay: 0,
                          } as CategoryRow,
                        ]
                  }
                  dataKey="amount"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius="68%"
                  outerRadius="96%"
                  paddingAngle={pieData.length > 1 ? 2 : 0}
                  stroke="var(--card)"
                  strokeWidth={3}
                  isAnimationActive
                  animationDuration={500}
                  activeShape={undefined}
                  activeIndex={-1}
                >
                  {(pieData.length > 0 ? pieData : [{ color: "var(--muted)" }]).map(
                    (slice, i) => (
                      <Cell
                        key={i}
                        fill={slice.color}
                        tabIndex={-1}
                        style={{ outline: "none" }}
                      />
                    ),
                  )}
                </Pie>
                {pieData.length > 0 && (
                  <Tooltip
                    cursor={false}
                    formatter={(value: number, name) => [
                      `$${Number(value).toFixed(4)}`,
                      name as string,
                    ]}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("billing.total")}
              </span>
              <span className="mt-0.5 font-mono text-xl font-semibold tabular-nums">
                ${total.toFixed(4)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <ul className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
            {CATEGORIES.map((c) => (
              <li key={c.key} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: c.color }}
                />
                <span className="text-muted-foreground">{t(c.labelKey)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}

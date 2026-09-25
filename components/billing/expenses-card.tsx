"use client";

/**
 * Expenses — what the account was charged, from GET /api/billing/expenses.
 *
 * The backend buckets transactions by type (deposit, charge, payout, refund,
 * adjustment). Deposits and refunds are money coming in, so only the debit
 * types are shown here, and the total is the sum of exactly those rows so the
 * breakdown and the total always agree.
 *
 * The monthly portal fee and its next due date come from
 * GET /api/billing/account and are shown above the breakdown.
 */

import * as React from "react";
import { CalendarClock, RefreshCw } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { useTranslation } from "@/hooks/use-translation";
import {
  billingService,
  type BillingAccount,
  type ExpensesReport,
} from "@/lib/api/services/billing.service";
import { calendarDayKey, formatCurrency } from "@/lib/format";

interface ExpenseTypeDef {
  key: string;
  labelKey: string;
  label: string;
  color: string;
}

const EXPENSE_TYPES: ExpenseTypeDef[] = [
  { key: "charge",     labelKey: "billing.transactionTypes.charge",     label: "Charges",     color: "#8B5CF6" },
  { key: "payout",     labelKey: "billing.transactionTypes.payout",     label: "Payouts",     color: "#10B981" },
  { key: "adjustment", labelKey: "billing.transactionTypes.adjustment", label: "Adjustments", color: "#F97316" },
];

interface ExpenseRow extends ExpenseTypeDef {
  amount: number;
  count?: number;
}

function formatDay(ms?: number): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function ExpensesCard() {
  const { t } = useTranslation();
  const tr = React.useCallback(
    (key: string, fallback: string) => {
      const v = t(key);
      return v === key ? fallback : v;
    },
    [t],
  );
  const [range, setRange] = React.useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [refreshNonce, setRefreshNonce] = React.useState(0);
  const [remote, setRemote] = React.useState<ExpensesReport | null>(null);
  const [account, setAccount] = React.useState<BillingAccount | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const acc = await billingService.account();
        if (!cancelled) setAccount(acc);
      } catch {
        if (!cancelled) setAccount(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce]);

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

  const rows = React.useMemo<ExpenseRow[]>(() => {
    const byKey = new Map<string, { amount: number; count?: number }>();
    for (const c of remote?.categories ?? []) {
      byKey.set(c.key.toLowerCase(), { amount: Math.abs(c.amount), count: c.count });
    }
    return EXPENSE_TYPES.map((d) => {
      const hit = byKey.get(d.key);
      return { ...d, label: tr(d.labelKey, d.label), amount: hit?.amount ?? 0, count: hit?.count };
    });
  }, [remote, tr]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const pieData = rows.filter((r) => r.amount > 0);

  const rates = account?.rates;
  const unavailable = "—";
  const nextDue = formatDay(rates?.portalFeeNextDue);
  const lastCharged = formatDay(rates?.portalFeeChargedAt);

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

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-accent/10 text-accent">
            <CalendarClock className="h-4 w-4" />
          </span>
          <div>
            <div className="text-xs text-muted-foreground">
              {tr("billing.portalFee.title", "Monthly portal fee")}
            </div>
            <div className="font-mono text-base font-semibold tabular-nums">
              {rates ? formatCurrency(rates.monthlyPortalFee) : unavailable}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                {tr("billing.portalFee.perMonth", "/ month")}
              </span>
            </div>
          </div>
        </div>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
          <div>
            <dt className="text-muted-foreground">{tr("billing.portalFee.nextDue", "Next due")}</dt>
            <dd className="font-mono tabular-nums">{nextDue ?? unavailable}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">{tr("billing.portalFee.lastCharged", "Last charged")}</dt>
            <dd className="font-mono tabular-nums">{lastCharged ?? unavailable}</dd>
          </div>
        </dl>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Breakdown list */}
        <div className="rounded-lg border border-border p-5">
          <div className="border-b border-border pb-3">
            <div className="text-xs text-muted-foreground">{t("billing.total")}</div>
            <div className="mt-0.5 font-mono text-2xl font-semibold tabular-nums">
              {formatCurrency(total)}
            </div>
          </div>
          <ul className="mt-2 divide-y divide-border">
            {rows.map((r) => (
              <li
                key={r.key}
                className="flex items-center justify-between gap-3 py-3"
              >
                <div>
                  <div className="text-xs text-muted-foreground">
                    {r.label}
                    {r.count !== undefined && r.count > 0 && (
                      <span className="ml-1 text-muted-foreground/70">· {r.count}</span>
                    )}
                  </div>
                  <div className="mt-0.5 font-mono text-base font-semibold tabular-nums">
                    {formatCurrency(r.amount)}
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
                            labelKey: "",
                            label: "No expenses",
                            amount: 1,
                            color: "var(--muted)",
                          } as ExpenseRow,
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
                      formatCurrency(Number(value)),
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
                {formatCurrency(total)}
              </span>
            </div>
          </div>

          {/* Legend */}
          <ul className="mt-4 grid grid-cols-3 gap-x-4 gap-y-1.5 text-xs">
            {rows.map((r) => (
              <li key={r.key} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ background: r.color }}
                />
                <span className="text-muted-foreground">{r.label}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
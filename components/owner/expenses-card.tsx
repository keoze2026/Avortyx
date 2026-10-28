"use client";

/**
 * Owner > Carrier Costs: the day's expenses, line by line (CH-336).
 *
 * Sir, 28 Oct, on the company profit card: "for daily create like this -
 * TFN cost, Xolo HR min, Freedom HR min and their cost, then expense of that
 * day". Same periods as the profit card (Today, Yesterday, This week, This
 * month, dates; opens on Today). Each TFN carrier's minutes x its rate, the
 * TFN fees and monthly charges by the day, routing minutes and fee, and the
 * total - which is the profit card's "Carrier costs" for the same days.
 * Backend: /api/owner/expenses (phone_numbers/owner_costs.py).
 */
import { useCallback, useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { toast } from "sonner";

import { PeriodPicker, rangeFor, type Preset } from "@/components/owner/period-picker";
import { routeNameLabel } from "@/components/owner/routing-cost-card";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { useLocalName } from "@/lib/i18n/local-name";

interface CarrierLine {
  name: string;
  code: string;
  calls: number;
  connected: number;
  minutes: string;
  perMinuteCost: string;
  billingIncrement: number;
  cost: string;
  numbers: number;
  tfnCost: string;
  monthlyCharge: string;
}

interface Expenses {
  start: string;
  end: string;
  feeShare: string;
  days: number;
  tfn: { numbers: number; cost: string };
  carriers: CarrierLine[];
  monthlyCharges: string;
  routing: {
    name: string;
    connected: number;
    minutes: string;
    perMinuteCost: string;
    billingIncrement: number;
    cost: string;
    fee: string;
  };
  noCarrier: { numbers: number; calls: number; minutes: string };
  total: string;
}

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function mins(v: string | number | null | undefined): string {
  return Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function rate(v: string | number | null | undefined): string {
  return `$${Number(v ?? 0).toFixed(4)}`;
}

export function ExpensesCard() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState(() => rangeFor("today"));
  const [data, setData] = useState<Expenses | null>(null);

  const load = useCallback(
    async (start: string, end: string) => {
      try {
        setData(await http.get<Expenses>(`/api/owner/expenses?start=${start}&end=${end}`));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("expenses.loadFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void load(range.start, range.end);
  }, [range, load]);

  const byDay = Number(data?.feeShare ?? 1) < 0.9999;

  // [label, value, detail]
  const lines: [string, string, string][] = data
    ? [
        [
          t("expenses.tfn"),
          money(data.tfn.cost),
          byDay ? t("expenses.tfnDetail").replace("{count}", String(data.tfn.numbers)) : `${data.tfn.numbers} TFNs`,
        ],
        ...data.carriers.map((c): [string, string, string] => [
          t("expenses.carrierMinutes").replace("{carrier}", localName(c.name)),
          money(c.cost),
          t("expenses.minutesDetail").replace("{minutes}", mins(c.minutes)).replace("{rate}", rate(c.perMinuteCost)),
        ]),
        [t("expenses.monthly"), money(data.monthlyCharges), byDay ? t("expenses.byTheDay") : ""],
        [
          t("expenses.routing").replace("{route}", routeNameLabel(data.routing.name, t, localName)),
          money(data.routing.cost),
          t("expenses.minutesDetail")
            .replace("{minutes}", mins(data.routing.minutes))
            .replace("{rate}", rate(data.routing.perMinuteCost)),
        ],
        [t("expenses.routingFee"), money(data.routing.fee), byDay ? t("expenses.byTheDay") : ""],
      ]
    : [];

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <span className="text-base font-semibold">{t("expenses.title")}</span>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <PeriodPicker
              preset={preset}
              range={range}
              onChange={(np, nr) => {
                setPreset(np);
                setRange(nr);
              }}
            />
          </div>
        </div>

        {/* Tiles grow to fill their row, so no empty grey cell is left. */}
        <div className="flex flex-wrap gap-px border-t border-border bg-border text-sm">
          {lines.map(([label, value, detail]) => (
            <div key={label} className="min-w-[10rem] flex-1 basis-40 bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="tabular-nums">{value}</div>
              {detail && <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">{detail}</div>}
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t border-border px-5 py-3">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {t("expenses.total")}
          </span>
          <span className="text-lg font-semibold tabular-nums text-destructive">
            -{money(data?.total)}
          </span>
        </div>

        {data && data.noCarrier.calls > 0 && (
          <div className="flex items-start gap-2 border-t border-border bg-warning/10 px-5 py-2 text-xs">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
            <span>
              {t("expenses.noCarrier")
                .replace("{numbers}", String(data.noCarrier.numbers))
                .replace("{calls}", String(data.noCarrier.calls))
                .replace("{minutes}", mins(data.noCarrier.minutes))}
            </span>
          </div>
        )}

        <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          {t("expenses.note")}
        </div>
      </CardContent>
    </Card>
  );
}

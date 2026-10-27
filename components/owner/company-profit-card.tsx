"use client";

/**
 * Owner > Carrier Costs: company profit before tax (CH-257), for any days
 * (CH-334).
 *
 * Sir, 28 Oct, on the month's profit card: "the way it's created for month -
 * make same in today's sheet too". So it has the routing cost's Today /
 * Yesterday / This week / This month / dates, and opens on Today like it.
 * What customer workspaces were charged in those days, minus the carriers'
 * bill for them: minutes as they happened, monthly fees by the day (1/31 of a
 * $350 month on a day of October). Backend: /api/owner/company-profit.
 */
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PeriodPicker, rangeFor, type Preset } from "@/components/owner/period-picker";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { cn } from "@/lib/utils";

interface Profit {
  calls: string;
  rejected: string;
  voip: string;
  portal: string;
  tfn: string;
  other: string;
  refunds: string;
  income: string;
  customers: number;
  carrierCosts: string;
  profit: string;
}

interface ProfitResponse {
  start: string;
  end: string;
  /** The part of the monthly fees in these days: 1 for a whole month. */
  feeShare: string;
  profit: Profit;
}

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  const s = Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `-$${s}` : `$${s}`;
}

export function CompanyProfitCard() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState(() => rangeFor("today"));
  const [data, setData] = useState<ProfitResponse | null>(null);

  const load = useCallback(
    async (start: string, end: string) => {
      try {
        setData(await http.get<ProfitResponse>(`/api/owner/company-profit?start=${start}&end=${end}`));
      } catch (e) {
        toast.error(e instanceof ApiError ? e.message : t("owner.profit.loadFailed"));
      }
    },
    [t],
  );

  useEffect(() => {
    void load(range.start, range.end);
  }, [range, load]);

  const p = data?.profit;
  const wholeMonths = Number(data?.feeShare ?? 1) >= 0.9999;

  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-base font-semibold">{t("owner.profit.title")}</span>
            {p && (
              <span className="text-xs text-muted-foreground">
                {t("owner.profit.customers").replace("{count}", String(p.customers))}
              </span>
            )}
          </div>
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
        {/* Tiles grow to fill their row: no empty grey cell at the end (it showed
            beside Portal fees with 5 tiles in 6 columns). */}
        <div className="flex flex-wrap gap-px border-t border-border bg-border text-sm">
          {[
            [t("owner.profit.calls"), p?.calls],
            [t("owner.profit.voip"), p?.voip],
            [t("owner.profit.rejected"), p?.rejected],
            [t("owner.profit.tfn"), p?.tfn],
            [t("owner.profit.portal"), p?.portal],
            ...(Number(p?.other ?? 0) ? [[t("owner.profit.other"), p?.other]] : []),
            ...(Number(p?.refunds ?? 0) ? [[t("owner.profit.refunds"), p?.refunds]] : []),
          ].map(([label, value]) => (
            <div key={label} className="min-w-[9rem] flex-1 basis-36 bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className="tabular-nums">{money(value)}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-px border-t border-border bg-border text-sm sm:grid-cols-3">
          {[
            [t("owner.profit.income"), money(p?.income), ""],
            [t("owner.profit.carrierCosts"), money(-Number(p?.carrierCosts ?? 0)), ""],
            [
              t("owner.profit.profit"),
              money(p?.profit),
              Number(p?.profit ?? 0) < 0 ? "text-destructive" : "text-success",
            ],
          ].map(([label, value, tone], i) => (
            <div key={label} className="bg-card px-4 py-3">
              <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
              <div className={cn(i === 2 ? "text-lg font-semibold" : "font-medium", "tabular-nums", tone)}>{value}</div>
            </div>
          ))}
        </div>
        <div className="border-t border-border px-5 py-2 text-xs text-muted-foreground">
          {t(wholeMonths ? "owner.profit.notePeriod" : "owner.profit.noteDays")}
        </div>
      </CardContent>
    </Card>
  );
}

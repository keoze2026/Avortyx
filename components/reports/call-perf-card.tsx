"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface CallPerfCardProps {
  revenue: number;
  payout: number;
}

export function CallPerfCard({ revenue, payout }: CallPerfCardProps) {
  const { t } = useTranslation();
  const profit = revenue - payout;
  const profitNegative = profit < 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("toolsUI.reports.perfCard.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Hairline rules separate the three figures so they don't read as
            one run of numbers. `divide-x` borders every cell after the first. */}
        <div className="grid grid-cols-3 divide-x divide-border text-center">
          <Cell label={t("toolsUI.reports.perfCard.revenue")} value={formatCurrency(revenue, true)} />
          <Cell label={t("toolsUI.reports.perfCard.payout")} value={formatCurrency(payout, true)} />
          <Cell
            label={t("toolsUI.reports.perfCard.profit")}
            value={formatCurrency(profit, true)}
            valueClass={profitNegative ? "text-destructive" : "text-[color:var(--success)]"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function Cell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      {/* Sentence case: the card heading carries the uppercase treatment, so
          shouting here too would flatten the hierarchy between them. */}
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-base font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
    </div>
  );
}

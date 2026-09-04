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
      <CardContent>
        <div className="grid grid-cols-3 text-center">
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
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-base font-semibold tabular-nums", valueClass)}>
        {value}
      </div>
    </div>
  );
}

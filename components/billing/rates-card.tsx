"use client";

/**
 * Rates — what this client is actually billed at.
 *
 * Read straight from `GET /api/billing/account` (`per_minute_rate`,
 * `markup_percent`, `tfn_purchase_fee`, `monthly_portal_fee`, plus the
 * portal fee's charged / next-due dates).
 *
 * This card used to render a hardcoded per-country tariff table — eight
 * line items with invented amounts and a country selector that mapped to
 * nothing on the backend. None of it was this client's pricing.
 */

import * as React from "react";
import { AudioLines, CalendarClock, Percent, PhoneIncoming, Wallet } from "lucide-react";

import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { billingService, type BillingAccount } from "@/lib/api/services/billing.service";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Tile {
  key: string;
  icon: React.ElementType;
  label: string;
  value: string;
  /** Small line under the figure — units, or the fee's next due date. */
  hint?: string;
}

/** Per-minute and per-call money needs more than 2 decimals to be meaningful
 *  at these magnitudes ($0.0035 is not "$0.00"). */
function preciseMoney(n: number): string {
  return `$${n.toFixed(4)}`;
}

function formatDate(ms?: number): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function RatesCard() {
  const { t } = useTranslation();
  const [account, setAccount] = React.useState<BillingAccount | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    billingService
      .account()
      .then((a) => {
        if (!cancelled) setAccount(a);
      })
      .catch(() => {
        // Non-fatal — the card simply doesn't render without rates.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rates = account?.rates;
  // Nothing invented: a backend that doesn't send rates gets no card.
  if (!rates) return null;

  const tiles: Tile[] = [
    {
      key: "perMinute",
      icon: AudioLines,
      label: t("billing.rateRows.perMinute"),
      value: preciseMoney(rates.perMinute),
      hint: t("billing.rateRows.perMinuteUnit"),
    },
    {
      key: "markup",
      icon: Percent,
      label: t("billing.rateRows.markup"),
      value: `${rates.markupPercent}%`,
    },
    {
      key: "tfnFee",
      icon: PhoneIncoming,
      label: t("billing.rateRows.tfnFee"),
      value: formatCurrency(rates.tfnPurchaseFee, true),
      hint: t("billing.rateRows.tfnFeeUnit"),
    },
    {
      key: "portalFee",
      icon: Wallet,
      label: t("billing.rateRows.portalFee"),
      value: formatCurrency(rates.monthlyPortalFee, true),
      hint: t("billing.rateRows.portalFeeUnit"),
    },
  ];

  const charged = formatDate(rates.portalFeeChargedAt);
  const nextDue = formatDate(rates.portalFeeNextDue);

  return (
    <Card className="p-6">
      <h2 className="mb-5 text-xl font-semibold tracking-tight">{t("billing.rates")}</h2>

      <div className="overflow-hidden rounded-lg border border-border">
        <ul className="grid grid-cols-1 divide-y divide-border sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4">
          {tiles.map((tile, i) => (
            <RateTile key={tile.key} tile={tile} last={i === tiles.length - 1} />
          ))}
        </ul>
      </div>

      {(charged || nextDue) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          {charged && (
            <span>
              {t("billing.rateRows.lastCharged")}: <span className="text-foreground">{charged}</span>
            </span>
          )}
          {nextDue && (
            <span>
              {t("billing.rateRows.nextDue")}: <span className="text-foreground">{nextDue}</span>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

function RateTile({ tile, last }: { tile: Tile; last: boolean }) {
  const Icon = tile.icon;
  return (
    <li className={cn("flex items-start gap-3 p-4", !last && "sm:border-r sm:border-border")}>
      <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{tile.label}</div>
        <div className="mt-0.5 text-lg font-semibold tabular-nums">{tile.value}</div>
        {tile.hint && <div className="text-[11px] text-muted-foreground">{tile.hint}</div>}
      </div>
    </li>
  );
}

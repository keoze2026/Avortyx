"use client";

/**
 * Payment integrations card — sits next to the credit-card mockup on the
 * billing page. Surfaces the operator's connected payment providers (today:
 * Capitalist, with hooks for adding more later) and each provider's wallets,
 * balances, and quick actions (top-up, payout).
 *
 * Capitalist (capitalist.net) is the dominant multi-currency processor in
 * the pay-per-call space — USD / EUR / RUB wallets, instant publisher
 * payouts, and a webhook API for reconciliation. We model the integration
 * as a single account holding N wallets, with mock data wired through the
 * existing billing mock pipeline.
 */

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowDownToLine,
  CheckCircle2,
  Send,
  Wallet,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { MOCK_CAPITALIST_ACCOUNT } from "@/lib/mock/billing";
import type { CapitalistCurrency } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Symbol + locale formatter per currency — keeps the rendering tight and
 *  avoids re-instantiating Intl.NumberFormat on every render. */
const CURRENCY_FMT: Record<
  CapitalistCurrency,
  { symbol: string; format: (n: number) => string }
> = {
  USD: {
    symbol: "$",
    format: (n) =>
      n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  EUR: {
    symbol: "€",
    format: (n) =>
      n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
  },
  RUB: {
    symbol: "₽",
    format: (n) =>
      n.toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  },
};

/** Brand tint per currency — drives the wallet row's left accent bar. */
const CURRENCY_TONE: Record<CapitalistCurrency, string> = {
  USD: "bg-[color:var(--success)]",
  EUR: "bg-accent",
  RUB: "bg-[color:var(--warning)]",
};

export function PaymentIntegrationsCard() {
  const { t } = useTranslation();
  // The backend doesn't expose a Capitalist wallet-listing endpoint yet —
  // there's only the deposit endpoint. Until then, this card shows a
  // "connect to view wallets" state instead of pretending to show real
  // balances. Flip `account` back to MOCK_CAPITALIST_ACCOUNT (or a real
  // service call) once `/api/billing/wallets/` lands.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _unused = MOCK_CAPITALIST_ACCOUNT;
  const account: typeof MOCK_CAPITALIST_ACCOUNT | null = null as typeof MOCK_CAPITALIST_ACCOUNT | null;

  const scrollToRecharge = () => {
    const target = typeof document !== "undefined" ? document.getElementById("recharge-balance") : null;
    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.setTimeout(() => {
        const input = document.getElementById("recharge-amount") as HTMLInputElement | null;
        input?.focus();
      }, 350);
    }
  };

  const onTopUp = (currency: CapitalistCurrency) => {
    scrollToRecharge();
    toast.success(
      t("toolsUI.billing.integrations.toast.topUp").replace("{currency}", currency),
    );
  };

  const onPayout = (currency: CapitalistCurrency) =>
    toast.success(
      t("toolsUI.billing.integrations.toast.payout").replace("{currency}", currency),
    );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">
          {t("toolsUI.billing.integrations.title")}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ─── Provider header — Capitalist brand + connection status ─── */}
        {account ? (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className={cn(
              "relative overflow-hidden rounded-xl border border-accent/20 p-4",
              "bg-[radial-gradient(circle_at_top_left,color-mix(in_oklch,var(--accent)_18%,transparent),transparent_60%),linear-gradient(135deg,rgba(15,17,35,0.85)_0%,rgba(35,40,90,0.45)_100%)]",
              "text-foreground",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                  <Wallet className="h-5 w-5" />
                </span>
                <div className="leading-tight">
                  <div className="text-base font-semibold tracking-tight">
                    {t("toolsUI.billing.integrations.capitalist.name")}
                  </div>
                  <div className="font-mono text-[11px] text-muted-foreground">
                    {account.accountId} · {account.accountName}
                  </div>
                </div>
              </div>
              <ConnectionBadge connected={account.connected} />
            </div>

            {account.lastSyncAt && (
              <div className="mt-3 text-[10px] text-muted-foreground">
                {t("toolsUI.billing.integrations.lastSync")}{" "}
                <span className="text-foreground">
                  {formatRelativeTime(account.lastSyncAt, t)}
                </span>
              </div>
            )}
          </motion.div>
        ) : (
          /* No real wallet-listing endpoint yet — show an honest empty state
             instead of pretending wallets exist. Recharge still works via
             the form below; the operator just can't see balances per-currency. */
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/60 bg-secondary/20 px-4 py-8 text-center">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent/10 text-accent">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-sm font-semibold">No payment provider connected</h4>
              <p className="mt-1 max-w-md text-xs text-muted-foreground">
                Wallet listing isn&apos;t exposed by the backend yet. You can still
                fund your account using the Recharge form below — payments
                route to Capitalist USDT.
              </p>
            </div>
          </div>
        )}

        {/* ─── Wallets — one row per currency ──────────────────────── */}
        {account && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {t("toolsUI.billing.integrations.walletsLabel")}
            </div>
            <div className="text-[10px] text-muted-foreground">
              {t("toolsUI.billing.integrations.walletsCount").replace(
                "{count}",
                String(account.wallets.length),
              )}
            </div>
          </div>

          <ul className="space-y-2">
            {account.wallets.map((w, i) => {
              const fmt = CURRENCY_FMT[w.currency];
              return (
                <motion.li
                  key={w.currency}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    delay: 0.08 * i,
                    duration: 0.45,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="group relative flex items-center justify-between gap-2 overflow-hidden rounded-lg border border-border/60 bg-background/40 p-3 transition-colors hover:border-accent/30"
                >
                  {/* Left tone bar — currency identity */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-y-0 left-0 w-0.5 opacity-80",
                      CURRENCY_TONE[w.currency],
                    )}
                  />
                  <div className="flex items-center gap-3 pl-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border/40 bg-background font-mono text-[11px] font-semibold text-foreground">
                      {w.currency}
                    </span>
                    <div className="leading-tight">
                      <div className="font-mono text-[10px] text-muted-foreground">
                        {w.walletId}
                      </div>
                      <div className="text-base font-semibold tabular-nums tracking-tight">
                        {fmt.symbol}
                        {fmt.format(w.balance)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <WalletAction
                      icon={ArrowDownToLine}
                      label={t("toolsUI.billing.integrations.topUp")}
                      onClick={() => onTopUp(w.currency)}
                    />
                    <WalletAction
                      icon={Send}
                      label={t("toolsUI.billing.integrations.payout")}
                      onClick={() => onPayout(w.currency)}
                    />
                  </div>
                </motion.li>
              );
            })}
          </ul>
        </div>
        )}

      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function ConnectionBadge({ connected }: { connected: boolean }) {
  const { t } = useTranslation();
  if (connected) {
    return (
      <Badge
        variant="outline"
        className="gap-1.5 border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[10px] uppercase tracking-wider text-[color:var(--success)]"
      >
        <CheckCircle2 className="h-3 w-3" />
        {t("toolsUI.billing.integrations.connected")}
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="gap-1.5 border-destructive/40 bg-destructive/10 text-[10px] uppercase tracking-wider text-destructive"
    >
      <XCircle className="h-3 w-3" />
      {t("toolsUI.billing.integrations.disconnected")}
    </Badge>
  );
}

function WalletAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}

/** Relative-time formatter used by the "Last sync" line. Pulls strings from
 *  the existing common.relativeTime namespace so it reads correctly in every
 *  locale without us defining new keys here. */
function formatRelativeTime(ts: number, t: (k: string) => string): string {
  const diff = Math.max(0, Date.now() - ts);
  const minutes = Math.round(diff / 60_000);
  if (minutes < 1) return t("common.relativeTime.justNow");
  if (minutes < 60)
    return t("common.relativeTime.minutesAgo").replace("{n}", String(minutes));
  const hours = Math.round(minutes / 60);
  if (hours < 24)
    return t("common.relativeTime.hoursAgo").replace("{n}", String(hours));
  const days = Math.round(hours / 24);
  return t("common.relativeTime.daysAgo").replace("{n}", String(days));
}

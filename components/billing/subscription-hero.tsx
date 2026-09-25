"use client";

/**
 * The headline billing card: what this account is actually charged, read
 * straight from /api/billing/account (`monthly_portal_fee`,
 * `per_minute_rate`, `markup_percent`, `tfn_purchase_fee` and the portal
 * fee's charged / next-due dates), plus the account balance.
 *
 * There is no plan on the backend, so no plan tier, included calls or
 * overage is shown. Any figure the account doesn't return reads "—".
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Receipt, Wallet } from "lucide-react";

import { billingService, type BillingAccount } from "@/lib/api/services/billing.service";
import { useCallsStore } from "@/lib/store/calls-store";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

function formatDay(ms?: number): string | undefined {
  if (!ms) return undefined;
  return new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export function SubscriptionHero() {
  const { t } = useTranslation();
  const tr = (key: string, fallback: string) => {
    const v = t(key);
    return v === key ? fallback : v;
  };

  const [account, setAccount] = useState<BillingAccount | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const acc = await billingService.account();
        if (!cancelled) setAccount(acc);
      } catch {
        // Account unavailable — every figure below renders "—".
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useCallsStore((s) => s.kpis);

  // Account balance. The dashboard KPI payload the topbar polls every 15s
  // carries it (`balance` / `currency`), so that's the live figure; the
  // billing account fetched above is the fallback and the source for the
  // credit limit and account status.
  const onboardingBalance = useOnboardingStore((s) => s.balance);
  const balance = kpis?.balance ?? account?.balance ?? onboardingBalance;
  const currency = kpis?.currency ?? account?.currency ?? "USD";
  const creditLimit = account?.creditLimit;
  const accountStatus = account?.status;

  const rates = account?.rates;
  const unavailable = t("toolsUI.billing.subscription.balance.unavailable");
  const nextDue = formatDay(rates?.portalFeeNextDue);
  const lastCharged = formatDay(rates?.portalFeeChargedAt);

  const charges: Array<{ key: string; label: string; value: string; hint?: string }> = [
    {
      key: "minute",
      label: tr("toolsUI.billing.subscription.charges.perMinute", "Per connected minute"),
      value: rates ? `$${rates.perMinute.toFixed(2)}` : unavailable,
      hint:
        rates && rates.markupPercent > 0
          ? tr("toolsUI.billing.subscription.charges.markup", "+{percent}% markup").replace(
              "{percent}",
              String(rates.markupPercent),
            )
          : undefined,
    },
    {
      key: "number",
      label: tr("toolsUI.billing.subscription.charges.perNumber", "Per tracking number"),
      value: rates ? formatCurrency(rates.tfnPurchaseFee) : unavailable,
    },
    {
      key: "lastCharged",
      label: tr("toolsUI.billing.subscription.charges.lastCharged", "Portal fee last charged"),
      value: lastCharged ?? unavailable,
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="relative overflow-hidden rounded-2xl border border-accent/30 p-6 sm:p-8"
      style={{
        background:
          "radial-gradient(ellipse 80% 100% at 80% 0%, color-mix(in oklab, var(--accent) 30%, transparent), transparent 60%), linear-gradient(135deg, var(--card) 0%, color-mix(in oklab, var(--accent) 8%, var(--card)) 100%)",
      }}
    >
      {/* Subtle dotted grid backdrop */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40 bg-dot-grid"
        style={{
          maskImage: "radial-gradient(ellipse 60% 70% at 30% 0%, #000 30%, transparent 70%)",
        }}
      />

      <div className="relative flex flex-col gap-8 lg:flex-row lg:items-stretch">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accent">
              <Receipt className="h-2.5 w-2.5" />
              {tr("toolsUI.billing.subscription.charges.title", "Your charges")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {tr("toolsUI.billing.subscription.charges.nextDue", "Next fee due {date}").replace(
                "{date}",
                nextDue ?? unavailable,
              )}
            </span>
          </div>

          <div className="mt-3 text-[13px] text-muted-foreground">
            {tr("toolsUI.billing.subscription.charges.portalFee", "Monthly portal fee")}
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-3xl font-semibold tracking-tight sm:text-4xl">
              {rates ? formatCurrency(rates.monthlyPortalFee) : unavailable}
            </span>
            <span className="text-[13px] text-muted-foreground">{t("toolsUI.billing.subscription.perMonth")}</span>
          </div>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            {tr(
              "toolsUI.billing.subscription.charges.cycleNote",
              "Taken automatically from your balance every 30 days.",
            )}
          </p>

          <dl className="mt-5 grid max-w-xl grid-cols-1 gap-3 sm:grid-cols-3">
            {charges.map((c) => (
              <div key={c.key} className="rounded-lg border border-border/60 bg-background/40 px-3 py-2.5 backdrop-blur-sm">
                <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{c.label}</dt>
                <dd className="mt-0.5 font-mono text-base font-semibold tabular-nums">{c.value}</dd>
                {c.hint && <dd className="text-[11px] text-muted-foreground">{c.hint}</dd>}
              </div>
            ))}
          </dl>
        </div>

        {/* Account balance — the same figure as the topbar wallet, with the
            credit limit and account status from the billing account beside it. */}
        <div className="flex flex-col justify-center gap-4 rounded-xl border border-border/60 bg-background/40 px-5 py-4 backdrop-blur-sm lg:w-64">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3 w-3" />
              {t("toolsUI.billing.subscription.balance.label")}
              {currency !== "USD" && <span className="ml-auto">{currency}</span>}
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {balance != null ? formatCurrency(balance) : unavailable}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("toolsUI.billing.subscription.balance.creditLimit")}
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {creditLimit != null ? formatCurrency(creditLimit) : unavailable}
              </dd>
            </div>
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("toolsUI.billing.subscription.balance.status")}
              </dt>
              <dd className="mt-0.5 capitalize">
                {accountStatus ? (
                  <span
                    className={
                      accountStatus.toLowerCase() === "active"
                        ? "text-[color:var(--success)]"
                        : "text-[color:var(--warning)]"
                    }
                  >
                    {accountStatus}
                  </span>
                ) : (
                  unavailable
                )}
              </dd>
            </div>
          </dl>
          <a
            href="#recharge-balance"
            className="inline-flex h-8 w-fit items-center rounded-md border border-accent/40 bg-accent/15 px-3 text-xs font-medium text-accent transition-colors hover:bg-accent/25"
          >
            {t("toolsUI.billing.subscription.balance.topUp")}
          </a>
        </div>
      </div>
    </motion.section>
  );
}
"use client";

/**
 * The headline plan card. Premium gradient surface with embedded usage ring
 * for "calls included", and "manage / upgrade / cancel" actions.
 *
 * Plan fields come from /api/billing/account; usage comes from
 * /api/analytics/dashboard. Falls back to the mock seeds when the backend
 * hasn't loaded yet so the first paint isn't blank.
 */

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Calendar, Sparkles, Wallet } from "lucide-react";

import { billingService, type BillingAccount } from "@/lib/api/services/billing.service";
import { useCallsStore } from "@/lib/store/calls-store";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { MOCK_PLAN, MOCK_USAGE } from "@/lib/mock/billing";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

export function SubscriptionHero() {
  const { t } = useTranslation();

  const [account, setAccount] = useState<BillingAccount | null>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const acc = await billingService.account();
        if (!cancelled) setAccount(acc);
      } catch {
        // Plan endpoint may not be enabled yet — fall back to the mock seed.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const kpis = useCallsStore((s) => s.kpis);
  const plan = account?.plan;

  // Account balance. The dashboard KPI payload the topbar polls every 15s
  // carries it (`balance` / `currency`), so that's the live figure; the
  // billing account fetched above is the fallback and the source for the
  // credit limit and account status.
  const onboardingBalance = useOnboardingStore((s) => s.balance);
  const balance = kpis?.balance ?? account?.balance ?? onboardingBalance;
  const currency = kpis?.currency ?? account?.currency ?? "USD";
  const creditLimit = account?.creditLimit;
  const accountStatus = account?.status;

  const tier = plan?.tier ?? MOCK_PLAN.tier;
  const monthlyCost = plan?.monthlyCost ?? MOCK_PLAN.monthlyCost;
  const callsIncluded = plan?.callsIncluded ?? MOCK_PLAN.callsIncluded;
  const overageRatePerCall = plan?.overageRatePerCall ?? MOCK_PLAN.overageRatePerCall;
  const callsMetric = MOCK_USAGE.find((m) => m.key === "calls")!;
  const callsUsed = kpis?.totalCalls ?? callsMetric.used;
  const renews = new Date(plan?.renewsAt ?? MOCK_PLAN.renewsAt);
  const pct = callsIncluded > 0 ? Math.min(1, callsUsed / callsIncluded) : 0;
  const overage = Math.max(0, callsUsed - callsIncluded) * overageRatePerCall;

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
        {/* Left: plan + price + renewal */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-accent/15 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-accent">
              <Sparkles className="h-2.5 w-2.5" />
              {t("toolsUI.billing.subscription.currentPlan")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {t("toolsUI.billing.subscription.renews").replace("{date}", renews.toLocaleDateString())}
            </span>
          </div>

          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {tier}
          </h2>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-xl font-semibold">{formatCurrency(monthlyCost)}</span>
            <span className="text-[13px] text-muted-foreground">{t("toolsUI.billing.subscription.perMonth")}</span>
          </div>

          <p className="mt-4 max-w-md text-sm text-muted-foreground">
            {t("toolsUI.billing.subscription.callsBefore").replace("{calls}", formatCompact(callsIncluded))}
            <span className="font-mono text-foreground">
              {formatCurrency(overageRatePerCall, true)}{t("toolsUI.billing.subscription.callsAfter")}
            </span>
            .{overage > 0 && (
              <>{t("toolsUI.billing.subscription.projectedOverage").replace("{amount}", formatCurrency(overage))}</>
            )}
          </p>

          {/* Plan-management buttons removed for v1 — there is no backend
              endpoint for plan changes (`/api/billing/plan` doesn't exist).
              Upgrade / downgrade / cancel will return when the subscription
              endpoints ship. Until then, the user can recharge their balance
              via the card below and contact support to change plan. */}
        </div>

        {/* Middle: account balance — the same figure as the topbar wallet,
            with the credit limit and account status from the billing
            account beside it. */}
        <div className="flex flex-col justify-center gap-4 rounded-xl border border-border/60 bg-background/40 px-5 py-4 backdrop-blur-sm lg:w-64">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              <Wallet className="h-3 w-3" />
              {t("toolsUI.billing.subscription.balance.label")}
              {currency !== "USD" && <span className="ml-auto">{currency}</span>}
            </div>
            <div className="mt-1 font-mono text-3xl font-semibold tabular-nums tracking-tight">
              {balance != null ? formatCurrency(balance) : t("toolsUI.billing.subscription.balance.unavailable")}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <dt className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
                {t("toolsUI.billing.subscription.balance.creditLimit")}
              </dt>
              <dd className="mt-0.5 font-mono tabular-nums">
                {creditLimit != null ? formatCurrency(creditLimit) : t("toolsUI.billing.subscription.balance.unavailable")}
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
                  t("toolsUI.billing.subscription.balance.unavailable")
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

        {/* Right: usage ring */}
        <div className="flex items-center justify-center lg:w-72">
          <UsageRing
            pct={pct}
            used={callsUsed}
            included={callsIncluded}
          />
        </div>
      </div>
    </motion.section>
  );
}

/**
 * SVG donut showing calls-included consumption. Uses CSS vars so it
 * matches the brand accent + theme automatically.
 */
function UsageRing({ pct, used, included }: { pct: number; used: number; included: number }) {
  const { t } = useTranslation();
  const size = 200;
  const radius = 80;
  const stroke = 14;
  const c = 2 * Math.PI * radius;
  const offset = c * (1 - pct);

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <defs>
          <linearGradient id="ring-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#5266E0" />
            <stop offset="100%" stopColor="#818CF8" />
          </linearGradient>
        </defs>
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--border)"
          strokeWidth={stroke}
          fill="none"
        />
        {/* Progress */}
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ring-grad)"
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-semibold tabular-nums">{Math.round(pct * 100)}%</span>
        <span className="mt-0.5 text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
          {t("toolsUI.billing.subscription.callsUsed")}
        </span>
        <span className="mt-1 font-mono text-[11px] text-foreground">
          {formatCompact(used)} / {formatCompact(included)}
        </span>
      </div>
    </div>
  );
}

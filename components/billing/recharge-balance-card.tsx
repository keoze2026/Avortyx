"use client";

/**
 * Recharge Balance card — two payment paths.
 *
 *   Bank card → Stripe Elements + PaymentIntent confirm (USD only)
 *   Capitalist → hosted-checkout redirect (USD / EUR / RUB wallets)
 *
 * Auto-recharge + low-balance alert toggles persist via PATCH /api/billing/account.
 */

import * as React from "react";
import { Bitcoin, CreditCard, Loader2, ShieldCheck, Wallet } from "lucide-react";
import { toast } from "sonner";

import { StripeCardForm } from "./stripe-card-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { billingService, type BillingAccount } from "@/lib/api/services/billing.service";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

type Method = "card" | "capitalist";
type Currency = "USD" | "EUR" | "RUB";

/** Shape we accept from the Capitalist deposit endpoint. The backend ships
 *  `payment_url` (→ `paymentUrl` after case conversion); older deployments
 *  may use other names, so we look at all of them. */
interface DepositResponse {
  url?: string;
  redirectUrl?: string;
  checkoutUrl?: string;
  paymentUrl?: string;
}

const PRESETS = [50, 100, 250, 500, 1000];

const CURRENCIES: Array<{ code: Currency; symbol: string; label: string }> = [
  { code: "USD", symbol: "$", label: "US Dollar" },
  { code: "EUR", symbol: "€", label: "Euro" },
  { code: "RUB", symbol: "₽", label: "Russian Ruble" },
];

export function RechargeBalanceCard() {
  const { t } = useTranslation();
  const [method, setMethod] = React.useState<Method>("card");
  const [currency, setCurrency] = React.useState<Currency>("USD");
  const [amount, setAmount] = React.useState<string>("");
  const [submitting, setSubmitting] = React.useState(false);

  const [account, setAccount] = React.useState<BillingAccount | null>(null);
  const [accountSaving, setAccountSaving] = React.useState(false);
  const refreshOnboarding = useOnboardingStore((s) => s.refresh);

  /* ─── Hydrate account state (auto-recharge + low-balance threshold) ─── */
  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const acc = await billingService.account();
        if (!cancelled) setAccount(acc);
      } catch {
        // Billing account may not exist yet for a brand-new org; skip silently.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const parsedAmount = Number(amount);
  const amountValid = Number.isFinite(parsedAmount) && parsedAmount > 0;

  const onRecharge = async () => {
    if (!amountValid || submitting) return;
    setSubmitting(true);
    try {
      const res = (await billingService.capitalistDeposit({
        amount: parsedAmount,
        currency,
      })) as DepositResponse;

      const redirect =
        res?.paymentUrl ?? res?.url ?? res?.redirectUrl ?? res?.checkoutUrl;
      if (redirect) {
        toast.success(t("toolsUI.billing.recharge.redirecting"));
        window.location.assign(redirect);
        return;
      }
      toast.success(t("toolsUI.billing.recharge.queued"));
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("toolsUI.billing.recharge.failed");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const patchAccount = async (patch: Partial<BillingAccount>) => {
    if (!account) return;
    setAccountSaving(true);
    const prev = account;
    // Optimistic update — UI reflects the toggle immediately.
    setAccount({ ...account, ...patch });
    try {
      const fresh = await billingService.updateAccount(patch);
      setAccount(fresh);
    } catch (e) {
      setAccount(prev);
      const msg = e instanceof Error ? e.message : t("toolsUI.billing.recharge.failed");
      toast.error(msg);
    } finally {
      setAccountSaving(false);
    }
  };

  return (
    <Card id="recharge-balance" className="scroll-mt-24">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t("toolsUI.billing.recharge.title")}</CardTitle>
        <p className="text-xs text-muted-foreground">
          {t("toolsUI.billing.recharge.description")}
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* ─── Payment method picker ──────────────────────────────────── */}
        <section className="space-y-2">
          <Label>{t("toolsUI.billing.recharge.method")}</Label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <MethodCard
              selected={method === "card"}
              onClick={() => setMethod("card")}
              icon={CreditCard}
              title={t("toolsUI.billing.recharge.bankCard")}
              subtitle="Visa · Mastercard · Amex"
            />
            <MethodCard
              selected={method === "capitalist"}
              onClick={() => setMethod("capitalist")}
              icon={Bitcoin}
              title={t("toolsUI.billing.recharge.capitalist")}
              subtitle="USDT · TRC-20"
            />
          </div>

          {/* Capitalist needs a currency picker; Stripe is USD-only today. */}
          {method === "capitalist" && (
            <div className="flex flex-row gap-2 pt-1">
              {CURRENCIES.map((c) => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => setCurrency(c.code)}
                  className={cn(
                    "flex-1 inline-flex items-center justify-center gap-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
                    currency === c.code
                      ? "border-accent/60 bg-accent/10 text-accent"
                      : "border-border bg-secondary/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
                  )}
                  title={t(`y.currency.${c.code}`)}
                >
                  <span className="text-base font-semibold">{c.symbol}</span>
                  <span className="font-mono">{c.code}</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {/* ─── Amount + Recharge CTA ──────────────────────────────────── */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label htmlFor="recharge-amount">
                {t("toolsUI.billing.recharge.amountLabel")}
              </Label>
              <p className="text-[11px] text-muted-foreground">
                {t("toolsUI.billing.recharge.amountHint")}
              </p>
            </div>
            <div className="relative w-40">
              <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
                {CURRENCIES.find((c) => c.code === currency)?.symbol ?? "$"}
              </span>
              <Input
                id="recharge-amount"
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-right font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setAmount(String(p))}
                className={cn(
                  "rounded-md border px-2.5 py-1 text-xs font-medium transition-colors",
                  Number(amount) === p
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border bg-secondary/40 text-muted-foreground hover:border-border/80 hover:text-foreground",
                )}
              >
                ${p}
              </button>
            ))}
          </div>

          {/* Method-specific submit area: Capitalist → hosted redirect; Card → Stripe Elements. */}
          {method === "capitalist" ? (
            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="h-3 w-3 text-[color:var(--success)]" />
                {t("toolsUI.billing.recharge.capitalistNote")}
              </div>
              <Button onClick={onRecharge} disabled={!amountValid || submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t("toolsUI.billing.recharge.processing")}
                  </>
                ) : (
                  <>
                    <Wallet className="h-3.5 w-3.5" />
                    {t("toolsUI.billing.recharge.cta")}
                  </>
                )}
              </Button>
            </div>
          ) : (
            <div className="pt-1">
              <StripeCardForm
                amount={amountValid ? parsedAmount : 0}
                disabled={!amountValid}
                onSuccess={() => {
                  setAmount("");
                  // Refresh the cached billing account so the UI shows the new balance.
                  void billingService.account().then(setAccount).catch(() => undefined);
                  // Re-check the onboarding gate — a successful recharge may have
                  // unlocked the app for a freshly-verified user.
                  void refreshOnboarding();
                }}
              />
            </div>
          )}
        </section>

        {/* ─── Auto-recharge + low-balance alert ──────────────────────── */}
        <section className="space-y-2 border-t border-border/60 pt-4">
          <ToggleRow
            title={t("toolsUI.billing.recharge.autoRecharge.title")}
            description={t("toolsUI.billing.recharge.autoRecharge.description")}
            checked={account?.autoRecharge ?? false}
            disabled={!account || accountSaving}
            onChange={(v) => patchAccount({ autoRecharge: v })}
          />
          <ToggleRow
            title={t("toolsUI.billing.recharge.lowBalanceAlert.title")}
            description={t("toolsUI.billing.recharge.lowBalanceAlert.description")}
            // Treat any positive threshold as "alert on".
            checked={!!account && account.lowBalanceThreshold > 0}
            disabled={!account || accountSaving}
            onChange={(v) =>
              patchAccount({
                lowBalanceThreshold: v
                  ? Math.max(account?.lowBalanceThreshold ?? 0, 50)
                  : 0,
              })
            }
          />
        </section>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function MethodCard({
  selected,
  onClick,
  icon: Icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-colors active:scale-[0.985]",
        selected
          ? "border-accent/60 bg-accent/10 ring-1 ring-accent/40"
          : "border-border bg-secondary/30 hover:border-border/80",
      )}
    >
      <span
        className={cn(
          "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
          selected ? "bg-accent/15 text-accent" : "bg-background text-muted-foreground",
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </button>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  disabled,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/30 p-3">
      <div className="min-w-0">
        <div className="text-sm font-medium">{title}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
    </div>
  );
}

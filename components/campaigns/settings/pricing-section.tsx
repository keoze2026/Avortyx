"use client";

import * as React from "react";
import { DollarSign, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignsService } from "@/lib/api/services/campaigns.service";
import { invalidateSnapshots } from "@/lib/dashboard-snapshot";
import { useCampaignsStore } from "@/lib/store/campaigns-store";

type LoadState = "loading" | "ready" | "error";

/** The backend keeps prices to 2 decimals, never negative. */
const MAX_PRICE = 99_999_999.99;
export function toPrice(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || n > MAX_PRICE) return null;
  return Math.round(n * 100) / 100;
}

/**
 * A campaign's two per-call prices.
 *
 *   Revenue per call  - what the BUYER pays you for a qualifying call.
 *   Payout per call   - what you pay the PUBLISHER for it.
 *
 * The Dashboard's Revenue and Profit are worked out from these two. The server
 * has always stored the revenue price, but nothing in the app could show or
 * change it, so it stayed 0 and Revenue read $0 beside a real Payout.
 */
export function PricingSection({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [load, setLoad] = React.useState<LoadState>("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [saved, setSaved] = React.useState({ revenue: 0, payout: 0 });
  const [revenue, setRevenue] = React.useState("0");
  const [payout, setPayout] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoad("loading");
    campaignsService
      .get(campaignId)
      .then((c) => {
        if (cancelled) return;
        const r = c.revenue ?? 0;
        const p = c.payout ?? 0;
        setSaved({ revenue: r, payout: p });
        setRevenue(String(r));
        setPayout(String(p));
        setLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, attempt]);

  const revenueNum = toPrice(revenue);
  const payoutNum = toPrice(payout);
  const valid = revenueNum !== null && payoutNum !== null;
  const dirty = valid && (revenueNum !== saved.revenue || payoutNum !== saved.payout);
  const profit = valid ? revenueNum - payoutNum : null;

  const onSave = async () => {
    if (!valid || revenueNum === null || payoutNum === null) {
      setError(t("pricing.invalidAmounts"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await useCampaignsStore.getState().update(campaignId, { revenue: revenueNum, payout: payoutNum });
      setSaved({ revenue: revenueNum, payout: payoutNum });
      setRevenue(String(revenueNum));
      setPayout(String(payoutNum));
      // The Dashboard adds these prices up; don't let it show a stale total.
      invalidateSnapshots();
      toast.success(t("pricing.saved"), { description: t("pricing.savedDesc") });
    } catch (e) {
      setError(friendlyErrorMessage(e, t("pricing.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("pricing.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("pricing.subtitle")}
        </p>
      </div>

      <Card className="space-y-4 p-5">
        {load === "loading" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("pricing.loading")}
          </div>
        )}

        {load === "error" && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t("pricing.loadFailed")}</span>
            <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {t("pricing.retry")}
            </Button>
          </div>
        )}

        {load === "ready" && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <PriceField
                invalidText={t("pricing.invalidAmount")}
                id="pricing-revenue"
                label={t("pricing.revenuePerCall")}
                hint={t("pricing.revenueHint")}
                value={revenue}
                onChange={setRevenue}
              />
              <PriceField
                invalidText={t("pricing.invalidAmount")}
                id="pricing-payout"
                label={t("pricing.payoutPerCall")}
                hint={t("pricing.payoutHint")}
                value={payout}
                onChange={setPayout}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs">
              <span className="text-muted-foreground">
                {t("pricing.profitPerCall")}{" "}
                <span
                  className={
                    profit === null
                      ? "font-semibold"
                      : profit < 0
                        ? "font-semibold text-destructive"
                        : "font-semibold text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]"
                  }
                >
                  {profit === null ? "—" : `${profit < 0 ? "-" : ""}$${Math.abs(profit).toFixed(2)}`}
                </span>
              </span>
              {revenueNum === 0 && (
                <span className="text-[color:var(--warning)]">
                  {t("pricing.revenueZero")}
                </span>
              )}
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("pricing.repriceNote")}
            </p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={!dirty || saving}>
                {saving ? t("pricing.saving") : t("pricing.save")}
              </Button>
              {dirty && !saving && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setRevenue(String(saved.revenue));
                    setPayout(String(saved.payout));
                    setError(null);
                  }}
                >
                  {t("pricing.discard")}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function PriceField({
  invalidText,
  id,
  label,
  hint,
  value,
  onChange,
}: {
  id: string;
  invalidText: string;
  label: string;
  hint: string;
  value: string;
  onChange: (next: string) => void;
}) {
  const bad = value.trim() !== "" && toPrice(value) === null;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <div className="relative">
        <DollarSign className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          min={0}
          step="0.01"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={bad}
          className="pl-8 font-mono"
        />
      </div>
      <p className={bad ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
        {bad ? invalidText : hint}
      </p>
    </div>
  );
}

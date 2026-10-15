"use client";

import * as React from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { campaignsService } from "@/lib/api/services/campaigns.service";
import { useCampaignsStore } from "@/lib/store/campaigns-store";

type LoadState = "loading" | "ready" | "error";

interface Caps {
  dailyCap: number;
  monthlyCap: number;
  maxConcurrency: number;
  /** Not edited here, but always sent back: the cap endpoint treats a
   *  missing cap as 0 (= unlimited), so leaving it out would clear it. */
  globalCap: number;
}

/** "" or a whole number >= 0; anything else is invalid (null). */
function toCap(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Number(text);
  if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) return null;
  return n;
}

/**
 * A campaign's call caps, on the campaign page itself (General tab, right
 * under Pricing) instead of hidden in Advanced Settings:
 *
 *   Daily cap     - calls the campaign takes per day
 *   Monthly cap   - calls per month
 *   Concurrency   - calls at the same time
 *
 * 0 = unlimited. These are the caps routing checks (`PATCH
 * /api/campaigns/{id}/cap`), the same ones the Campaigns list shows and edits
 * in the Live and Daily boxes.
 */
export function CallCapsSection({ campaignId }: { campaignId: string }) {
  const { t } = useTranslation();
  const [load, setLoad] = React.useState<LoadState>("loading");
  const [attempt, setAttempt] = React.useState(0);
  const [saved, setSaved] = React.useState<Caps>({ dailyCap: 0, monthlyCap: 0, maxConcurrency: 0, globalCap: 0 });
  const [daily, setDaily] = React.useState("0");
  const [monthly, setMonthly] = React.useState("0");
  const [concurrency, setConcurrency] = React.useState("0");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setLoad("loading");
    campaignsService
      .get(campaignId)
      .then((c) => {
        if (cancelled) return;
        const caps: Caps = {
          dailyCap: c.dailyCap ?? 0,
          monthlyCap: c.monthlyCap ?? 0,
          maxConcurrency: c.maxConcurrency ?? 0,
          globalCap: c.globalCap ?? 0,
        };
        setSaved(caps);
        setDaily(String(caps.dailyCap));
        setMonthly(String(caps.monthlyCap));
        setConcurrency(String(caps.maxConcurrency));
        setLoad("ready");
      })
      .catch(() => {
        if (!cancelled) setLoad("error");
      });
    return () => {
      cancelled = true;
    };
  }, [campaignId, attempt]);

  const dailyNum = toCap(daily);
  const monthlyNum = toCap(monthly);
  const concurrencyNum = toCap(concurrency);
  const valid = dailyNum !== null && monthlyNum !== null && concurrencyNum !== null;
  const dirty =
    valid &&
    (dailyNum !== saved.dailyCap || monthlyNum !== saved.monthlyCap || concurrencyNum !== saved.maxConcurrency);

  const reset = (caps: Caps) => {
    setDaily(String(caps.dailyCap));
    setMonthly(String(caps.monthlyCap));
    setConcurrency(String(caps.maxConcurrency));
  };

  const onSave = async () => {
    if (!valid || dailyNum === null || monthlyNum === null || concurrencyNum === null) {
      setError(t("callCaps.invalid"));
      return;
    }
    setSaving(true);
    setError(null);
    const next: Caps = { dailyCap: dailyNum, monthlyCap: monthlyNum, maxConcurrency: concurrencyNum, globalCap: saved.globalCap };
    try {
      await useCampaignsStore.getState().setCaps(campaignId, next);
      setSaved(next);
      reset(next);
      toast.success(t("callCaps.saved"));
    } catch (e) {
      setError(friendlyErrorMessage(e, t("callCaps.saveFailed")));
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("callCaps.title")}</h2>
        <p className="mt-0.5 text-xs text-muted-foreground">{t("callCaps.subtitle")}</p>
      </div>

      <Card className="space-y-4 p-5">
        {load === "loading" && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("callCaps.loading")}
          </div>
        )}

        {load === "error" && (
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-muted-foreground">{t("callCaps.loadFailed")}</span>
            <Button size="sm" variant="outline" onClick={() => setAttempt((n) => n + 1)}>
              {t("callCaps.retry")}
            </Button>
          </div>
        )}

        {load === "ready" && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <CapField id="caps-daily" label={t("callCaps.daily")} value={daily} onChange={setDaily} invalidText={t("callCaps.invalidOne")} />
              <CapField id="caps-monthly" label={t("callCaps.monthly")} value={monthly} onChange={setMonthly} invalidText={t("callCaps.invalidOne")} />
              <CapField
                id="caps-concurrency"
                label={t("callCaps.concurrency")}
                value={concurrency}
                onChange={setConcurrency}
                invalidText={t("callCaps.invalidOne")}
              />
            </div>

            <p className="text-[11px] leading-relaxed text-muted-foreground">{t("callCaps.hint")}</p>

            {error && <p className="text-xs text-destructive">{error}</p>}

            <div className="flex items-center gap-2">
              <Button onClick={onSave} disabled={!dirty || saving}>
                {saving ? t("callCaps.saving") : t("callCaps.save")}
              </Button>
              {dirty && !saving && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    reset(saved);
                    setError(null);
                  }}
                >
                  {t("callCaps.discard")}
                </Button>
              )}
            </div>
          </>
        )}
      </Card>
    </section>
  );
}

function CapField({
  id,
  label,
  value,
  onChange,
  invalidText,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  invalidText: string;
}) {
  const invalid = toCap(value) === null;
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id} className="text-xs">
        {label}
      </Label>
      <Input
        id={id}
        type="number"
        inputMode="numeric"
        min={0}
        step={1}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid}
        className="tabular-nums"
      />
      {invalid && <p className="text-[11px] text-destructive">{invalidText}</p>}
    </div>
  );
}

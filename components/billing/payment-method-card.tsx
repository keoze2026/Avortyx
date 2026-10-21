"use client";

/**
 * Payment Method card — lists saved Stripe cards for the organization,
 * with a button to add a new one via the Recharge flow.
 *
 * Cards are loaded from /api/billing/payment-methods and deleted via the
 * same endpoint family. Adding a card today flows through the Recharge
 * Balance card — once Stripe.js confirms the payment method, the backend
 * persists it on the customer record automatically. A dedicated "save card
 * without paying" flow would use a SetupIntent endpoint that doesn't exist
 * yet on the backend.
 */

import { useCallback, useEffect, useState } from "react";
import { CreditCard, Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { billingService, type PaymentMethod } from "@/lib/api/services/billing.service";
import { useTranslation } from "@/hooks/use-translation";

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "Amex",
  discover: "Discover",
  diners: "Diners",
  jcb: "JCB",
  unionpay: "UnionPay",
};

export function PaymentMethodCard() {
  const { t } = useTranslation();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const list = await billingService.paymentMethods();
      setMethods(list);
    } catch {
      // Endpoint may not be exposed yet — show the empty state.
      setMethods([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const scrollToRecharge = () => {
    const el = typeof document !== "undefined" ? document.getElementById("recharge-balance") : null;
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const removeCard = async (pm: PaymentMethod) => {
    const prev = methods;
    setMethods((m) => m.filter((x) => x.id !== pm.id));
    try {
      await billingService.deletePaymentMethod(pm.id);
      toast.success(t("y.pay.removed").replace("{brand}", BRAND_LABEL[pm.brand ?? ""] ?? t("y.pay.card")).replace("{last4}", pm.last4 ?? "—"));
    } catch (e) {
      setMethods(prev);
      toast.error(e instanceof Error ? e.message : t("y.pay.removeFailed"));
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-base">{t("toolsUI.billing.payment.title")}</CardTitle>
        <Button size="sm" variant="outline" onClick={scrollToRecharge}>
          <Plus className="h-3 w-3" /> {t("y.pay.addCard")}
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex items-center gap-2 py-6 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("y.pay.loading")}
          </div>
        ) : methods.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border/60 bg-secondary/20 px-4 py-10 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
              <CreditCard className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-sm font-semibold">{t("y.pay.noCard")}</h4>
              <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                {t("y.pay.noCardHint")}
              </p>
            </div>
            <Button size="sm" onClick={scrollToRecharge}>
              {t("y.pay.addACard")}
            </Button>
          </div>
        ) : (
          <ul className="space-y-2">
            {methods.map((pm) => {
              const brand = BRAND_LABEL[pm.brand ?? ""] ?? t("y.pay.card");
              return (
                <li
                  key={pm.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-accent/10 text-accent">
                      <CreditCard className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{brand}</span>
                        <span className="font-mono text-xs text-muted-foreground">
                          •••• {pm.last4 ?? "----"}
                        </span>
                        {pm.isDefault && (
                          <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                            {t("y.pay.default")}
                          </Badge>
                        )}
                      </div>
                      {pm.expiryMonth && pm.expiryYear && (
                        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          {t("y.pay.exp")} {pm.expiryMonth.toString().padStart(2, "0")}/
                          {(pm.expiryYear % 100).toString().padStart(2, "0")}
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeCard(pm)}
                    aria-label={t("y.pay.removeAria").replace("{brand}", brand).replace("{last4}", pm.last4 ?? "—")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        <p className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3 w-3 text-accent" />
          {t("toolsUI.billing.payment.securityNote")}
        </p>
      </CardContent>
    </Card>
  );
}

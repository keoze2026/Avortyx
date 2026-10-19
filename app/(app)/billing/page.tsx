"use client";

import { ExpensesCard } from "@/components/billing/expenses-card";
import { InvoicesTable } from "@/components/billing/invoices-table";
import { PaymentIntegrationsCard } from "@/components/billing/payment-integrations-card";
import { PaymentMethodCard } from "@/components/billing/payment-method-card";
import { RatesCard } from "@/components/billing/rates-card";
import { RechargeBalanceCard } from "@/components/billing/recharge-balance-card";
import { SubscriptionHero } from "@/components/billing/subscription-hero";
import { UsageGrid } from "@/components/billing/usage-grid";
import { PageHeader } from "@/components/shared/page-header";
import { useTranslation } from "@/hooks/use-translation";
import { Can, Locked } from "@/components/shared/can";

export default function BillingPage() {
  const { t } = useTranslation();
  return (
    <>
      <PageHeader
        title={t("page.billing.title")}
        description={t("page.billing.description")}
      />

      <SubscriptionHero />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <UsageGrid />
        </div>
        <div>
          <Locked area="billing" action="edit">
            <PaymentMethodCard />
          </Locked>
        </div>
      </div>

      {/* Payment integrations — Capitalist (today) + room for more
          providers later. Sits on its own row above Rates so the operator
          sees their payout wallets next to their plan / rates context. */}
      <Locked area="billing" action="edit">
        <PaymentIntegrationsCard />
      </Locked>

      {/* Recharge balance — pick payment method, enter amount, get redirected
          to provider checkout (Stripe for cards, Capitalist for USDT). */}
      <Can area="billing" action="edit">
        <RechargeBalanceCard />
      </Can>

      <RatesCard />
      <ExpensesCard />

      <InvoicesTable />
    </>
  );
}

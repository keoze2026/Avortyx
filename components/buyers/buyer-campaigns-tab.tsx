"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Megaphone, Plus } from "lucide-react";

import { CampaignStatusBadge } from "@/components/campaigns/campaign-status-badge";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";
import { VerticalLabel } from "@/components/campaigns/vertical-label";
import { ROUTES } from "@/lib/constants";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useCampaignsStore } from "@/lib/store/campaigns-store";

export function BuyerCampaignsTab({ campaignIds }: { campaignIds: string[] }) {
  const { t } = useTranslation();
  // Stable selector + useMemo filter — see campaign-buyers-tab for rationale.
  const allCampaigns = useCampaignsStore((s) => s.campaigns);
  const campaigns = useMemo(
    () => allCampaigns.filter((c) => campaignIds.includes(c.id)),
    [allCampaigns, campaignIds],
  );

  if (campaigns.length === 0) {
    return (
      <EmptyState
        icon={Megaphone}
        tone="emerald"
        title={t("networkUI.buyers.campaigns.emptyTitle")}
        description={t("networkUI.buyers.campaigns.emptyDesc")}
        actions={
          <Button size="sm">
            <Plus className="h-4 w-4" /> {t("networkUI.buyers.campaigns.attach")}
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
      {campaigns.map((c) => (
        <Card key={c.id} className="overflow-hidden transition-all hover:-translate-y-0.5 hover:border-accent/40">
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link
                  href={`${ROUTES.campaigns}/${c.id}`}
                  className="block truncate text-sm font-semibold transition-colors hover:text-accent"
                >
                  <LocalName name={c.name} />
                </Link>
                <p className="text-[11px] text-muted-foreground font-mono"><VerticalLabel vertical={c.vertical} /></p>
              </div>
              <CampaignStatusBadge status={c.status} />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("networkUI.buyers.campaigns.calls")}</dt>
                <dd className="font-mono">{formatCompact(c.callsToday)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("networkUI.buyers.campaigns.revenue")}</dt>
                <dd className="font-mono">{formatCurrency(c.revenueToday)}</dd>
              </div>
              <div>
                <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("networkUI.buyers.campaigns.payout")}</dt>
                <dd className="font-mono">{formatCurrency(c.payout, true)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

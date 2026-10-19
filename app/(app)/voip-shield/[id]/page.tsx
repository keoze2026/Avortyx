"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { BlockedCarriersCard } from "@/components/suppression/blocked-carriers-card";
import { ProtectedCampaignsCard } from "@/components/suppression/protected-campaigns-card";
import { PageHeader } from "@/components/shared/page-header";
import { ROUTES } from "@/lib/constants";
import { useVoipShieldStore } from "@/lib/store/voip-shield-store";
import { Locked } from "@/components/shared/can";

export default function VoipShieldDetailPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";

  const shield = useVoipShieldStore((s) => s.shields.find((x) => x.id === id));
  const addCampaign = useVoipShieldStore((s) => s.addCampaign);
  const removeCampaign = useVoipShieldStore((s) => s.removeCampaign);
  const addCarrier = useVoipShieldStore((s) => s.addCarrier);
  const removeCarrier = useVoipShieldStore((s) => s.removeCarrier);

  if (!shield) {
    return (
      <>
        <Link
          href={ROUTES.voipShield}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {t("toolsUI.suppression.voipShield.breadcrumb")}
        </Link>
        <PageHeader
          title={t("toolsUI.suppression.voipShield.notFoundTitle")}
          description={t("toolsUI.suppression.voipShield.notFoundDescription")}
        />
        <button
          type="button"
          onClick={() => router.push(ROUTES.voipShield)}
          className="text-xs text-accent hover:underline"
        >
          {t("toolsUI.suppression.voipShield.backToList")}
        </button>
      </>
    );
  }

  return (
    // Max-width wrapper — keeps the shield edit form readable without
    // stretching across the whole content area (matches Campaign edit).
    <div className="mx-auto w-full max-w-[928px] space-y-6">
      <Link
        href={ROUTES.voipShield}
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        {t("toolsUI.suppression.voipShield.breadcrumb")}
      </Link>

      <PageHeader
        title={shield.name}
        description={t("toolsUI.suppression.voipShield.detailDescription")}
      />

      <Locked area="voip-shield" action="edit">
      <ProtectedCampaignsCard
        selectedIds={shield.campaignIds}
        onAdd={(campaignId) => addCampaign(shield.id, campaignId)}
        onRemove={(campaignId) => removeCampaign(shield.id, campaignId)}
      />

      <BlockedCarriersCard
        carriers={shield.blockedCarriers}
        onBlock={(carrier) => addCarrier(shield.id, carrier)}
        onUnblock={(carrier) => removeCarrier(shield.id, carrier)}
      />
      </Locked>
    </div>
  );
}

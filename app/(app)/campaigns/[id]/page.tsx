"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Hash } from "lucide-react";

import { CampaignDetailHeader } from "@/components/campaigns/campaign-detail-header";
import { CampaignSettingsView } from "@/components/campaigns/settings/campaign-settings-view";
import { EmptyState } from "@/components/shared/empty-state";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { useCampaignSettingsStore } from "@/lib/store/campaign-settings-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { CampaignAdvancedSettings } from "@/lib/types";

export default function CampaignDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = useCampaignsStore((s) => s.getById(params.id));

  useBreadcrumbOverride(campaign?.name);

  // Seed the per-campaign advanced-settings store with whatever the
  // backend last persisted, so the 12 advanced cards reflect server truth
  // on every navigation (instead of just whatever was in localStorage).
  const seedSettings = useCampaignSettingsStore((s) => s.seed);
  //
  // Auto Record, Greetings Message and Whisper Message show what live calls
  // actually do: their on/off (and message) come from the campaign fields the
  // call handler reads, not only from the saved settings bundle.
  useEffect(() => {
    if (!campaign) return;
    const saved = (campaign.advancedSettings ?? {}) as unknown as Partial<CampaignAdvancedSettings>;
    const live: Partial<CampaignAdvancedSettings> = { ...saved };
    if (campaign.recordingEnabled !== undefined) {
      live.autoRecord = { ...saved.autoRecord, enabled: campaign.recordingEnabled };
    }
    if (campaign.greetingEnabled !== undefined) {
      live.greetingsMessage = {
        ...(saved.greetingsMessage as CampaignAdvancedSettings["greetingsMessage"]),
        enabled: campaign.greetingEnabled,
        message: campaign.greetingMessage || saved.greetingsMessage?.message || "",
      };
    }
    if (campaign.whisperEnabled !== undefined) {
      live.whisperMessage = {
        ...(saved.whisperMessage as CampaignAdvancedSettings["whisperMessage"]),
        enabled: campaign.whisperEnabled,
        message: campaign.whisperMessage || saved.whisperMessage?.message || "",
      };
    }
    seedSettings(campaign.id, live as CampaignAdvancedSettings);
  }, [
    campaign,
    seedSettings,
  ]);

  useEffect(() => {
    if (!campaign) {
      const t = setTimeout(() => router.replace("/campaigns"), 600);
      return () => clearTimeout(t);
    }
  }, [campaign, router]);

  if (!campaign) {
    return (
      <EmptyState
        icon={Hash}
        tone="amber"
        title={t("trafficUI.campaigns.notFound.title")}
        description={t("trafficUI.campaigns.notFound.description")}
      />
    );
  }

  return (
    // Max-width wrapper — keeps the campaign edit form readable without
    // stretching across the whole content area.
    <div className="mx-auto w-full max-w-[928px] space-y-6">
      <CampaignDetailHeader campaign={campaign} />
      <CampaignSettingsView campaign={campaign} />
    </div>
  );
}
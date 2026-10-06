"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Hash } from "lucide-react";

import { CampaignDetailHeader } from "@/components/campaigns/campaign-detail-header";
import { CampaignSettingsView } from "@/components/campaigns/settings/campaign-settings-view";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { campaignsService } from "@/lib/api/services/campaigns.service";
import { useCampaignSettingsStore } from "@/lib/store/campaign-settings-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import type { Campaign, CampaignAdvancedSettings } from "@/lib/types";

type LoadState = "loading" | "ready" | "error";

/**
 * Turn a FULL campaign (from GET /api/campaigns/{id}) into the settings
 * bundle the cards read. Auto Record, Greetings and Whisper take their
 * on/off and message from the columns the call handler actually uses.
 */
function toLiveSettings(campaign: Campaign): CampaignAdvancedSettings {
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
  return live as CampaignAdvancedSettings;
}

export default function CampaignDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params.id;
  const campaign = useCampaignsStore((s) => s.getById(id));

  useBreadcrumbOverride(campaign?.name);

  const seedSettings = useCampaignSettingsStore((s) => s.seed);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  // THE FIX. The campaigns LIST (refreshed every 15 s by the store hydrator)
  // does not contain advanced settings, so seeding from it reset every
  // switch to "off". Instead, load the one full campaign from the server,
  // ONCE per visit, and seed from that. The 15 s poll no longer touches the
  // switches. The cards stay hidden until this finishes, so nobody can flip
  // a switch against defaults and save them over the real settings.
  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    campaignsService
      .get(id)
      .then((full) => {
        if (cancelled) return;
        seedSettings(full.id, toLiveSettings(full));
        setLoadState("ready");
      })
      .catch(() => {
        if (!cancelled) setLoadState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [id, attempt, seedSettings]);

  useEffect(() => {
    if (!campaign) {
      const timer = setTimeout(() => router.replace("/campaigns"), 600);
      return () => clearTimeout(timer);
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

      {loadState === "ready" && <CampaignSettingsView campaign={campaign} />}

      {loadState === "loading" && (
        <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">
          Loading campaign settings…
        </div>
      )}

      {loadState === "error" && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-destructive/40 p-6 text-sm">
          <span className="text-muted-foreground">
            Couldn&apos;t load this campaign&apos;s settings, so they are locked to protect what is saved.
          </span>
          <Button size="sm" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        </div>
      )}
    </div>
  );
}
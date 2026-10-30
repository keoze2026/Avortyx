"use client";

/**
 * The expanded "Settings" tab on a campaign detail page.
 *
 * Top-level tabs: General · Real-Time Bidding · Enrichment URLs · Access.
 * The General sub-tab composes three sections:
 *   1. Tracking Numbers — the numbers wired to this campaign
 *   2. Forward Calls To — routing controls + destination priority table
 *   3. Advanced Settings — 12 collapsible feature cards
 */

import * as React from "react";
import { Globe, LockKeyhole, Settings as SettingsIcon, Zap } from "lucide-react";

import { AccessTab } from "./access-tab";
import { AdvancedSettingsList } from "./advanced-settings-cards";
import { CallCapsSection } from "./call-caps-section";
import { EnrichmentTab } from "./enrichment-tab";
import { ForwardCallsSection } from "./forward-calls-section";
import { PricingSection } from "./pricing-section";
import { RtbTab } from "./rtb-tab";
import { TrackingNumbersSection } from "./tracking-numbers-section";
import { AutoScheduleCard } from "@/components/shared/auto-schedule-card";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePermissions } from "@/lib/my-permissions";
import { Locked } from "@/components/shared/can";
import { useTranslation } from "@/hooks/use-translation";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabId = "general" | "rtb" | "enrichment" | "access";

const TAB_KEYS: Array<{ id: TabId; labelKey: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: "general", labelKey: "trafficUI.campaigns.settings.tabs.general", icon: SettingsIcon },
  { id: "rtb", labelKey: "trafficUI.campaigns.settings.tabs.rtb", icon: Zap },
  { id: "enrichment", labelKey: "trafficUI.campaigns.settings.tabs.enrichment", icon: Globe },
  { id: "access", labelKey: "trafficUI.campaigns.settings.tabs.access", icon: LockKeyhole },
];

export function CampaignSettingsView({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation();
  const { isPartner } = usePartnerPermissions();
  const { can } = usePermissions();
  const [tab, setTab] = React.useState<TabId>("general");

  // A publisher (or buyer) login sees its own tracking numbers on this
  // campaign and nothing else: no pricing, buyers, routing or settings.
  if (isPartner) {
    return (
      <div className="space-y-4">
        <p className="rounded-md border border-border bg-secondary/20 px-3 py-2 text-xs text-muted-foreground">
          {t("partnerCampaign.note")}
        </p>
        <TrackingNumbersSection campaignId={campaign.id} readOnly />
      </div>
    );
  }
  const TABS = TAB_KEYS.map((tk) => ({ ...tk, label: t(tk.labelKey) }));

  return (
    <div className="space-y-4">
      {/* Underline-style tab strip — matches the Call Summary tabs. */}
      <div className="no-scrollbar flex overflow-x-auto border-b border-border">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                // CH-408 (Sir's design): the open tab in white, underlined in blue.
                "relative inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline-none",
                active
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 -bottom-px h-0.5 bg-accent"
                />
              )}
            </button>
          );
        })}
      </div>

      {tab === "general" && (
        <div className="space-y-6">
          {/* Pricing — revenue and payout per call; what the Dashboard adds up */}
          <Locked area="campaigns" action="edit-campaign"><PricingSection campaignId={campaign.id} /></Locked>

          {/* Call caps — daily, monthly and concurrency, the caps routing checks */}
          <Locked area="campaigns" action="edit-advanced"><CallCapsSection campaignId={campaign.id} /></Locked>

          {/* Auto schedule — daily play/pause based on portal timezone */}
          <Locked area="campaigns" action="edit-advanced">
            <AutoScheduleCard
              target="campaign"
              id={campaign.id}
              entityLabel="campaign"
            />
          </Locked>

          {/* 1 — Tracking Numbers */}
          <TrackingNumbersSection campaignId={campaign.id} readOnly={!can("campaigns", "edit-numbers")} />

          {/* 2 — Forward Calls To */}
          <Locked area="campaigns" action="edit-forward"><ForwardCallsSection campaignId={campaign.id} /></Locked>

          {/* 3 — Advanced Settings (12 collapsible cards) */}
          <section className="space-y-3">
            <div>
              <h2 className="text-[13px] font-semibold uppercase tracking-wider">{t("trafficUI.campaigns.settings.advanced.title")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("trafficUI.campaigns.settings.advanced.description")}
              </p>
            </div>
            <Locked area="campaigns" action="edit-advanced"><AdvancedSettingsList campaignId={campaign.id} /></Locked>
          </section>
        </div>
      )}

      <Locked area="campaigns" action="edit-advanced">
        {tab === "rtb" && <RtbTab campaignId={campaign.id} />}
        {tab === "enrichment" && <EnrichmentTab campaignId={campaign.id} />}
        {tab === "access" && <AccessTab campaignId={campaign.id} />}
      </Locked>
    </div>
  );
}
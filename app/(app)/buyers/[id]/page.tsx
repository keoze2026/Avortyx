"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Building2, Gauge, LayoutDashboard, Megaphone, Settings as SettingsIcon, Target } from "lucide-react";

import { BuyerCampaignsTab } from "@/components/buyers/buyer-campaigns-tab";
import { BuyerCapsTab } from "@/components/buyers/buyer-caps-tab";
import { BuyerDestinationsTab } from "@/components/buyers/buyer-destinations-tab";
import { BuyerDetailHeader } from "@/components/buyers/buyer-detail-header";
import { BuyerOverviewTab } from "@/components/buyers/buyer-overview-tab";
import { BuyerSettingsTab } from "@/components/buyers/buyer-settings-tab";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { cn } from "@/lib/utils";

type TabId = "overview" | "campaigns" | "destinations" | "caps" | "settings";

function DetailLoading() {
  return (
    <div className="mx-auto w-full max-w-[928px] space-y-4">
      <Skeleton className="h-28 w-full" />
      <Skeleton className="h-[420px] w-full" />
    </div>
  );
}

export default function BuyerDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const buyer = useBuyersStore((s) => s.getById(params.id));
  const hydrated = useBuyersStore((s) => s.hydrated);
  const loading = useBuyersStore((s) => s.loading);
  const fetchBuyers = useBuyersStore((s) => s.fetch);
  const fetchStats = useBuyersStore((s) => s.fetchStats);
  const [tab, setTab] = useState<TabId>("overview");

  // The list payload doesn't carry usage counters; pull this buyer's from
  // its /stats endpoint on open and keep them fresh while the page is up,
  // on the same cadence the rest of the app refreshes live figures.
  useEffect(() => {
    void fetchStats(params.id);
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void fetchStats(params.id);
    }, 15_000);
    return () => window.clearInterval(id);
  }, [params.id, fetchStats]);

  const TABS: Array<{ id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }> = [
    { id: "overview", label: t("networkUI.buyers.tabs.overview"), icon: LayoutDashboard },
    { id: "campaigns", label: t("networkUI.buyers.tabs.campaigns"), icon: Megaphone },
    { id: "destinations", label: t("networkUI.buyers.tabs.destinations"), icon: Target },
    { id: "caps", label: t("networkUI.buyers.tabs.capsPacing"), icon: Gauge },
    { id: "settings", label: t("networkUI.buyers.tabs.settings"), icon: SettingsIcon },
  ];

  useBreadcrumbOverride(buyer?.name);

  const triedLoad = useRef(false);
  // After a hard refresh (Ctrl+Shift+R) the list isn't loaded yet, so the
  // record isn't found for a moment. The page used to give up after 600 ms
  // and jump back to the list. Now it loads the list and only leaves once it
  // has really loaded and the record truly doesn't exist.
  useEffect(() => {
    if (!hydrated) {
      // One load attempt per visit; a failed load must not retry in a loop.
      if (!loading && !triedLoad.current) {
        triedLoad.current = true;
        void fetchBuyers();
      }
      return;
    }
    if (!buyer) {
      const t = setTimeout(() => router.replace("/buyers"), 600);
      return () => clearTimeout(t);
    }
  }, [hydrated, loading, buyer, fetchBuyers, router]);

  if (!buyer && !hydrated && (loading || !triedLoad.current)) return <DetailLoading />;

  if (!buyer) {
    return (
      <EmptyState
        icon={Building2}
        tone="emerald"
        title={t("networkUI.buyers.empty.notFound")}
        description={t("networkUI.buyers.empty.notFoundDesc")}
      />
    );
  }

  return (
    // Max-width wrapper — matches the Campaign settings + Destination
    // settings pages (max-w-[928px]) so the buyer settings column reads at
    // a consistent width across detail pages.
    <div className="mx-auto w-full max-w-[928px] space-y-6">
      <BuyerDetailHeader buyer={buyer} />

      <div className="space-y-4">
        {/* Underline-style tab strip — matches Campaign Settings, Workspace,
            and Coin Market. Replaces the heavy shadcn pill triggers that read
            as a giant button block. */}
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
                  "relative inline-flex items-center gap-1.5 whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-none",
                  active
                    ? "text-accent"
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

        {tab === "overview" && <BuyerOverviewTab buyer={buyer} />}
        {tab === "campaigns" && <BuyerCampaignsTab campaignIds={buyer.campaignIds} />}
        {tab === "destinations" && <BuyerDestinationsTab buyer={buyer} />}
        {tab === "caps" && <BuyerCapsTab buyer={buyer} />}
        {tab === "settings" && <BuyerSettingsTab buyer={buyer} />}
      </div>
    </div>
  );
}

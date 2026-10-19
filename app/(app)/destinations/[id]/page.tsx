"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Target } from "lucide-react";

import { DestinationBuilder } from "@/components/destinations/destination-builder";
import { DestinationDetailHeader } from "@/components/destinations/destination-detail-header";
import { DestinationSettingsTab } from "@/components/destinations/destination-settings-tab";
import { DestinationStatsRow } from "@/components/destinations/destination-stats-row";
import { EmptyState } from "@/components/shared/empty-state";
import { useBreadcrumbOverride } from "@/hooks/use-breadcrumb-override";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { Locked } from "@/components/shared/can";

export default function DestinationDetailPage() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const destination = useDestinationsStore((s) => s.getById(params.id));
  const hydrated = useDestinationsStore((s) => s.hydrated);
  const fetch = useDestinationsStore((s) => s.fetch);

  const [builderOpen, setBuilderOpen] = useState(false);

  useBreadcrumbOverride(destination?.name);

  // On direct deep-link the store may not be hydrated yet — trigger a fetch
  // and wait. Only redirect once we've confirmed the destination really
  // doesn't exist (hydrated AND still no match).
  useEffect(() => {
    if (!hydrated) {
      void fetch();
      return;
    }
    if (!destination) {
      const t = setTimeout(() => router.replace(ROUTES.destinations), 600);
      return () => clearTimeout(t);
    }
  }, [hydrated, destination, fetch, router]);

  if (!destination) {
    return (
      <EmptyState
        icon={Target}
        tone="cyan"
        title={t("networkUI.destinations.empty.notFound")}
        description={t("networkUI.destinations.empty.notFoundDesc")}
      />
    );
  }

  return (
    // Max-width wrapper — matches the Campaign settings page (max-w-[928px])
    // so the form column reads at a consistent width across detail pages.
    <div className="mx-auto w-full max-w-[928px] space-y-6">
      <DestinationDetailHeader
        destination={destination}
        onEdit={() => setBuilderOpen(true)}
      />
      <DestinationStatsRow destination={destination} />

      {/* Overview and Calls tabs were removed per product direction; the page
          is settings-only now, so we render the Settings panel directly
          without the tab chrome. */}
      <Locked area="destinations" action="edit">
        <DestinationSettingsTab
          destination={destination}
          onEdit={() => setBuilderOpen(true)}
        />
      </Locked>

      <DestinationBuilder
        open={builderOpen}
        onOpenChange={setBuilderOpen}
        editId={destination.id}
      />
    </div>
  );
}

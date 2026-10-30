"use client";

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";
import type { CampaignStatus } from "@/lib/types";

const VARIANT: Record<CampaignStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  paused: "warning",
  draft: "outline",
  archived: "secondary",
};

interface Props {
  status: CampaignStatus;
  className?: string;
  /** CH-408: a dot on every status, not only Active (the campaign page). */
  dot?: boolean;
}

export function CampaignStatusBadge({ status, className, dot = false }: Props) {
  const { t } = useTranslation();
  const LABEL: Record<CampaignStatus, string> = {
    active: t("trafficUI.campaigns.status.active"),
    paused: t("trafficUI.campaigns.status.paused"),
    draft: t("trafficUI.campaigns.status.draft"),
    archived: t("trafficUI.campaigns.status.archived"),
  };
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {status === "active" && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {dot && status !== "active" && <span className="inline-flex h-1.5 w-1.5 rounded-full bg-current" />}
      {LABEL[status]}
    </Badge>
  );
}

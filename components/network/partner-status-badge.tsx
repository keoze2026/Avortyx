"use client";

/**
 * Shared status badge for buyers + publishers.
 * Handles every status union we have today.
 */

import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/hooks/use-translation";
import type { BuyerStatus, PublisherStatus } from "@/lib/types";

type AnyStatus = BuyerStatus | PublisherStatus;

const VARIANT: Record<AnyStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  paused: "warning",
  capped: "warning",
  pending: "outline",
};

const LABEL: Record<AnyStatus, string> = {
  active: "x318.network.partnerStatus.active",
  paused: "x318.network.partnerStatus.paused",
  capped: "x318.network.partnerStatus.capped",
  pending: "x318.network.partnerStatus.pending",
};

export function PartnerStatusBadge({ status, className }: { status: AnyStatus; className?: string }) {
  const { t } = useTranslation();
  return (
    <Badge variant={VARIANT[status]} className={className}>
      {status === "active" && (
        <span className="relative inline-flex h-1.5 w-1.5">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
        </span>
      )}
      {LABEL[status] ? t(LABEL[status]) : status}
    </Badge>
  );
}

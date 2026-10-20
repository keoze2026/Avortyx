"use client";

import { useTranslation } from "@/hooks/use-translation";
import type { CampaignRisk } from "@/lib/campaign-risk";
import { cn } from "@/lib/utils";

const TONE: Record<string, string> = {
  high: "border-red-500/40 bg-red-500/10 text-red-400",
  low: "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
  mixed: "border-amber-500/40 bg-amber-500/10 text-amber-400",
};

/** High Risk / Low Risk / Mixed for a campaign, with its TFN split on hover. */
export function CampaignRiskBadge({ risk, className }: { risk: CampaignRisk; className?: string }) {
  const { t } = useTranslation();
  if (risk.kind === "none") {
    return <span className={cn("text-xs text-muted-foreground", className)}>—</span>;
  }
  const label = t(`campaignRisk.${risk.kind}`);
  const detail = t("campaignRisk.detail")
    .replace("{high}", String(risk.high))
    .replace("{low}", String(risk.low))
    .replace("{total}", String(risk.total));
  return (
    <span
      title={detail}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold",
        TONE[risk.kind],
        className,
      )}
    >
      {label}
    </span>
  );
}

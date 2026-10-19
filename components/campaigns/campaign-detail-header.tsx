"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, MoreVertical, Pause, Play, Settings as SettingsIcon, Trash2 } from "lucide-react";

import { CampaignStatusBadge } from "./campaign-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { VERTICAL_ACCENT, type Campaign } from "@/lib/types";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePermissions } from "@/lib/my-permissions";
import { localizeName } from "@/lib/name-translation";
import { cn } from "@/lib/utils";

const DOT: Record<string, string> = {
  cyan: "bg-accent",
  emerald: "bg-[oklch(0.6_0.18_155)]",
  violet: "bg-[oklch(0.6_0.2_290)]",
  amber: "bg-[oklch(0.6_0.16_75)]",
  rose: "bg-[oklch(0.6_0.2_10)]",
};
const GLOW: Record<string, string> = {
  cyan: "rgba(59, 182, 255, 0.22)",
  emerald: "rgba(40, 175, 110, 0.22)",
  violet: "rgba(150, 95, 220, 0.22)",
  amber: "rgba(220, 160, 60, 0.22)",
  rose: "rgba(225, 90, 130, 0.22)",
};

export function CampaignDetailHeader({ campaign }: { campaign: Campaign }) {
  const { t, locale } = useTranslation();
  // Publisher / buyer logins look, they don't pause or archive.
  const { isPartner } = usePartnerPermissions();
  const { can } = usePermissions();
  const router = useRouter();
  const setStatus = useCampaignsStore((s) => s.setStatus);
  const remove = useCampaignsStore((s) => s.remove);

  const tone = VERTICAL_ACCENT[campaign.vertical] ?? "cyan";
  const isActive = campaign.status === "active";

  const onToggle = () => {
    const next = isActive ? "paused" : "active";
    setStatus(campaign.id, next);
    toast.success(
      next === "active"
        ? t("trafficUI.campaigns.toast.activated").replace("{name}", campaign.name)
        : t("trafficUI.campaigns.toast.paused").replace("{name}", campaign.name),
    );
  };
  const onArchive = () => {
    remove(campaign.id);
    toast.success(t("trafficUI.campaigns.toast.archived").replace("{name}", campaign.name));
    router.push(ROUTES.campaigns);
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full blur-3xl"
        style={{ background: GLOW[tone] }}
      />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-7 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => router.push(ROUTES.campaigns)}
          >
            <ArrowLeft className="h-3 w-3" /> {t("trafficUI.campaigns.detail.backToList")}
          </Button>
          <div className="mt-2 flex items-center gap-2 text-[11px]">
            <span className={cn("inline-block h-1.5 w-1.5 rounded-full", DOT[tone])} />
            <span className="font-mono text-muted-foreground">{campaign.vertical}</span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono text-muted-foreground">{campaign.id}</span>
          </div>
          <h1
            className="mt-1 text-base font-semibold tracking-tight sm:text-lg"
            title={locale === "en" ? undefined : campaign.name}
          >
            {localizeName(campaign.name, locale)}
          </h1>
          {campaign.description && (
            <p className="mt-1 max-w-2xl text-xs text-muted-foreground">{campaign.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <CampaignStatusBadge status={campaign.status} />
          {!isPartner && (
          <>
          {can("campaigns", "edit-campaign") && (
          <Button size="sm" variant={isActive ? "outline" : "default"} onClick={onToggle}>
            {isActive ? (
              <>
                <Pause className="h-3.5 w-3.5" /> {t("trafficUI.campaigns.detail.pause")}
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> {t("trafficUI.campaigns.detail.activate")}
              </>
            )}
          </Button>
          )}
          {can("campaigns", "delete") && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={t("trafficUI.campaigns.detail.actionsMenu")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={onArchive}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> {t("trafficUI.campaigns.detail.archiveCampaign")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          )}
          </>
          )}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, MoreVertical, Pause, Pencil, Play, Settings as SettingsIcon, Trash2 } from "lucide-react";

import { CampaignStatusBadge } from "./campaign-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { VerticalLabel } from "@/components/campaigns/vertical-label";
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
  const update = useCampaignsStore((s) => s.update);

  // Rename (CH-195). The settings screen that replaced the old settings tab
  // had no name field, so no campaign - a clone included - could be renamed.
  const canEdit = !isPartner && can("campaigns", "edit-campaign");
  const [renameOpen, setRenameOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState(false);
  const nameTooShort = newName.trim().length < 3;
  const openRename = () => {
    setNewName(campaign.name);
    setRenameOpen(true);
  };
  const onRename = async () => {
    const name = newName.trim();
    if (name.length < 3) return;
    if (name === campaign.name) {
      setRenameOpen(false);
      return;
    }
    setRenaming(true);
    try {
      await update(campaign.id, { name });
      toast.success(t("trafficUI.campaigns.detail.renamed").replace("{name}", localizeName(name, locale)));
      setRenameOpen(false);
    } catch (e) {
      toast.error(e instanceof Error && e.message ? e.message : t("trafficUI.campaigns.detail.renameFailed"));
    } finally {
      setRenaming(false);
    }
  };

  const tone = VERTICAL_ACCENT[campaign.vertical] ?? "cyan";
  const isActive = campaign.status === "active";

  const onToggle = () => {
    const next = isActive ? "paused" : "active";
    setStatus(campaign.id, next);
    toast.success(
      next === "active"
        ? t("trafficUI.campaigns.toast.activated").replace("{name}", localizeName(campaign.name, locale))
        : t("trafficUI.campaigns.toast.paused").replace("{name}", localizeName(campaign.name, locale)),
    );
  };
  const onArchive = () => {
    remove(campaign.id);
    toast.success(t("trafficUI.campaigns.toast.archived").replace("{name}", localizeName(campaign.name, locale)));
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
            <span className="font-mono text-muted-foreground"><VerticalLabel vertical={campaign.vertical} /></span>
            <span className="text-muted-foreground/60">·</span>
            <span className="font-mono text-muted-foreground">{campaign.id}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5">
            <h1
              className="min-w-0 truncate text-base font-semibold tracking-tight sm:text-lg"
              title={locale === "en" ? undefined : campaign.name}
            >
              {localizeName(campaign.name, locale)}
            </h1>
            {canEdit && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
                onClick={openRename}
                aria-label={t("trafficUI.campaigns.detail.rename")}
                title={t("trafficUI.campaigns.detail.rename")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
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

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("trafficUI.campaigns.detail.renameTitle")}</DialogTitle>
          </DialogHeader>
          <form
            className="space-y-2 py-2"
            onSubmit={(e) => {
              e.preventDefault();
              void onRename();
            }}
          >
            <Label htmlFor="campaign-rename">{t("trafficUI.campaigns.detail.renameLabel")}</Label>
            <Input
              id="campaign-rename"
              value={newName}
              autoFocus
              maxLength={255}
              onChange={(e) => setNewName(e.target.value)}
              aria-invalid={nameTooShort}
            />
            {nameTooShort && (
              <p className="text-xs text-destructive">
                {t("trafficUI.campaigns.settings.errors.nameMin")}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameOpen(false)}>
              {t("trafficUI.common.cancel")}
            </Button>
            <Button onClick={() => void onRename()} disabled={renaming || nameTooShort}>
              {renaming && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {t("trafficUI.campaigns.detail.renameSave")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

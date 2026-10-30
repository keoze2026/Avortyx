"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, BarChart3, Check, Copy, Loader2, MoreVertical, Pause, Pencil, Play, Trash2 } from "lucide-react";

import { CampaignStatusBadge } from "./campaign-status-badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import type { Campaign } from "@/lib/types";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePermissions } from "@/lib/my-permissions";
import { localizeName } from "@/lib/name-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import { VerticalLabel } from "@/components/campaigns/vertical-label";
import { analyticsService, type EntitySummary } from "@/lib/api/services/analytics.service";
import { todayScope } from "@/lib/reports-scope";
import { useCampaignPageStore } from "@/lib/store/campaign-page-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { cn } from "@/lib/utils";

/** How often the header's figures refresh while the page is open. */
const STATS_REFRESH_MS = 30_000;

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
  // CH-331: asks first (Sir, 28 Oct), as on the Campaigns list.
  const [confirmOpen, setConfirmOpen] = useState(false);
  const onArchive = () => {
    setConfirmOpen(false);
    remove(campaign.id);
    toast.success(t("trafficUI.campaigns.toast.archived").replace("{name}", localizeName(campaign.name, locale)));
    router.push(ROUTES.campaigns);
  };

  // ─── CH-408: the figures strip (Sir's design) ──────────────────────────
  // Calls today, Connected and Unique callers come from the same Reports
  // summary for today (the report time zone), so the % is of the same calls.
  // Without reporting access the summary is refused: Calls today then falls
  // back to the campaign's own count and the other two show a dash.
  const localName = useLocalName();
  const canReport = can("reporting", "view");
  const [today, setToday] = useState<EntitySummary | null | undefined>(undefined);
  useEffect(() => {
    if (isPartner || !canReport) return;
    let cancelled = false;
    const load = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      analyticsService
        .campaignSummary(todayScope())
        .then((rows) => {
          if (!cancelled) setToday(rows.find((r) => r.entityId === campaign.id) ?? null);
        })
        .catch(() => {
          if (!cancelled) setToday((prev) => prev ?? null);
        });
    };
    load();
    const timer = setInterval(load, STATS_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [campaign.id, isPartner, canReport]);

  const allNumbers = useNumbersStore((s) => s.numbers);
  const numbers = useMemo(
    () => (allNumbers ?? []).filter((n) => n.campaignId === campaign.id),
    [allNumbers, campaign.id],
  );
  const activeNumbers = numbers.filter((n) => n.status === "active").length;
  // The publisher chip: the publisher the campaign's numbers belong to.
  const publishers = useMemo(
    () => Array.from(new Set(numbers.map((n) => n.publisherName).filter((p): p is string => !!p))),
    [numbers],
  );
  const routed = useCampaignPageStore((s) => s.routed[campaign.id]);

  const callsToday = today ? today.totalCalls : campaign.callsToday;
  // A campaign with no calls today has no summary row: zero, not unknown.
  const connected = today === null ? (canReport ? 0 : undefined) : today?.connectedCalls;
  const unique = today === null ? (canReport ? 0 : undefined) : today?.uniqueCallers;
  const connectedPct = connected !== undefined && callsToday > 0 ? Math.round((connected / callsToday) * 100) : null;
  const fmt = (n: number) => n.toLocaleString(locale);

  const [copied, setCopied] = useState(false);
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(campaign.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(t("x408.copyFailed"));
    }
  };

  const stats: Array<{ label: string; value: string; sub?: string }> = [
    { label: t("x408.callsToday"), value: fmt(callsToday) },
    {
      label: t("x408.connected"),
      value: connected === undefined ? "—" : fmt(connected),
      sub: connectedPct === null ? undefined : `${connectedPct}%`,
    },
    { label: t("x408.uniqueCallers"), value: unique === undefined ? "—" : fmt(unique) },
    {
      label: t("x408.trackingNumbers"),
      value: fmt(numbers.length),
      sub: t("x408.nActive").replace("{n}", fmt(activeNumbers)),
    },
    {
      label: t("x408.destinations"),
      value: routed ? fmt(routed.total) : "—",
      sub: routed ? t("x408.nOn").replace("{n}", fmt(routed.on)) : undefined,
    },
  ];

  return (
    <div className="space-y-4">
      <button
        type="button"
        className="inline-flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={() => router.push(ROUTES.campaigns)}
      >
        <ArrowLeft className="h-3.5 w-3.5" /> {t("x408.allCampaigns")}
      </button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5">
            <h1
              className="min-w-0 truncate text-2xl font-semibold tracking-tight"
              title={locale === "en" ? undefined : campaign.name}
            >
              {localizeName(campaign.name, locale)}
            </h1>
            <CampaignStatusBadge status={campaign.status} dot />
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
          <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
            {publishers.length > 0 && (
              <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
                {t("x408.publisher")} · <span className="font-medium text-foreground">
                  {publishers.length === 1 ? localName(publishers[0]) : fmt(publishers.length)}
                </span>
              </span>
            )}
            <span className="rounded-md border border-border px-2 py-0.5 text-muted-foreground">
              <VerticalLabel vertical={campaign.vertical} />
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border border-border px-2 py-0.5 font-mono text-muted-foreground">
              {campaign.id}
              <button
                type="button"
                onClick={() => void copyId()}
                className="text-muted-foreground transition-colors hover:text-foreground"
                aria-label={t("x408.copyId")}
                title={t("x408.copyId")}
              >
                {copied ? <Check className="h-3 w-3 text-[color:var(--success)]" /> : <Copy className="h-3 w-3" />}
              </button>
            </span>
          </div>
          {campaign.description && (
            <p className="mt-2 max-w-2xl text-xs text-muted-foreground">{campaign.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!isPartner && (
          <>
          {canReport && (
            <Button size="sm" variant="outline" onClick={() => router.push(`${ROUTES.reports}?campaign=${encodeURIComponent(campaign.id)}`)}>
              <BarChart3 className="h-3.5 w-3.5" /> {t("x408.viewReport")}
            </Button>
          )}
          {can("campaigns", "edit-campaign") && (
          <Button
            size="sm"
            variant={isActive ? "outline" : "default"}
            className={isActive ? undefined : "bg-accent text-accent-foreground hover:bg-accent/90"}
            onClick={onToggle}
          >
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
              <Button variant="outline" size="icon" className="h-8 w-8" aria-label={t("trafficUI.campaigns.detail.actionsMenu")}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={() => setConfirmOpen(true)}
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

      {!isPartner && (
        // gap-px over the border colour draws the dividers on every layout.
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
          {stats.map((st, i) => (
            <div
              key={st.label}
              className={cn("bg-card px-4 py-3", i === stats.length - 1 && "col-span-2 sm:col-span-1")}
            >
              <div className="text-[11px] text-muted-foreground">{st.label}</div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xl font-semibold tabular-nums tracking-tight">{st.value}</span>
                {st.sub && <span className="text-[11px] text-muted-foreground">{st.sub}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("cdel.title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("cdel.desc").replace("{name}", localizeName(campaign.name, locale))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cdel.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={onArchive} className="bg-destructive text-white hover:bg-destructive/90">
              {t("cdel.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

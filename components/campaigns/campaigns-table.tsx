"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  CirclePlus,
  Pencil,
  Trash2,
  Undo2,
  User,
} from "lucide-react";

import {
  ALL_CAMPAIGN_COLUMNS,
  type CampaignColumnKey,
} from "@/components/campaigns/campaigns-toolbar";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { Campaign } from "@/lib/types";
import { cn } from "@/lib/utils";

type ProgressState = "ready" | "paused" | "incomplete";

interface CampaignsTableProps {
  campaigns: Campaign[];
  columns?: Record<CampaignColumnKey, boolean>;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
  /** Optional controlled selection. When provided, the parent owns the set
   *  and the table reports changes via `onSelectionChange`. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Helpers                                                             */
/* ─────────────────────────────────────────────────────────────────── */

interface CampaignMetrics {
  liveCurrent: number;
  liveCap: number;
  hourly: number;
  daily: number;
  monthly: number;
  global: number;
}

/**
 * Real metrics pulled from the Campaign record. The backend only ships
 * `callsToday` per campaign today; until it adds hourly / monthly / global
 * counters those columns render 0. The "live cap" column is the daily-cap
 * value the user configured (0 = unlimited).
 */
function makeMetrics(c: Campaign): CampaignMetrics {
  return {
    liveCurrent: 0,
    liveCap: c.dailyCap,
    hourly: 0,
    daily: c.callsToday,
    monthly: 0,
    global: 0,
  };
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Component                                                           */
/* ─────────────────────────────────────────────────────────────────── */

export function CampaignsTable({
  campaigns,
  columns = ALL_CAMPAIGN_COLUMNS,
  onToggle,
  onArchive,
  selectedIds,
  onSelectionChange,
}: CampaignsTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // Live count of tracking numbers attached per campaign — drives the
  // "Incomplete" progress pill so a campaign with zero TFNs reads as needing
  // setup, regardless of its on-record `numbersCount`.
  const allNumbers = useNumbersStore((s) => s.numbers);
  const numbersByCampaign = React.useMemo(() => {
    const map = new Map<string, number>();
    for (const n of allNumbers ?? []) {
      if (!n.campaignId) continue;
      map.set(n.campaignId, (map.get(n.campaignId) ?? 0) + 1);
    }
    return map;
  }, [allNumbers]);
  // Uncontrolled fallback so existing callers that don't pass `selectedIds`
  // still get their internal checkbox state. When the parent supplies both
  // `selectedIds` and `onSelectionChange`, the selection lives upstairs.
  const [internalSelected, setInternalSelected] = React.useState<Set<string>>(new Set());
  const selected = selectedIds ?? internalSelected;
  const setSelected = (next: Set<string>) => {
    if (onSelectionChange) onSelectionChange(next);
    else setInternalSelected(next);
  };

  const allChecked = campaigns.length > 0 && campaigns.every((c) => selected.has(c.id));
  const indeterminate = !allChecked && campaigns.some((c) => selected.has(c.id));

  const toggleAll = () => {
    if (allChecked || indeterminate) setSelected(new Set());
    else setSelected(new Set(campaigns.map((c) => c.id)));
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allChecked || (indeterminate && "indeterminate")}
                  onCheckedChange={toggleAll}
                  aria-label={t("trafficUI.campaigns.table.selectAll")}
                />
              </TableHead>
              {columns.progress && <TableHead>{t("trafficUI.campaigns.columns.progress")}</TableHead>}
              <TableHead className="text-left">{t("trafficUI.campaigns.columns.campaign")}</TableHead>
              {columns.access && <TableHead>{t("trafficUI.campaigns.columns.access")}</TableHead>}
              {columns.live && <TableHead>{t("trafficUI.campaigns.columns.live")}</TableHead>}
              {columns.hourly && <TableHead>{t("trafficUI.campaigns.columns.hourly")}</TableHead>}
              {columns.daily && <TableHead>{t("trafficUI.campaigns.columns.daily")}</TableHead>}
              {columns.monthly && <TableHead>{t("trafficUI.campaigns.columns.monthly")}</TableHead>}
              {columns.global && <TableHead>{t("trafficUI.campaigns.columns.global")}</TableHead>}
              {columns.status && <TableHead>{t("trafficUI.campaigns.columns.status")}</TableHead>}
              <TableHead className="pr-4">{t("trafficUI.campaigns.columns.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => {
              const m = makeMetrics(c);
              const isActive = c.status === "active";
              const isPaused = c.status === "paused";
              // A campaign is "incomplete" only when no tracking number is
              // attached at all — that's the one hard requirement before a
              // call can land. Buyers are wired up via routing rules (not
              // the campaign's `buyersCount` field), so a campaign whose
              // routing rule points at a buyer can legitimately have
              // buyersCount === 0 and still be fully routable.
              //
              // We OR the backend-supplied `c.numbersCount` with the local
              // numbers-store count: that way a campaign whose number was
              // just attached doesn't briefly read "Incomplete" while the
              // numbers store catches up. The backend has no completeness
              // signal of its own (confirmed by backend dev), so this
              // badge is computed entirely client-side.
              const liveNumbers = numbersByCampaign.get(c.id) ?? 0;
              const hasNumber = (c.numbersCount ?? 0) > 0 || liveNumbers > 0;
              const isIncomplete = c.status !== "archived" && !hasNumber;
              const progressState: ProgressState = isIncomplete
                ? "incomplete"
                : isPaused
                  ? "paused"
                  : "ready";
              return (
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`${ROUTES.campaigns}/${c.id}`)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(c.id)}
                      onCheckedChange={() => toggleOne(c.id)}
                      aria-label={t("trafficUI.campaigns.table.selectRow").replace("{name}", c.name)}
                    />
                  </TableCell>
                  {columns.progress && (
                    <TableCell>
                      <ProgressPill state={progressState} />
                    </TableCell>
                  )}
                  <TableCell className="text-left font-medium text-foreground">
                    {/* Push the Active pill to the cell's right edge so the
                        badge column reads as a clean vertical band, regardless
                        of campaign-name length. */}
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="truncate">{c.name}</span>
                      {isActive && <ActiveBadge />}
                    </div>
                  </TableCell>
                  {columns.access && (
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                        <User className="h-3.5 w-3.5" />
                        {t("trafficUI.common.public")}
                      </span>
                    </TableCell>
                  )}
                  {columns.live && (
                    <TableCell>
                      <LiveBox current={m.liveCurrent} cap={m.liveCap} />
                    </TableCell>
                  )}
                  {columns.hourly && (
                    <TableCell className="tabular-nums">{m.hourly}</TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="tabular-nums">{m.daily}</TableCell>
                  )}
                  {columns.monthly && (
                    <TableCell className="tabular-nums">{m.monthly.toLocaleString("en-US", { useGrouping: false })}</TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="tabular-nums">{m.global.toLocaleString("en-US", { useGrouping: false })}</TableCell>
                  )}
                  {columns.status && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => onToggle(c.id)}
                        aria-label={isActive ? t("trafficUI.campaigns.table.pauseCampaign") : t("trafficUI.campaigns.table.activateCampaign")}
                      />
                    </TableCell>
                  )}
                  <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      <ActionIcon
                        icon={Pencil}
                        label={t("trafficUI.campaigns.table.edit")}
                        onClick={() => router.push(`${ROUTES.campaigns}/${c.id}`)}
                      />
                      <ActionIcon icon={CirclePlus} label={t("trafficUI.campaigns.table.duplicate")} />
                      <ActionIcon icon={Undo2} label={t("trafficUI.campaigns.table.revert")} />
                      <ActionIcon
                        icon={Trash2}
                        label={t("trafficUI.campaigns.table.archive")}
                        tone="destructive"
                        onClick={() => onArchive(c.id)}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Subcomponents                                                       */
/* ─────────────────────────────────────────────────────────────────── */

function ActiveBadge() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[oklch(0.78_0.18_155)]/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
      <span aria-hidden className="h-1 w-1 rounded-full bg-current" />
      {t("trafficUI.common.active")}
    </span>
  );
}

function ProgressPill({ state }: { state: ProgressState }) {
  const { t } = useTranslation();
  // `incomplete` reads as urgent (red) so the operator knows setup is
  // needed; `paused` is amber for the holding pattern; `ready` is green.
  const toneClass =
    state === "incomplete"
      ? "bg-destructive/15 text-destructive"
      : state === "paused"
        ? "bg-[color:var(--warning)]/15 text-[color:var(--warning)]"
        : "bg-[color:var(--success)]/15 text-[color:var(--success)]";
  const labelKey =
    state === "incomplete"
      ? "trafficUI.campaigns.table.incomplete"
      : state === "paused"
        ? "trafficUI.campaigns.table.paused"
        : "trafficUI.campaigns.table.ready";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-medium",
        toneClass,
      )}
    >
      {t(labelKey)}
    </span>
  );
}

function LiveBox({ current, cap }: { current: number; cap: number }) {
  return (
    <span className="inline-flex h-7 min-w-[4.5rem] items-center justify-center rounded-md border border-border bg-secondary/30 px-2 font-mono text-xs tabular-nums">
      {current} / {cap}
    </span>
  );
}

function ActionIcon({
  icon: Icon,
  label,
  onClick,
  tone = "muted",
}: {
  icon: React.ElementType;
  label: string;
  onClick?: () => void;
  tone?: "muted" | "destructive";
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        tone === "destructive"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

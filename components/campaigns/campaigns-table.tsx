"use client";

import * as React from "react";
import { toast } from "sonner";
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
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { Campaign } from "@/lib/types";
import { localizeName } from "@/lib/name-translation";
import { cn } from "@/lib/utils";

type ProgressState = "ready" | "paused" | "incomplete";

/**
 * Ready / Paused / Incomplete for one campaign — the rule behind the Progress
 * badge. A campaign is "incomplete" only when no tracking number is attached
 * at all (`numbersCount` from the backend, or numbers in the local numbers
 * store); otherwise a paused campaign is "paused" and the rest are "ready".
 * Shared with the Campaigns page so the list order always matches the badge.
 */
export function campaignProgress(
  c: { status: string; numbersCount?: number | null },
  localNumbers = 0,
): ProgressState {
  const hasNumber = (c.numbersCount ?? 0) > 0 || localNumbers > 0;
  if (c.status !== "archived" && !hasNumber) return "incomplete";
  return c.status === "paused" ? "paused" : "ready";
}

/** List order: Ready first, then Paused, then Incomplete. */
export const PROGRESS_ORDER: Record<ProgressState, number> = { ready: 0, paused: 1, incomplete: 2 };

interface CampaignsTableProps {
  campaigns: Campaign[];
  columns?: Record<CampaignColumnKey, boolean>;
  onToggle: (id: string) => void;
  /** False for a partner login without Manage Traffic: status, archive locked. */
  canManage?: boolean;
  /** False for a partner login that may not create campaigns: no Duplicate. */
  canCreate?: boolean;
  /** False when the role has no Delete tick for campaigns: no Archive icon. */
  canDelete?: boolean;
  onArchive: (id: string) => void;
  /** Called when the + (clone) icon is clicked on a row. */
  onClone?: (id: string) => void;
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
  /** Daily call cap (0 = unlimited), shown and edited next to today's calls. */
  dailyCap: number;
  hourly: number;
  daily: number;
  monthly: number;
  global: number;
}

/**
 * Real metrics pulled from the Campaign record — see BACKEND-CONTRACT.md
 * §3.8 "Live counter fields" for where `liveCalls`/`callsHour`/`callsMonth`/
 * `callsGlobal` come from. The Live column shows live calls against the
 * campaign's concurrent-call (CC) limit, `cap.max_concurrency` (0 = unlimited).
 */
function makeMetrics(c: Campaign): CampaignMetrics {
  return {
    liveCurrent: c.liveCalls,
    liveCap: c.maxConcurrency ?? 0,
    dailyCap: c.dailyCap ?? 0,
    hourly: c.callsHour,
    daily: c.callsToday,
    monthly: c.callsMonth,
    global: c.callsGlobal,
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
  onClone,
  selectedIds,
  onSelectionChange,
  canManage = true,
  canCreate = true,
  canDelete = true,
}: CampaignsTableProps) {
  const { t, locale } = useTranslation();
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

  // The longest names, measured by the browser in the real font: invisible
  // copies in every name cell give all of them the same width (CH-269).
  const widestNames = Array.from(new Set(campaigns.map((c) => localizeName(c.name, locale))))
    .sort((a, b) => b.length - a.length)
    .slice(0, 3);

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
              <TableHead>{t("trafficUI.campaigns.columns.campaign")}</TableHead>
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
              const progressState = campaignProgress(c, numbersByCampaign.get(c.id) ?? 0);
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
                  <TableCell className="font-medium text-foreground">
                    {/* Centred under the heading (Sir, 24 Oct: "Under Campaign -
                        names are not in center"), as one block: every name
                        starts at the same place and the Active pills form one
                        straight band, whatever the name's length (CH-269). */}
                    <div className="mx-auto flex w-fit items-center gap-3">
                      <div className="grid max-w-[260px] text-left">
                        <span className="truncate [grid-area:1/1]" title={locale === "en" ? undefined : c.name}>
                          {localizeName(c.name, locale)}
                        </span>
                        {widestNames.map((n) => (
                          <span key={n} aria-hidden className="invisible h-0 truncate [grid-area:1/1]">
                            {n}
                          </span>
                        ))}
                      </div>
                      <span className={isActive ? undefined : "invisible"} aria-hidden={!isActive}>
                        <ActiveBadge />
                      </span>
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
                      <LiveBox campaignId={c.id} current={m.liveCurrent} cap={m.liveCap} />
                    </TableCell>
                  )}
                  {columns.hourly && (
                    <TableCell className="tabular-nums">{m.hourly}</TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="tabular-nums">
                      <DailyCapBox campaignId={c.id} current={m.daily} cap={m.dailyCap} editable={canManage} />
                    </TableCell>
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
                        disabled={!canManage}
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
                      {canCreate && (
                        <ActionIcon
                          icon={CirclePlus}
                          label={t("trafficUI.campaigns.table.duplicate")}
                          onClick={() => onClone?.(c.id)}
                        />
                      )}
                      {canManage && canDelete && (
                        <>
                          <ActionIcon icon={Undo2} label={t("trafficUI.campaigns.table.revert")} />
                          <ActionIcon
                            icon={Trash2}
                            label={t("trafficUI.campaigns.table.archive")}
                            tone="destructive"
                            onClick={() => onArchive(c.id)}
                          />
                        </>
                      )}
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
        // One width for every state (sized to fit "Incomplete"), text centred,
        // so Ready, Incomplete and Paused are the same size.
        "inline-flex min-w-[5.75rem] items-center justify-center rounded-md px-2.5 py-1 text-[11px] font-medium",
        toneClass,
      )}
    >
      {t(labelKey)}
    </span>
  );
}

/**
 * Live calls / CC limit. The limit is editable in place, like the caps on the
 * Destinations page: click it, type a number, Enter or click away to save,
 * Escape to cancel. 0 = unlimited (shown as ∞). Same font as the other
 * number cells in the row.
 */
function LiveBox({ campaignId, current, cap }: { campaignId: string; current: number; cap: number }) {
  const { t } = useTranslation();
  const setConcurrency = useCampaignsStore((s) => s.setConcurrency);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(cap));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Reflect saved / refreshed values while not editing.
  React.useEffect(() => {
    if (!editing) setDraft(String(cap));
  }, [cap, editing]);

  const commit = () => {
    const next = Math.max(0, Math.floor(Number(draft) || 0));
    setEditing(false);
    setDraft(String(next));
    if (next === cap) return;
    setConcurrency(campaignId, next).catch(() => {
      toast.error(t("x1.campaignCcLimit.saveError"));
    });
  };

  // Campaign full (live calls at its CC limit, e.g. 10 / 10): the box turns
  // solid blue so a full campaign stands out at a glance.
  const full = cap > 0 && current >= cap;

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-2 tabular-nums transition-colors",
        full
          ? "border-accent bg-accent font-semibold text-white"
          : "border-border bg-secondary/30",
      )}
      title={full ? t("x1.campaignCcLimit.full") : undefined}
    >
      <span>{current}</span>
      <span className={full ? "text-white/80" : "text-muted-foreground"}>/</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(String(cap));
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("x1.campaignCcLimit.input")}
          className="w-14 rounded border border-accent/50 bg-background px-1 py-0.5 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(String(cap));
            setEditing(true);
          }}
          title={t("x1.campaignCcLimit.edit")}
          aria-label={t("x1.campaignCcLimit.change")}
          className={cn(
            "cursor-text rounded px-1 tabular-nums transition-colors",
            full ? "hover:bg-white/15 hover:ring-1 hover:ring-white/50" : "hover:bg-accent/10 hover:ring-1 hover:ring-accent/40",
          )}
        >
          {cap > 0 ? cap : "∞"}
        </button>
      )}
    </span>
  );
}

/**
 * Today's calls / daily cap, editable in place exactly like the Live box:
 * click the cap, type a number, Enter or click away to save, Escape to
 * cancel. 0 = unlimited (∞). Saved as the campaign's daily cap - the one
 * routing checks - so the campaign stops taking calls for the day once it
 * reaches it.
 */
function DailyCapBox({
  campaignId,
  current,
  cap,
  editable = true,
}: {
  campaignId: string;
  current: number;
  cap: number;
  editable?: boolean;
}) {
  const { t } = useTranslation();
  const setDailyCap = useCampaignsStore((s) => s.setDailyCap);
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(String(cap));
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Reflect saved / refreshed values while not editing.
  React.useEffect(() => {
    if (!editing) setDraft(String(cap));
  }, [cap, editing]);

  const commit = () => {
    if (draft.trim() === "") {
      setEditing(false);
      setDraft(String(cap));
      return;
    }
    const next = Math.max(0, Math.floor(Number(draft) || 0));
    setEditing(false);
    setDraft(String(next));
    if (next === cap) return;
    setDailyCap(campaignId, next).catch(() => {
      toast.error(t("campaignDailyCap.saveError"));
    });
  };

  // Daily cap reached (e.g. 500 / 500): solid blue, like a full Live box.
  const full = cap > 0 && current >= cap;

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-2 tabular-nums transition-colors",
        full ? "border-accent bg-accent font-semibold text-white" : "border-border bg-secondary/30",
      )}
      title={full ? t("campaignDailyCap.full") : undefined}
    >
      <span>{current}</span>
      <span className={full ? "text-white/80" : "text-muted-foreground"}>/</span>
      {editing ? (
        <input
          ref={inputRef}
          type="number"
          inputMode="numeric"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setDraft(String(cap));
              setEditing(false);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          aria-label={t("campaignDailyCap.input")}
          className="w-14 rounded border border-accent/50 bg-background px-1 py-0.5 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : editable ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(String(cap));
            setEditing(true);
          }}
          title={t("campaignDailyCap.edit")}
          aria-label={t("campaignDailyCap.edit")}
          className={cn(
            "cursor-text rounded px-1 tabular-nums transition-colors",
            full ? "hover:bg-white/15 hover:ring-1 hover:ring-white/50" : "hover:bg-accent/10 hover:ring-1 hover:ring-accent/40",
          )}
        >
          {cap > 0 ? cap : "∞"}
        </button>
      ) : (
        <span className="px-1">{cap > 0 ? cap : "∞"}</span>
      )}
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
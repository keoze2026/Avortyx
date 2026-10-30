"use client";

import { useMemo, useState } from "react";
import { Hash, Pencil, Phone, Plus, Unlink } from "lucide-react";
import { toast } from "sonner";

import { AttachTrackingNumberDialog } from "@/components/campaigns/settings/attach-tracking-number-dialog";
import { TrackingNumberEditDialog } from "@/components/campaigns/settings/tracking-number-edit-dialog";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { CampaignRiskBadge } from "@/components/campaigns/campaign-risk-badge";
import { Badge } from "@/components/ui/badge";
import { campaignRisk } from "@/lib/campaign-risk";
import { compareByRiskThenAssigned } from "@/lib/risk-order";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
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
import { LocalName, useLocalName } from "@/lib/i18n/local-name";
import { useNumbersStore } from "@/lib/store/numbers-store";
import { formatCurrency, toE164 } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LiveBadge } from "@/components/campaigns/settings/live-badge";
import { SectionTitle } from "@/components/campaigns/settings/section-title";
import { liveFor, useLiveCounts } from "@/lib/use-live-counts";

export function TrackingNumbersSection({
  campaignId,
  readOnly = false,
}: {
  campaignId: string;
  /** Publisher / buyer login: see the numbers, change nothing (no add, edit,
   *  detach, rename or on/off). The list itself only holds their own numbers -
   *  the server sends a publisher only the numbers allocated to them. */
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  // Stable selector + useMemo to avoid the new-ref-per-render Zustand loop.
  const allNumbers = useNumbersStore((s) => s.numbers);
  // Calls up right now on each tracking number, for the LIVE column (Sir, CH-212).
  const live = useLiveCounts();
  const setNumberStatus = useNumbersStore((s) => s.setNumberStatus);
  const updateNumber = useNumbersStore((s) => s.updateNumber);
  const numbers = useMemo(
    () =>
      (allNumbers ?? [])
        .filter((n) => n.campaignId === campaignId)
        .sort((a, b) => compareByRiskThenAssigned(a, b)),
    [allNumbers, campaignId],
  );

  // The id of the tracking number currently being edited in the dialog.
  // `null` keeps the dialog closed.
  const [editingId, setEditingId] = useState<string | null>(null);
  // Controls the "Add tracking number" dialog. Two modes: pick from existing
  // unassigned inventory, or buy a fresh one — both auto-attach to this
  // campaign so the user never re-picks a campaign they're already editing.
  const [attachOpen, setAttachOpen] = useState(false);

  // Bulk select (Sir, 21 Oct: check boxes to work on many numbers at once,
  // like Revo). Only ids still on this campaign count, so a number detached
  // elsewhere drops out of the selection by itself.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const selectedIds = useMemo(
    () => numbers.filter((n) => selected.has(n.id)).map((n) => n.id),
    [numbers, selected],
  );
  const allChecked = numbers.length > 0 && selectedIds.length === numbers.length;
  const someChecked = selectedIds.length > 0 && !allChecked;
  const toggleAll = (on: boolean) => setSelected(on ? new Set(numbers.map((n) => n.id)) : new Set());
  const toggleOne = (id: string, on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });

  /**
   * The same actions as the row switch and the row unlink button, applied to
   * every selected number. One at a time: each save rolls back to its own
   * snapshot on failure, and running them together could undo another one.
   */
  const runBulk = async (kind: "activate" | "pause" | "detach") => {
    if (bulkBusy || selectedIds.length === 0) return;
    setBulkBusy(true);
    const targets = selectedIds;
    const failed: string[] = [];
    for (const id of targets) {
      try {
        if (kind === "detach") {
          await updateNumber(id, { campaignId: undefined, campaignName: undefined });
        } else {
          await setNumberStatus(id, kind === "activate" ? "active" : "paused");
        }
      } catch {
        failed.push(id);
      }
    }
    setBulkBusy(false);
    const ok = targets.length - failed.length;
    if (failed.length === 0) {
      const key =
        kind === "detach"
          ? "campaignNumbers.bulk.detached"
          : kind === "activate"
            ? "campaignNumbers.bulk.activated"
            : "campaignNumbers.bulk.paused";
      toast.success(t(key).replace("{count}", String(ok)));
    } else {
      toast.error(
        t("campaignNumbers.bulk.partial")
          .replace("{ok}", String(ok))
          .replace("{total}", String(targets.length))
          .replace("{failed}", String(failed.length)),
      );
    }
    // Keep the ones that could not be changed selected, so they are easy to find.
    setSelected(new Set(failed));
  };

  const handleDetach = (id: string, label: string) => {
    // Detaching = clear the campaign link so the number drops out of this
    // section. We don't delete the number itself.
    updateNumber(id, { campaignId: undefined, campaignName: undefined });
    toast.success(
      t("trafficUI.campaigns.settings.trackingNumbers.toast.detached").replace(
        "{number}",
        label,
      ),
    );
  };

  // One shared width per column (the longest value in it): every value then
  // starts at the same place, and that block is centred under the heading.
  const longest = (values: string[]) => values.reduce((m, v) => Math.max(m, v.length), 1);
  // Name column (Sir, 21 Oct: "name in center", like the Not Connected / Fail
  // Reason column): the names form one block exactly as wide as the widest of
  // them - measured by the browser in the real font from invisible copies -
  // centred under the heading, every name starting at the same place.
  const namePlaceholder = t("trafficUI.campaigns.settings.trackingNumbers.name.placeholder");
  const nameSizers = Array.from(
    new Set(numbers.map((n) => n.label?.trim() || (readOnly ? "—" : namePlaceholder))),
  );
  const publisherCh = Math.min(30, longest(numbers.map((n) => (n.publisherName ? localName(n.publisherName) : "—"))) + 1);
  // One width for every data column, so the headings sit at even gaps: 9
  // columns beside the checkbox, 8 on the read-only (partner) view.
  const col = readOnly ? "w-[12.5%]" : "w-[11%]";
  const payoutCh = longest(numbers.map((n) => formatCurrency(n.payoutPerCall ?? 0, true)));

  return (
    <section>
      {/* CH-409 (Sir): one card like Destinations - icon title on top, the
          table under it. Column headings stay in capitals. */}
      <Card className="overflow-hidden p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border pr-5">
        <SectionTitle
          icon={Phone}
          title={t("x408.trackingNumbers")}
          hint={t("x409.trackingHint")}
          className="pb-4"
        />
        {!readOnly && (
          <div className="flex items-center gap-2">
            {selectedIds.length > 0 && (
              <BulkActionsBar
                count={bulkBusy ? 0 : selectedIds.length}
                onPlay={() => void runBulk("activate")}
                onPause={() => void runBulk("pause")}
                onDetach={() => void runBulk("detach")}
                onClear={() => setSelected(new Set())}
                entity={t("campaignNumbers.bulk.entity")}
              />
            )}
            <Button size="sm" variant="outline" onClick={() => setAttachOpen(true)}>
              <Plus className="h-4 w-4" /> {t("x409.addNumber")}
            </Button>
          </div>
        )}
      </div>

      {numbers.length === 0 ? (
        <div className="p-5">
        <EmptyState
          icon={Hash}
          tone="violet"
          title={t("trafficUI.campaigns.settings.trackingNumbers.empty.title")}
          description={t("trafficUI.campaigns.settings.trackingNumbers.empty.description")}
          actions={
            readOnly ? undefined : (
              <Button size="sm" onClick={() => setAttachOpen(true)}>
                <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.settings.trackingNumbers.addTracking")}
              </Button>
            )
          }
        />
        </div>
      ) : (
        <>
          {/* Even columns (Sir, 23 Oct): a fixed layout with one width for every
              data column, and every heading and value centred under it. The
              widths used to follow each column's content, so the headings sat
              at uneven gaps. Scrolls sideways on a phone instead of squeezing. */}
          <Table className="min-w-[900px] table-fixed">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                {!readOnly && (
                  <TableHead className="w-10 pl-6">
                    <Checkbox
                      checked={allChecked ? true : someChecked ? "indeterminate" : false}
                      onCheckedChange={(v) => toggleAll(v === true)}
                      aria-label={t("campaignNumbers.bulk.selectAll")}
                    />
                  </TableHead>
                )}
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.number")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.type")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.name")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.publisher")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.payout")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("campaignRisk.column")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("networkUI.destinations.table.live")}</TableHead>
                <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.status")}</TableHead>
                {!readOnly && (
                  <TableHead className={cn(col, "text-center uppercase tracking-wider text-[11px]")}>{t("trafficUI.campaigns.settings.trackingNumbers.headers.actions")}</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {numbers.map((n) => {
                const e164 = toE164(n.number);
                return (
                  <TableRow key={n.id} data-state={selected.has(n.id) ? "selected" : undefined}>
                    {!readOnly && (
                      <TableCell className="w-10 pl-6">
                        <Checkbox
                          checked={selected.has(n.id)}
                          onCheckedChange={(v) => toggleOne(n.id, v === true)}
                          aria-label={t("campaignNumbers.bulk.selectRow").replace("{number}", e164)}
                        />
                      </TableCell>
                    )}
                    {/* Sir: digits only (18776691938), in JetBrains Mono like the design. */}
                    <TableCell className="text-center font-mono text-[13px] font-medium tabular-nums tracking-wide text-foreground whitespace-nowrap">
                      {e164.replace(/^\+/, "")}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="capitalize">
                        {n.type === "tollfree" ? t("trafficUI.numbers.typeOptions.tollfree") : n.type === "local" ? t("trafficUI.numbers.typeOptions.local") : t("trafficUI.numbers.typeOptions.international")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      <div className="mx-auto grid w-fit max-w-full">
                      {readOnly ? (
                        <span
                          className={cn(
                            "whitespace-nowrap text-left [grid-area:1/1]",
                            !n.label && "text-muted-foreground",
                          )}
                        >
                          {n.label || "—"}
                        </span>
                      ) : (
                      <NumberNameCell
                        className="[grid-area:1/1]"
                        value={n.label ?? ""}
                        placeholder={namePlaceholder}
                        ariaLabel={t("trafficUI.campaigns.settings.trackingNumbers.name.aria").replace("{number}", e164)}
                        onSave={async (label) => {
                          try {
                            await updateNumber(n.id, { label });
                            toast.success(t("trafficUI.campaigns.settings.trackingNumbers.name.saved"));
                          } catch {
                            toast.error(t("trafficUI.campaigns.settings.trackingNumbers.name.error"));
                          }
                        }}
                      />
                      )}
                      <WidestOf
                        values={nameSizers}
                        className={readOnly ? undefined : "border border-transparent px-2"}
                      />
                      </div>
                    </TableCell>
                    {/* The values start at the same place in every row, and that
                        block is centred under the heading. */}
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="mx-auto max-w-full truncate text-left" style={{ width: `${publisherCh}ch` }}>
                        {n.publisherName ? <LocalName name={n.publisherName} /> : "—"}
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      <div className="mx-auto whitespace-nowrap text-left" style={{ width: `${payoutCh}ch` }}>
                        {formatCurrency(n.payoutPerCall ?? 0, true)}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <CampaignRiskBadge risk={campaignRisk([n])} />
                    </TableCell>
                    <TableCell className="text-center">
                      <LiveBadge live={liveFor(live.tracking, n.number)} loaded={live.loaded} />
                    </TableCell>
                    <TableCell className="text-center">
                      {readOnly ? (
                        <Badge variant={n.status === "active" ? "success" : "outline"}>
                          {t(n.status === "active" ? "partnerCampaign.numberOn" : "partnerCampaign.numberOff")}
                        </Badge>
                      ) : (
                      <Switch className="data-[state=checked]:bg-accent"
                        checked={n.status === "active"}
                        onCheckedChange={(v) => {
                          setNumberStatus(n.id, v ? "active" : "paused");
                          toast.success(
                            v
                              ? t("trafficUI.campaigns.settings.trackingNumbers.toast.activated").replace("{number}", e164)
                              : t("trafficUI.campaigns.settings.trackingNumbers.toast.paused").replace("{number}", e164),
                          );
                        }}
                        aria-label={t("trafficUI.numbers.pools.toggle").replace("{name}", e164)}
                      />
                      )}
                    </TableCell>
                    {!readOnly && (
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center gap-0.5">
                        <RowActionIcon
                          icon={Pencil}
                          label={t(
                            "trafficUI.campaigns.settings.trackingNumbers.row.edit",
                          ).replace("{number}", e164)}
                          onClick={() => setEditingId(n.id)}
                        />
                        <RowActionIcon
                          icon={Unlink}
                          label={t(
                            "trafficUI.campaigns.settings.trackingNumbers.row.detach",
                          ).replace("{number}", e164)}
                          tone="destructive"
                          onClick={() => handleDetach(n.id, e164)}
                        />
                      </div>
                    </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </>
      )}
      </Card>

      {/* Edit dialog — opens when a row's pencil icon is clicked. */}
      {!readOnly && (
      <TrackingNumberEditDialog
        numberId={editingId}
        onOpenChange={(open) => !open && setEditingId(null)}
      />
      )}

      {/* Two-mode picker — attach an already-bought number OR buy a fresh
          one from the carrier. Both paths route the result to this campaign
          so it shows up in the table above without a refresh. */}
      {!readOnly && (
        <AttachTrackingNumberDialog
          campaignId={campaignId}
          open={attachOpen}
          onOpenChange={setAttachOpen}
        />
      )}
    </section>
  );
}

/**
 * The tracking number's name, typed straight into the table. Saves when you
 * press Enter or click away; Escape puts the old name back. Looks like plain
 * text until hovered or focused, so the table reads the same as before.
 */
function NumberNameCell({
  className,
  value,
  placeholder,
  ariaLabel,
  onSave,
}: {
  /** Placement in the column's grid; the column block sets the width (CH-183). */
  className?: string;
  value: string;
  placeholder: string;
  ariaLabel: string;
  onSave: (label: string) => Promise<void> | void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  // a name saved elsewhere (the edit dialog, another tab) shows here too
  if (!editing && draft !== value) setDraft(value);

  const commit = () => {
    setEditing(false);
    const next = draft.trim();
    if (next !== value.trim()) void onSave(next);
    else setDraft(value);
  };

  return (
    <Input
      value={draft}
      // A text box's built-in width would set the column's width; size 1 hands
      // that to the names measured by WidestOf, and w-full fills it.
      size={1}
      maxLength={255}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onFocus={() => setEditing(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
          requestAnimationFrame(() => (e.target as HTMLInputElement).blur());
        }
      }}
      className={cn(
        "h-8 w-full min-w-0 border-transparent bg-transparent px-2 text-left text-sm shadow-none hover:border-border focus-visible:border-input dark:bg-transparent",
        className,
      )}
    />
  );
}

/**
 * Every value of a column, invisible and stacked in one grid cell, so the
 * column's block is exactly as wide as its widest value in the real font
 * (the same technique as the Fail Reason column, CH-170). Zero height, so it
 * adds width only.
 */
function WidestOf({ values, className }: { values: string[]; className?: string }) {
  return (
    <>
      {values.map((v) => (
        <span
          key={v}
          aria-hidden
          className={cn("invisible h-0 overflow-hidden whitespace-pre text-sm [grid-area:1/1]", className)}
        >
          {v}
        </span>
      ))}
    </>
  );
}

/**
 * Single icon-button used in the row Actions cell. Mirrors the muted /
 * destructive tone pattern used by the destinations + buyers tables so the
 * row actions look identical across surfaces.
 */
function RowActionIcon({
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
      title={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors",
        tone === "destructive"
          ? "text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  );
}
"use client";

import { useEffect, useMemo, useRef, useState, type ElementType } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CirclePlus, Pencil, Trash2 } from "lucide-react";

import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
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
import { ROUTES } from "@/lib/constants";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { formatNumber, toE164 } from "@/lib/format";
import type { Buyer, Destination } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

type CapField = "concurrencyCap" | "dailyCap" | "monthlyCap";

interface DestinationsTableProps {
  destinations: Destination[];
  onToggle?: (id: string) => void;
  onEdit?: (id: string) => void;
  onDelete?: (id: string) => void;
  /** Called when the + (clone) icon is clicked on a row. */
  onClone?: (id: string) => void;
  onUpdateCap?: (id: string, field: CapField, value: number) => void;
  /** Optional selection lifted to the parent — when provided, renders a
   *  checkbox column. Without it, no checkboxes are shown. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

interface Row {
  destination: Destination;
  buyer: Buyer | undefined;
  live: number;
  hourly: number;
  daily: number;
  monthly: number;
  global: number;
}

/**
 * Live/hourly/daily/monthly/global usage counters, straight off each
 * Destination record (backend-computed — see BACKEND-CONTRACT.md §3.9).
 *
 * This used to derive "live" by counting `ringing`/`in-progress` rows in
 * the shared calls cache filtered by TFN — but that cache is backed by
 * `/api/analytics/calls`, a completed-call log that structurally cannot
 * contain a ringing or in-progress row (the backend's CDR `status` column
 * only ever holds `no_answer` | `completed` | `failed`). So LIVE always
 * read 0, for every destination, regardless of real traffic.
 */
function buildRows(destinations: Destination[], buyers: Buyer[]): Row[] {
  const buyerById = new Map<string, Buyer>();
  for (const b of buyers) buyerById.set(b.id, b);

  return destinations.map<Row>((destination) => ({
    destination,
    buyer: buyerById.get(destination.buyerId),
    live: destination.liveCalls,
    hourly: destination.hourlyCalls,
    daily: destination.dailyCalls,
    monthly: destination.monthlyCalls,
    global: destination.globalCalls,
  }));
}

/** Color a cell based on the fraction used (0..1): red when full, otherwise
 *  the normal colour (CH-386, Sir: "Yellow, Green remove these"). */
function pacingTone(pct: number): string {
  if (pct >= 1) return "text-destructive";
  return "";
}

/** Every text cell in a destination row shares one font, size, weight and
 *  colour — the portal's Inter in Medium at 10.5px, as in the call log. */
const CELL = "text-[10.5px] font-medium tabular-nums text-foreground";

export function DestinationsTable({
  destinations,
  onToggle,
  onEdit,
  onDelete,
  onClone,
  onUpdateCap,
  selectedIds,
  onSelectionChange,
}: DestinationsTableProps) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { can } = usePermissions();
  const router = useRouter();
  const buyers = useBuyersStore((s) => s.buyers);
  const rows = useMemo(
    () => buildRows(destinations, buyers),
    [destinations, buyers],
  );

  const selectable = !!onSelectionChange;
  const visibleIds = destinations.map((d) => d.id);
  const allChecked =
    selectable &&
    visibleIds.length > 0 &&
    visibleIds.every((id) => selectedIds?.has(id));
  const someChecked =
    selectable &&
    !allChecked &&
    visibleIds.some((id) => selectedIds?.has(id));

  const toggleAll = (next: boolean) => {
    if (!onSelectionChange) return;
    const out = new Set(selectedIds ?? []);
    for (const id of visibleIds) {
      if (next) out.add(id);
      else out.delete(id);
    }
    onSelectionChange(out);
  };

  const toggleRow = (id: string, next: boolean) => {
    if (!onSelectionChange) return;
    const out = new Set(selectedIds ?? []);
    if (next) out.add(id);
    else out.delete(id);
    onSelectionChange(out);
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[1000px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {selectable && (
                <TableHead className="w-10 pl-6 pr-0">
                  <Checkbox
                    checked={
                      allChecked ? true : someChecked ? "indeterminate" : false
                    }
                    onCheckedChange={(v) => toggleAll(v === true)}
                    aria-label={t("common.bulk.selectAllAria")}
                  />
                </TableHead>
              )}
              <TableHead className={cn("text-left uppercase tracking-wider text-[11px]", !selectable && "pl-6")}>
                {t("networkUI.destinations.table.name")}
              </TableHead>
              <TableHead className="text-left uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.buyer")}
              </TableHead>
              <TableHead className="uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.destination")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.live")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.hourly")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.daily")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.monthly")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.global")}
              </TableHead>
              <TableHead className="text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.status")}
              </TableHead>
              <TableHead className="pr-6 text-center uppercase tracking-wider text-[11px]">
                {t("networkUI.destinations.table.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell
                  colSpan={selectable ? 11 : 10}
                  className="pl-6 py-10 text-center text-sm text-muted-foreground"
                >
                  {t("networkUI.destinations.table.noResults")}
                </TableCell>
              </TableRow>
            ) : (
              rows.map(({ destination, buyer, live, hourly, daily, monthly, global }) => {
                const livePct =
                  destination.concurrencyCap > 0
                    ? live / destination.concurrencyCap
                    : 0;
                const dailyPct =
                  destination.dailyCap > 0 ? daily / destination.dailyCap : 0;
                const monthlyPct =
                  destination.monthlyCap > 0 ? monthly / destination.monthlyCap : 0;
                // CH-382 (Sir, 29 Oct: "Remove this yellow error when CC is
                // full ... yellow should come when caps are full"): the warning
                // is for a full daily or monthly cap only. A full CC is normal
                // while calls are live and stays shown in red in the Live column.
                const atCap = dailyPct >= 1 || monthlyPct >= 1;

                const checked = !!selectedIds?.has(destination.id);
                return (
                  <TableRow
                    key={destination.id}
                    className="cursor-pointer"
                    data-state={checked ? "selected" : undefined}
                    onClick={() =>
                      router.push(`${ROUTES.destinations}/${destination.id}`)
                    }
                  >
                    {selectable && (
                      <TableCell
                        className="w-10 pl-6 pr-0"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => toggleRow(destination.id, v === true)}
                          aria-label={t("common.bulk.selectRowAria").replace(
                            "{name}",
                            localName(destination.name),
                          )}
                        />
                      </TableCell>
                    )}
                    {/* NAME */}
                    <TableCell className={cn("text-left", CELL, !selectable && "pl-6")}>
                      <Link
                        href={`${ROUTES.destinations}/${destination.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-2 font-medium transition-colors hover:text-accent"
                      >
                        <LocalName name={destination.name} className="truncate max-w-[14rem]" />
                        {atCap && (
                          <AlertTriangle
                            // CH-388 (Sir, 29 Oct: "Make triangle red as well"):
                            // the same red as a full CC / cap figure.
                            className="h-3.5 w-3.5 text-destructive"
                            aria-label={t("networkUI.destinations.table.atCapAria")}
                          />
                        )}
                      </Link>
                    </TableCell>

                    {/* BUYER */}
                    <TableCell className={cn("text-left", CELL)}>
                      {buyer ? (
                        <Link
                          href={`${ROUTES.buyers}/${buyer.id}`}
                          onClick={(e) => e.stopPropagation()}
                          className="transition-colors hover:text-accent"
                        >
                          <LocalName name={buyer.name} />
                        </Link>
                      ) : destination.buyerName ? (
                        <LocalName name={destination.buyerName} />
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* DESTINATION (TFN, E.164 dial-string) */}
                    <TableCell className={CELL}>
                      {toE164(destination.tfn)}
                    </TableCell>

                    {/* LIVE — current concurrent / max (cap is click-to-edit) */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-[3.5rem] items-center justify-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-[10.5px] font-medium tabular-nums",
                          pacingTone(livePct),
                        )}
                      >
                        <span>{live}</span>
                        <span className="opacity-50">/</span>
                        <EditableCap
                          value={destination.concurrencyCap}
                          onCommit={(next) =>
                            onUpdateCap?.(destination.id, "concurrencyCap", next)
                          }
                          ariaLabel={t(
                            "networkUI.destinations.table.editConcurrencyCapAria",
                          ).replace("{name}", localName(destination.name))}
                        />
                      </span>
                    </TableCell>

                    {/* HOURLY — just the count */}
                    <TableCell className="text-center">
                      <span className="inline-flex min-w-[3rem] items-center justify-center rounded border border-border bg-muted/40 px-2 py-1 text-[10.5px] font-medium tabular-nums">
                        {formatNumber(hourly)}
                      </span>
                    </TableCell>

                    {/* DAILY — count / cap (cap is click-to-edit, 0 = ∞) */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-[3rem] items-center justify-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-[10.5px] font-medium tabular-nums",
                          pacingTone(dailyPct),
                        )}
                      >
                        <span>{formatNumber(daily)}</span>
                        <span className="opacity-50">/</span>
                        <EditableCap
                          value={destination.dailyCap}
                          onCommit={(next) =>
                            onUpdateCap?.(destination.id, "dailyCap", next)
                          }
                          ariaLabel={t(
                            "networkUI.destinations.table.editDailyCapAria",
                          ).replace("{name}", localName(destination.name))}
                        />
                      </span>
                    </TableCell>

                    {/* MONTHLY — count / cap (cap is click-to-edit, 0 = ∞) */}
                    <TableCell
                      className="text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span
                        className={cn(
                          "inline-flex min-w-[3rem] items-center justify-center gap-1 rounded border border-border bg-muted/40 px-2 py-1 text-[10.5px] font-medium tabular-nums",
                          pacingTone(monthlyPct),
                        )}
                      >
                        <span>{formatNumber(monthly)}</span>
                        <span className="opacity-50">/</span>
                        <EditableCap
                          value={destination.monthlyCap}
                          onCommit={(next) =>
                            onUpdateCap?.(destination.id, "monthlyCap", next)
                          }
                          ariaLabel={t(
                            "networkUI.destinations.table.editMonthlyCapAria",
                          ).replace("{name}", localName(destination.name))}
                        />
                      </span>
                    </TableCell>

                    {/* GLOBAL — lifetime count */}
                    <TableCell className="text-center">
                      <span className="inline-flex min-w-[3rem] items-center justify-center rounded border border-border bg-muted/40 px-2 py-1 text-[10.5px] font-medium tabular-nums">
                        {formatNumber(global)}
                      </span>
                    </TableCell>

                    {/* STATUS — switch */}
                    <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={destination.enabled}
                        disabled={!can("destinations", "edit")}
                        onCheckedChange={() => onToggle?.(destination.id)}
                        // Green when the destination is active (on); off is unchanged.
                        className="data-[state=checked]:bg-[color:var(--success)]"
                        aria-label={
                          destination.enabled
                            ? t("networkUI.destinations.table.disableAria").replace("{name}", localName(destination.name))
                            : t("networkUI.destinations.table.enableAria").replace("{name}", localName(destination.name))
                        }
                      />
                    </TableCell>

                    {/* ACTIONS — row-level edit / delete */}
                    <TableCell
                      className="pr-6 text-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="inline-flex items-center gap-0.5">
                        <Can area="destinations" action="edit"><RowActionIcon
                          icon={Pencil}
                          label={t(
                            "networkUI.destinations.table.editAria",
                          ).replace("{name}", localName(destination.name))}
                          onClick={() => onEdit?.(destination.id)}
                        /></Can>
                        {onClone && can("destinations", "edit") ? (
                          <RowActionIcon
                            icon={CirclePlus}
                            label={t("x6.destinations.cloneAria").replace("{name}", localName(destination.name))}
                            onClick={() => onClone(destination.id)}
                          />
                        ) : null}
                        <Can area="destinations" action="delete"><RowActionIcon
                          icon={Trash2}
                          label={t(
                            "networkUI.destinations.table.deleteAria",
                          ).replace("{name}", localName(destination.name))}
                          tone="destructive"
                          onClick={() => onDelete?.(destination.id)}
                        /></Can>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/**
 * One icon-button inside the destinations table's Actions cell.
 * Mirrors the muted / destructive tone pattern used by the campaigns +
 * buyers tables so the row actions look identical across surfaces.
 */
function RowActionIcon({
  icon: Icon,
  label,
  onClick,
  tone = "muted",
}: {
  icon: ElementType;
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

/* ─────────────────────────────────────────────────────────────────── */
/*  EditableCap                                                         */
/*  ----------------------------------------------------------------    */
/*  Click-to-edit cap number rendered inline inside the cell chip. The  */
/*  display state shows the cap (or ∞ when 0); clicking swaps in a tiny */
/*  numeric input that commits on Enter/blur and reverts on Escape. The */
/*  parent cell stops row-click propagation so editing never navigates. */
/* ─────────────────────────────────────────────────────────────────── */

function EditableCap({
  value,
  onCommit,
  ariaLabel,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value.toString());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  // Reflect prop changes (e.g. store update from another surface) while idle.
  useEffect(() => {
    if (!editing) setDraft(value.toString());
  }, [value, editing]);

  const commit = () => {
    const parsed = Math.max(0, Math.floor(Number(draft) || 0));
    if (parsed !== value) onCommit(parsed);
    setDraft(parsed.toString());
    setEditing(false);
  };

  const cancel = () => {
    setDraft(value.toString());
    setEditing(false);
  };

  if (editing) {
    return (
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
            cancel();
          }
        }}
        onClick={(e) => e.stopPropagation()}
        aria-label={ariaLabel}
        className="w-14 rounded border border-accent/50 bg-background px-1 py-0.5 text-center text-[10.5px] font-medium tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(value.toString());
        setEditing(true);
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
      className="cursor-text rounded px-1 text-[10.5px] font-medium tabular-nums transition-colors hover:bg-accent/10 hover:ring-1 hover:ring-accent/40"
    >
      {value > 0 ? formatNumber(value) : "∞"}
    </button>
  );
}
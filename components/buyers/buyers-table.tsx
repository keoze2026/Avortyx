"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Pencil, PhoneForwarded, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ALL_BUYER_COLUMNS,
  type BuyerColumnKey,
} from "@/components/buyers/buyers-table-toolbar";
import { Card } from "@/components/ui/card";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
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
import { LocalName, useLocalName } from "@/lib/i18n/local-name";
import { ROUTES } from "@/lib/constants";
/** Calls with thousands separators, as in Sir's Buyers design (3,575). */
const GROUPED = new Intl.NumberFormat("en-US");
export const formatCalls = (n: number) => GROUPED.format(n);
import { useBuyersStore } from "@/lib/store/buyers-store";
import type { Buyer } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

interface BuyersTableProps {
  buyers: Buyer[];
  columns?: Record<BuyerColumnKey, boolean>;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (id: string) => void;
  /** "Add TFN": open the destination dialog with this buyer already picked. */
  onAddTfn?: (id: string) => void;
  /** Optional controlled selection. When omitted, the table owns it internally. */
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
  /** CH-405: the Buyer cap column ("Show buyer cap"). */
  showCap?: boolean;
}

/** The buyer's own daily cap is full: routing sends it nothing more today. */
export function buyerCapHit(b: Buyer): boolean {
  return b.dailyCap > 0 && (b.capUsedToday ?? b.callsToday) >= b.dailyCap;
}

export function BuyersTable({
  buyers,
  columns = ALL_BUYER_COLUMNS,
  onToggle,
  onArchive,
  onEdit,
  onAddTfn,
  selectedIds,
  onSelectionChange,
  showCap = true,
}: BuyersTableProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();
  // Uncontrolled fallback; controlled when `selectedIds` is supplied.
  const [internalSelected, setInternalSelected] = React.useState<Set<string>>(new Set());
  const selected = selectedIds ?? internalSelected;
  const setSelected = (next: Set<string>) => {
    if (onSelectionChange) onSelectionChange(next);
    else setInternalSelected(next);
  };

  const allChecked = buyers.length > 0 && buyers.every((b) => selected.has(b.id));
  const indeterminate = !allChecked && buyers.some((b) => selected.has(b.id));

  const toggleAll = () => {
    if (allChecked || indeterminate) setSelected(new Set());
    else setSelected(new Set(buyers.map((b) => b.id)));
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
        {/* CH-406: fixed column shares, so headers and values are evenly spaced
            whatever the contents (Sir: "fix the header spacing"). */}
        <Table className="min-w-[1000px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-wider [&_th]:text-muted-foreground">
              <TableHead className="w-12 pl-4">
                <Checkbox
                  checked={allChecked || (indeterminate && "indeterminate")}
                  onCheckedChange={toggleAll}
                  aria-label={t("networkUI.buyers.table.selectAllAria")}
                />
              </TableHead>
              <TableHead className="w-[17%] text-left">{t("networkUI.common.name")}</TableHead>
              {columns.live && <TableHead className="w-[11%] !text-center">{t("x405.concurrency")}</TableHead>}
              {showCap && <TableHead className="w-[12%] !text-center">{t("x405.buyerCap")}</TableHead>}
              {columns.hourly && <TableHead className="w-[9%] !text-center">{t("networkUI.common.hourly")}</TableHead>}
              {columns.daily && <TableHead className="w-[9%] !text-center">{t("networkUI.common.daily")}</TableHead>}
              {columns.monthly && <TableHead className="w-[9%] !text-center">{t("networkUI.common.monthly")}</TableHead>}
              {columns.global && <TableHead className="w-[9%] !text-center">{t("networkUI.common.global")}</TableHead>}
              {columns.status && <TableHead className="w-[8%] !text-center">{t("networkUI.common.status")}</TableHead>}
              <TableHead className="w-[11%] pr-4 !text-center">{t("networkUI.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buyers.map((b) => {
              const isActive = b.status === "active";
              const capHit = buyerCapHit(b);
              return (
                <TableRow
                  key={b.id}
                  className={cn(
                    "cursor-pointer border-l-2 border-l-transparent",
                    // Cap reached: an amber edge and tint, as in Sir's design.
                    capHit && "border-l-[color:var(--warning)] bg-[color:var(--warning)]/5",
                  )}
                  onClick={() => router.push(`${ROUTES.buyers}/${b.id}`)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(b.id)}
                      onCheckedChange={() => toggleOne(b.id)}
                      aria-label={t("networkUI.buyers.table.selectOneAria").replace("{name}", b.name)}
                    />
                  </TableCell>
                  <TableCell className="text-left font-semibold text-foreground">
                    <span className="inline-flex items-center gap-2">
                      {/* A fixed slot for the name, so every "Cap hit" badge
                          starts in the same line (CH-406). */}
                      <span className="inline-block min-w-[3.5rem] truncate">
                        <LocalName name={b.name} />
                      </span>
                      {capHit && (
                        <span className="inline-flex items-center gap-1 rounded border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--warning)]">
                          <AlertTriangle className="h-3 w-3" />
                          {t("x405.capHit")}
                        </span>
                      )}
                    </span>
                  </TableCell>
                  {columns.live && (
                    <TableCell className="!text-center text-muted-foreground" onClick={(e) => e.stopPropagation()}>
                      <BuyerCcBox
                        buyerId={b.id}
                        name={b.name}
                        current={b.liveKnown ? b.liveCalls : null}
                        cap={b.concurrencyCap}
                        known={b.concurrencyKnown !== false}
                      />
                    </TableCell>
                  )}
                  {showCap && (
                    <TableCell className="!text-center" onClick={(e) => e.stopPropagation()}>
                      <BuyerCapCell buyer={b} hit={capHit} />
                    </TableCell>
                  )}
                  {columns.hourly && (
                    <TableCell className="!text-center">
                      <CallsCell calls={b.hourlyCalls} />
                    </TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="!text-center">
                      <CallsCell calls={b.callsToday} />
                    </TableCell>
                  )}
                  {columns.monthly && (
                    <TableCell className="!text-center">
                      <CallsCell calls={b.callsMonth} />
                    </TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="!text-center">
                      <CallsCell calls={b.globalCalls} />
                    </TableCell>
                  )}
                  {columns.status && (
                    <TableCell className="!text-center" onClick={(e) => e.stopPropagation()}>
                      <Switch
                        // Green when the buyer is active (taking calls).
                        className="data-[state=checked]:bg-[color:var(--success)] dark:data-[state=checked]:bg-[color:var(--success)]"
                        checked={isActive}
                        disabled={!can("buyers", "edit")}
                        onCheckedChange={() => onToggle(b.id)}
                        aria-label={isActive ? t("networkUI.buyers.table.pauseAria") : t("networkUI.buyers.table.activateAria")}
                      />
                    </TableCell>
                  )}
                  <TableCell className="pr-4 !text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      <Can area="buyers" action="edit"><ActionIcon
                        icon={Pencil}
                        label={t("networkUI.common.edit")}
                        onClick={() => onEdit(b.id)}
                      /></Can>
                      {onAddTfn && can("buyers", "edit") && (
                        <ActionIcon
                          icon={PhoneForwarded}
                          label={t("buyersRow.addTfn")}
                          onClick={() => onAddTfn(b.id)}
                        />
                      )}
                      <Can area="buyers" action="delete"><ActionIcon
                        icon={Trash2}
                        label={t("networkUI.common.remove")}
                        tone="destructive"
                        onClick={() => onArchive(b.id)}
                      /></Can>
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

/** One window, in calls (CH-405, Sir's design: "all figures in calls"). */
function CallsCell({ calls }: { calls: number }) {
  return calls > 0 ? (
    <span className="text-sm font-semibold tabular-nums text-foreground">{formatCalls(calls)}</span>
  ) : (
    <span className="text-muted-foreground/60">—</span>
  );
}

/**
 * The buyer's own daily cap: used / cap with a bar (amber when full), and on
 * hover the breakdown against its TFN caps. "No cap" when it has none.
 */
function BuyerCapCell({ buyer: b, hit }: { buyer: Buyer; hit: boolean }) {
  const { t } = useTranslation();
  if (!(b.dailyCap > 0)) return <span className="text-xs text-muted-foreground/70">{t("x405.noCap")}</span>;
  const used = b.capUsedToday ?? b.callsToday;
  const pct = Math.min(100, (used / b.dailyCap) * 100);
  const n = b.tfnCount ?? 0;
  return (
    <HoverCard openDelay={120} closeDelay={60}>
      <HoverCardTrigger asChild>
        <span className="inline-flex cursor-default flex-col items-center gap-1">
          <span className="text-xs tabular-nums">
            <span className={cn("font-semibold", hit ? "text-[color:var(--warning)]" : "text-foreground")}>
              {formatCalls(used)}
            </span>
            <span className="text-muted-foreground"> / {formatCalls(b.dailyCap)}</span>
          </span>
          <span className="h-1 w-16 overflow-hidden rounded-full bg-muted/60">
            <span
              className={cn("block h-full rounded-full", hit ? "bg-[color:var(--warning)]" : "bg-accent")}
              style={{ width: `${Math.max(3, pct)}%` }}
            />
          </span>
        </span>
      </HoverCardTrigger>
      <HoverCardContent className="w-64 p-3 text-xs" align="start">
        <p className="mb-2 font-semibold">{t("x405.breakdown").replace("{name}", b.name)}</p>
        <dl className="space-y-1">
          {[
            [t("x405.capFunds"), t("x405.nCalls").replace("{n}", formatCalls(b.dailyCap))],
            [t("x405.used"), formatCalls(used)],
            [t("x405.left"), formatCalls(Math.max(0, b.dailyCap - used))],
            [
              t("x405.tfnCaps").replace("{n}", String(n)),
              (b.tfnUncapped ?? 0) > 0
                ? `${formatCalls(b.tfnCapTotal ?? 0)} · ${t("x405.tfnNoCap").replace("{n}", String(b.tfnUncapped))}`
                : formatCalls(b.tfnCapTotal ?? 0),
            ],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3">
              <dt className="text-muted-foreground">{k}</dt>
              <dd className="font-semibold tabular-nums">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 border-t border-border pt-2 text-muted-foreground">
          {t("x405.note").replace("{cap}", formatCalls(b.dailyCap)).replace("{n}", String(n))}
        </p>
      </HoverCardContent>
    </HoverCard>
  );
}

/**
 * Live calls / CC limit for one buyer - the same box as the Live column on
 * Campaigns. Click the limit, type a number, Enter or click away to save,
 * Escape to cancel; 0 = unlimited (∞). Saved on the buyer itself
 * (`max_concurrency`), the limit routing checks before sending it a call,
 * so this replaces Buyer -> Settings -> Concurrency -> Save.
 */
function BuyerCcBox({
  buyerId,
  name,
  current,
  cap,
  known,
}: {
  buyerId: string;
  name: string;
  /** Live calls now; null when the list doesn't send them (only the limit shows). */
  current: number | null;
  cap: number;
  /** False until the list says what the limit is: shows "—", still editable. */
  known: boolean;
}) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const setConcurrency = useBuyersStore((s) => s.setConcurrency);
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
    // Nothing typed: leave the limit as it is.
    if (draft.trim() === "") {
      setEditing(false);
      setDraft(String(cap));
      return;
    }
    const next = Math.max(0, Math.floor(Number(draft) || 0));
    setEditing(false);
    setDraft(String(next));
    if (known && next === cap) return;
    setConcurrency(buyerId, next)
      .then(() =>
        toast.success(
          t("buyersRow.ccSaved")
            .replace("{name}", localName(name))
            .replace("{cap}", next > 0 ? String(next) : t("buyersRow.ccUnlimited")),
        ),
      )
      .catch(() => toast.error(t("buyersRow.ccError")));
  };

  // Buyer full (live calls at its CC limit, e.g. 10 / 10): solid blue, as on Campaigns.
  const full = known && current !== null && cap > 0 && current >= cap;

  return (
    <span
      className={cn(
        "inline-flex h-7 min-w-[4.5rem] items-center justify-center gap-1 rounded-md border px-2 tabular-nums transition-colors",
        full ? "border-accent bg-accent font-semibold text-white" : "border-border bg-secondary/30",
      )}
      title={full ? t("buyersRow.ccFull") : undefined}
    >
      {current !== null && (
        <>
          <span>{current}</span>
          <span className={full ? "text-white/80" : "text-muted-foreground"}>/</span>
        </>
      )}
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
          aria-label={t("buyersRow.ccInput")}
          className="w-14 rounded border border-accent/50 bg-background px-1 py-0.5 text-center tabular-nums focus:outline-none focus:ring-1 focus:ring-accent"
        />
      ) : (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setDraft(known ? String(cap) : "");
            setEditing(true);
          }}
          title={t("buyersRow.ccEdit")}
          aria-label={t("buyersRow.ccEdit")}
          className={cn(
            "cursor-text rounded px-1 tabular-nums transition-colors",
            full ? "hover:bg-white/15 hover:ring-1 hover:ring-white/50" : "hover:bg-accent/10 hover:ring-1 hover:ring-accent/40",
          )}
        >
          {!known ? "—" : cap > 0 ? cap : "∞"}
        </button>
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
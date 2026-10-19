"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, PhoneForwarded, Trash2 } from "lucide-react";
import { toast } from "sonner";

import {
  ALL_BUYER_COLUMNS,
  type BuyerColumnKey,
} from "@/components/buyers/buyers-table-toolbar";
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
import { formatCurrency } from "@/lib/format";
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
        <Table className="min-w-[900px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-10 pl-4">
                <Checkbox
                  checked={allChecked || (indeterminate && "indeterminate")}
                  onCheckedChange={toggleAll}
                  aria-label={t("networkUI.buyers.table.selectAllAria")}
                />
              </TableHead>
              <TableHead className="text-left">{t("networkUI.common.name")}</TableHead>
              {columns.live && <TableHead className="!text-center">{t("buyersRow.live")}</TableHead>}
              {columns.hourly && <TableHead className="!text-center">{t("networkUI.common.hourly")}</TableHead>}
              {columns.daily && <TableHead className="!text-center">{t("networkUI.common.daily")}</TableHead>}
              {columns.monthly && <TableHead className="!text-center">{t("networkUI.common.monthly")}</TableHead>}
              {columns.global && <TableHead className="!text-center">{t("networkUI.common.global")}</TableHead>}
              {columns.status && <TableHead>{t("networkUI.common.status")}</TableHead>}
              <TableHead className="pr-4">{t("networkUI.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {buyers.map((b) => {
              const isActive = b.status === "active";
              return (
                <TableRow
                  key={b.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`${ROUTES.buyers}/${b.id}`)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(b.id)}
                      onCheckedChange={() => toggleOne(b.id)}
                      aria-label={t("networkUI.buyers.table.selectOneAria").replace("{name}", b.name)}
                    />
                  </TableCell>
                  <TableCell className="text-left font-medium text-foreground">
                    {b.name}
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
                  {columns.hourly && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      <WindowCell spend={b.hourlySpend} calls={b.hourlyCalls} />
                    </TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      <WindowCell spend={b.spendToday} calls={b.callsToday} />
                    </TableCell>
                  )}
                  {columns.monthly && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      <WindowCell spend={b.spendMonth} calls={b.callsMonth} />
                    </TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      <WindowCell spend={b.lifetimeSpend} calls={b.globalCalls} />
                    </TableCell>
                  )}
                  {columns.status && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
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
                  <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
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

/** One spend window: the spend, with the number of calls under it. */
function WindowCell({ spend, calls }: { spend: number; calls: number }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex flex-col items-center leading-tight">
      <span>{formatCurrency(spend, true)}</span>
      <span className="text-[10px] text-muted-foreground/80">
        {t(calls === 1 ? "buyersRow.callsOne" : "buyersRow.callsMany").replace("{n}", calls.toLocaleString("en-US"))}
      </span>
    </span>
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
            .replace("{name}", name)
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
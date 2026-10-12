"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Undo2 } from "lucide-react";

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
import type { Buyer } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BuyersTableProps {
  buyers: Buyer[];
  columns?: Record<BuyerColumnKey, boolean>;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
  onEdit: (id: string) => void;
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
  selectedIds,
  onSelectionChange,
}: BuyersTableProps) {
  const { t } = useTranslation();
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
              // Hourly spend estimated from today's spend divided by elapsed hours.
              const hourly = b.spendToday / Math.max(1, new Date().getHours() || 1);
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
                  {columns.hourly && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      {formatCurrency(hourly, true)}
                    </TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      {formatCurrency(b.spendToday, true)}
                    </TableCell>
                  )}
                  {columns.monthly && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      {formatCurrency(b.spendMonth, true)}
                    </TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="!text-center tabular-nums text-muted-foreground">
                      {formatCurrency(b.lifetimeSpend, true)}
                    </TableCell>
                  )}
                  {columns.status && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => onToggle(b.id)}
                        aria-label={isActive ? t("networkUI.buyers.table.pauseAria") : t("networkUI.buyers.table.activateAria")}
                      />
                    </TableCell>
                  )}
                  <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      <ActionIcon
                        icon={Pencil}
                        label={t("networkUI.common.edit")}
                        onClick={() => onEdit(b.id)}
                      />
                      <ActionIcon icon={Undo2} label={t("networkUI.common.revert")} />
                      <ActionIcon
                        icon={Trash2}
                        label={t("networkUI.common.remove")}
                        tone="destructive"
                        onClick={() => onArchive(b.id)}
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

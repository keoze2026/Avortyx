"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, Undo2 } from "lucide-react";

import {
  ALL_PUBLISHER_COLUMNS,
  type PublisherColumnKey,
} from "@/components/publishers/publishers-table-toolbar";
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
import type { Publisher } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PublishersTableProps {
  publishers: Publisher[];
  columns?: Record<PublisherColumnKey, boolean>;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
}

export function PublishersTable({
  publishers,
  columns = ALL_PUBLISHER_COLUMNS,
  onToggle,
  onArchive,
}: PublishersTableProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  const allChecked = publishers.length > 0 && selected.size === publishers.length;
  const indeterminate = selected.size > 0 && !allChecked;

  const toggleAll = () => {
    if (allChecked || indeterminate) setSelected(new Set());
    else setSelected(new Set(publishers.map((p) => p.id)));
  };
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
                  aria-label={t("networkUI.publishers.table.selectAllAria")}
                />
              </TableHead>
              <TableHead className="text-left">{t("networkUI.common.name")}</TableHead>
              {columns.hourly && <TableHead className="!text-left">{t("networkUI.common.hourly")}</TableHead>}
              {columns.daily && <TableHead className="!text-left">{t("networkUI.common.daily")}</TableHead>}
              {columns.monthly && <TableHead className="!text-left">{t("networkUI.common.monthly")}</TableHead>}
              {columns.global && <TableHead className="!text-left">{t("networkUI.common.global")}</TableHead>}
              {columns.status && <TableHead>{t("networkUI.common.status")}</TableHead>}
              <TableHead className="pr-4">{t("networkUI.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publishers.map((p) => {
              const isActive = p.status === "active";
              // Hourly revenue estimated from today's revenue / elapsed hours.
              const hourly = p.revenueToday / Math.max(1, new Date().getHours() || 1);
              return (
                <TableRow
                  key={p.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`${ROUTES.publishers}/${p.id}`)}
                >
                  <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => toggleOne(p.id)}
                      aria-label={t("networkUI.publishers.table.selectOneAria").replace("{name}", p.name)}
                    />
                  </TableCell>
                  <TableCell className="text-left font-medium text-foreground">
                    {p.name}
                  </TableCell>
                  {columns.hourly && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {formatCurrency(hourly, true)}
                    </TableCell>
                  )}
                  {columns.daily && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {formatCurrency(p.revenueToday, true)}
                    </TableCell>
                  )}
                  {columns.monthly && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {formatCurrency(p.revenueMonth, true)}
                    </TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {formatCurrency(p.lifetimeRevenue, true)}
                    </TableCell>
                  )}
                  {columns.status && (
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Switch
                        checked={isActive}
                        onCheckedChange={() => onToggle(p.id)}
                        aria-label={isActive ? t("networkUI.publishers.table.pauseAria") : t("networkUI.publishers.table.activateAria")}
                      />
                    </TableCell>
                  )}
                  <TableCell className="pr-4" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      {/* Same destination the row itself navigates to on
                          click — this icon is an explicit affordance for
                          operators who don't realize the row is clickable. */}
                      <ActionIcon
                        icon={Pencil}
                        label={t("networkUI.common.edit")}
                        onClick={() => router.push(`${ROUTES.publishers}/${p.id}`)}
                      />
                      <ActionIcon icon={Undo2} label={t("networkUI.common.revert")} />
                      <ActionIcon
                        icon={Trash2}
                        label={t("networkUI.common.remove")}
                        tone="destructive"
                        onClick={() => onArchive(p.id)}
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

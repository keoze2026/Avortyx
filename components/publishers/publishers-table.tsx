"use client";

/**
 * CH-423 (Sir's design): the Publishers table counts calls, not money.
 *
 * Every figure is the server's (publishers/usage.py), in payable calls - the
 * calls Reports counts as Paid. Hourly is the last 60 minutes, Daily is since
 * midnight Eastern with how many of the calls it sent were answered. When the
 * server does not send the counts yet, the cells show "—"; nothing is
 * estimated here (the old Hourly column was today's revenue / hours gone).
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import {
  ALL_PUBLISHER_COLUMNS,
  type PublisherColumnKey,
} from "@/components/publishers/publishers-table-toolbar";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatNumber } from "@/lib/format";
import type { Publisher } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/my-permissions";

interface PublishersTableProps {
  publishers: Publisher[];
  columns?: Record<PublisherColumnKey, boolean>;
  /** The biggest Daily count on the page, so the bars compare publishers. */
  maxDaily: number;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
}

/** Below this share of answered calls the Daily figure turns amber. */
const LOW_CONNECT = 50;

export function PublishersTable({
  publishers,
  columns = ALL_PUBLISHER_COLUMNS,
  maxDaily,
  onToggle,
  onArchive,
}: PublishersTableProps) {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { can } = usePermissions();
  const router = useRouter();
  const canEdit = can("traffic-sources", "edit");
  const canDelete = can("traffic-sources", "delete");
  const open = (id: string) => router.push(`${ROUTES.publishers}/${id}`);

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[960px] table-fixed">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[22%] !pl-16 text-left">{t("networkUI.common.name")}</TableHead>
              {columns.hourly && <TableHead className="w-[13%] !text-left">{t("networkUI.common.hourly")}</TableHead>}
              {columns.daily && <TableHead className="w-[13%] !pl-14 !text-left">{t("networkUI.common.daily")}</TableHead>}
              {columns.monthly && <TableHead className="w-[13%] !text-left">{t("networkUI.common.monthly")}</TableHead>}
              {columns.global && <TableHead className="w-[13%] !text-left">{t("networkUI.common.global")}</TableHead>}
              {columns.status && <TableHead className="w-[13%] !text-left">{t("networkUI.common.status")}</TableHead>}
              <TableHead className="w-[13%] pr-4 !text-right">{t("networkUI.common.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {publishers.map((p) => {
              const isActive = p.status === "active";
              const u = p.usage;
              return (
                <TableRow key={p.id} className="cursor-pointer" onClick={() => open(p.id)}>
                  <TableCell className="!pl-16 text-left">
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                          isActive ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground",
                        )}
                        aria-hidden
                      >
                        {initials(localName(p.name))}
                      </span>
                      <div className="min-w-0">
                        <div className="truncate font-medium text-foreground">
                          <LocalName name={p.name} />
                        </div>
                        {u && <LinkedLine usage={u} />}
                      </div>
                    </div>
                  </TableCell>

                  {columns.hourly && (
                    <TableCell className="!text-left">
                      {u ? (
                        <span className="inline-flex items-center gap-1.5 tabular-nums">
                          <span
                            className={cn(
                              "h-2 w-2 rounded-full",
                              u.callsHour > 0 ? "bg-emerald-500" : "bg-muted-foreground/30",
                            )}
                            aria-hidden
                          />
                          <span className={u.callsHour > 0 ? "text-foreground" : "text-muted-foreground"}>
                            {formatNumber(u.callsHour)}
                          </span>
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </TableCell>
                  )}

                  {columns.daily && (
                    <TableCell className="!pl-14 !text-left">
                      {u ? <DailyCell usage={u} max={maxDaily} /> : <Dash />}
                    </TableCell>
                  )}

                  {columns.monthly && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {u ? formatNumber(u.payableMonth) : <Dash />}
                    </TableCell>
                  )}
                  {columns.global && (
                    <TableCell className="!text-left tabular-nums text-muted-foreground">
                      {u ? formatNumber(u.payableGlobal) : <Dash />}
                    </TableCell>
                  )}

                  {columns.status && (
                    <TableCell className="!text-left" onClick={(e) => e.stopPropagation()}>
                      <span className="inline-flex items-center gap-2">
                        <Switch
                          checked={isActive}
                          disabled={!canEdit || p.status === "pending"}
                          onCheckedChange={() => onToggle(p.id)}
                          aria-label={
                            isActive
                              ? t("networkUI.publishers.table.pauseAria")
                              : t("networkUI.publishers.table.activateAria")
                          }
                        />
                        {!isActive && (
                          <span className="text-xs text-[color:var(--warning)]">
                            {p.status === "pending" ? t("x423.pending") : t("x423.paused")}
                          </span>
                        )}
                      </span>
                    </TableCell>
                  )}

                  <TableCell className="pr-4 !text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        aria-label={t("networkUI.common.edit")}
                        title={t("networkUI.common.edit")}
                        onClick={() => open(p.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            aria-label={t("x423.more")}
                            title={t("x423.more")}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => open(p.id)}>
                            <Pencil className="h-4 w-4" /> {t("x423.open")}
                          </DropdownMenuItem>
                          {canDelete && (
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => onArchive(p.id)}
                            >
                              <Trash2 className="h-4 w-4" /> {t("networkUI.common.remove")}
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
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

function Dash() {
  return <span className="text-muted-foreground">—</span>;
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  const two = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
  return two.toUpperCase();
}

/** Campaign chips and the TFN count, or "No campaign linked". */
function LinkedLine({ usage }: { usage: NonNullable<Publisher["usage"]> }) {
  const { t } = useTranslation();
  const localName = useLocalName();
  if (!usage.campaigns.length) {
    return <div className="mt-0.5 text-[11px] text-muted-foreground">{t("x423.noCampaign")}</div>;
  }
  const shown = usage.campaigns.slice(0, 2);
  const rest = usage.campaigns.length - shown.length;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
      {shown.map((c) => (
        <span key={c.id} className="max-w-[160px] truncate rounded border border-border bg-muted/40 px-1.5 py-px text-foreground/80">
          {localName(c.name)}
        </span>
      ))}
      {rest > 0 && (
        <span title={usage.campaigns.slice(2).map((c) => localName(c.name)).join(", ")}>+{rest}</span>
      )}
      <span>· {(usage.tfnCount === 1 ? t("x423.oneTfn") : t("x423.nTfns")).replace("{n}", formatNumber(usage.tfnCount))}</span>
    </div>
  );
}

/** Payable calls today as a bar, and the share of sent calls answered. */
function DailyCell({ usage, max }: { usage: NonNullable<Publisher["usage"]>; max: number }) {
  const { t } = useTranslation();
  const pct = usage.sentToday > 0 ? Math.round((usage.answeredToday / usage.sentToday) * 100) : null;
  const low = pct !== null && pct < LOW_CONNECT;
  const width = max > 0 ? Math.max(usage.payableToday > 0 ? 4 : 0, (usage.payableToday / max) * 100) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-2.5">
        <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted/60">
          <span
            className={cn("block h-full rounded-full", low ? "bg-[color:var(--warning)]" : "bg-accent")}
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="tabular-nums font-medium text-foreground">{formatNumber(usage.payableToday)}</span>
      </div>
      {pct !== null && (
        <span
          className={cn("text-[11px] leading-none tabular-nums", low ? "text-[color:var(--warning)]" : "text-muted-foreground")}
          title={t("x423.connectedHint")
            .replace("{a}", formatNumber(usage.answeredToday))
            .replace("{s}", formatNumber(usage.sentToday))}
        >
          {t("x423.connected").replace("{n}", String(pct))}
        </span>
      )}
    </div>
  );
}

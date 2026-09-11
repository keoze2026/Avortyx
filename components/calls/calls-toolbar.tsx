"use client";

import { Columns, Download, Search, X } from "lucide-react";

import { ExportMenu } from "@/components/shared/export-menu";
import { useTranslation } from "@/hooks/use-translation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { DateRange } from "@/lib/analytics";
import type { ExportFormat } from "@/lib/export";
import { formatNumber } from "@/lib/format";
import type { CallStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const RANGE_KEYS: Array<{ id: DateRange; key: string }> = [
  { id: "today", key: "toolsUI.callLogs.toolbar.today" },
  { id: "7d", key: "toolsUI.callLogs.toolbar.sevenDays" },
  { id: "14d", key: "toolsUI.callLogs.toolbar.fourteenDays" },
  { id: "30d", key: "toolsUI.callLogs.toolbar.thirtyDays" },
];

const STATUS_OPTS: Array<{ id: CallStatus; labelKey: string; tone: string }> = [
  { id: "completed", labelKey: "toolsUI.callLogs.toolbar.statusWon", tone: "text-[color:var(--success)]" },
  { id: "in-progress", labelKey: "toolsUI.callLogs.toolbar.statusLive", tone: "text-accent" },
  { id: "missed", labelKey: "toolsUI.callLogs.toolbar.statusMissed", tone: "text-[color:var(--warning)]" },
  { id: "rejected", labelKey: "toolsUI.callLogs.toolbar.statusRejected", tone: "text-destructive" },
  { id: "failed", labelKey: "toolsUI.callLogs.toolbar.statusFailed", tone: "text-destructive" },
];

export interface ColumnKey {
  id: string;
  label: string;
}

/** Static column ids — labels are looked up at render time via useTranslation. */
export const ALL_COLUMNS: ColumnKey[] = [
  { id: "started", label: "Started" },
  { id: "caller", label: "Caller" },
  { id: "campaign", label: "Campaign" },
  { id: "publisher", label: "Publisher" },
  { id: "buyer", label: "Buyer" },
  { id: "geo", label: "Geo" },
  { id: "status", label: "Status" },
  { id: "duration", label: "Duration" },
  { id: "payout", label: "Payout" },
];

const COLUMN_LABEL_KEYS: Record<string, string> = {
  started: "toolsUI.callLogs.columns.started",
  caller: "toolsUI.callLogs.columns.caller",
  campaign: "toolsUI.callLogs.columns.campaign",
  publisher: "toolsUI.callLogs.columns.publisher",
  buyer: "toolsUI.callLogs.columns.buyer",
  geo: "toolsUI.callLogs.columns.geo",
  status: "toolsUI.callLogs.columns.status",
  duration: "toolsUI.callLogs.columns.duration",
  payout: "toolsUI.callLogs.columns.payout",
};

interface Props {
  query: string;
  onQuery: (q: string) => void;
  range: DateRange;
  onRange: (r: DateRange) => void;
  statuses: Set<CallStatus>;
  onToggleStatus: (s: CallStatus) => void;
  campaignFilter: string;
  onCampaign: (id: string) => void;
  campaigns: Array<{ id: string; name: string }>;
  visibleColumns: Set<string>;
  onToggleColumn: (id: string) => void;
  onExport: (format: ExportFormat) => void;
  count: number;
  total: number;
}

export function CallsToolbar({
  query,
  onQuery,
  range,
  onRange,
  statuses,
  onToggleStatus,
  campaignFilter,
  onCampaign,
  campaigns,
  visibleColumns,
  onToggleColumn,
  onExport,
  count,
  total,
}: Props) {
  const { t } = useTranslation();
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("toolsUI.callLogs.toolbar.searchPlaceholder")}
            className="h-9 w-72 pl-8"
          />
          {query && (
            <button
              type="button"
              onClick={() => onQuery("")}
              aria-label={t("toolsUI.callLogs.toolbar.clearAria")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Date range pills */}
        <div className="flex gap-1 rounded-md border border-border bg-secondary/40 p-0.5">
          {RANGE_KEYS.map((r) => {
            const active = r.id === range;
            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onRange(r.id)}
                className={cn(
                  "h-7 rounded px-2 text-xs font-mono transition-colors",
                  active
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(r.key)}
              </button>
            );
          })}
        </div>

        {/* Campaign select */}
        <Select value={campaignFilter} onValueChange={onCampaign}>
          <SelectTrigger size="sm" className="h-9 w-52">
            <SelectValue placeholder={t("toolsUI.callLogs.toolbar.allCampaigns")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("toolsUI.callLogs.toolbar.allCampaigns")}</SelectItem>
            {campaigns.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Status multi-toggle */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              {t("toolsUI.callLogs.toolbar.status")}
              <span className="ml-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-accent/15 px-1.5 text-[10px] font-mono text-accent">
                {statuses.size}
              </span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            <DropdownMenuLabel>{t("toolsUI.callLogs.toolbar.filterByStatus")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {STATUS_OPTS.map((s) => (
              <DropdownMenuCheckboxItem
                key={s.id}
                checked={statuses.has(s.id)}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleStatus(s.id);
                }}
              >
                <span className={cn("font-mono text-xs", s.tone)}>●</span>
                {t(s.labelKey)}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Column visibility */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-9 gap-1.5">
              <Columns className="h-3.5 w-3.5" />
              {t("toolsUI.callLogs.toolbar.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>{t("toolsUI.callLogs.toolbar.visibleColumns")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {ALL_COLUMNS.map((c) => (
              <DropdownMenuCheckboxItem
                key={c.id}
                checked={visibleColumns.has(c.id)}
                onSelect={(e) => {
                  e.preventDefault();
                  onToggleColumn(c.id);
                }}
              >
                {t(COLUMN_LABEL_KEYS[c.id] ?? "")}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <span className="ml-auto text-[11px] font-mono text-muted-foreground">
          {t("toolsUI.callLogs.toolbar.countOfTotal").replace("{count}", formatNumber(count)).replace("{total}", formatNumber(total))}
        </span>

        <ExportMenu onExport={onExport}>
          <Button variant="outline" size="sm" className="h-9 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t("toolsUI.callLogs.toolbar.export")}
          </Button>
        </ExportMenu>
      </div>
    </div>
  );
}

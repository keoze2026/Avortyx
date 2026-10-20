"use client";

import {
  ArrowUpDown,
  ChevronDown,
  Filter,
  RefreshCw,
  Search,
  Settings,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

export type CampaignSortKey = "name" | "callsToday" | "revenueToday" | "recent";

export type CampaignStatusFilter = "all" | "active" | "paused" | "draft" | "archived";

export type CampaignColumnKey =
  | "progress"
  | "access"
  | "live"
  | "hourly"
  | "daily"
  | "monthly"
  | "global"
  | "status";

export const CAMPAIGN_COLUMNS: Array<{ id: CampaignColumnKey; labelKey: string }> = [
  { id: "progress", labelKey: "trafficUI.campaigns.columns.progress" },
  { id: "access", labelKey: "trafficUI.campaigns.columns.access" },
  { id: "live", labelKey: "trafficUI.campaigns.columns.live" },
  { id: "hourly", labelKey: "trafficUI.campaigns.columns.hourly" },
  { id: "daily", labelKey: "trafficUI.campaigns.columns.daily" },
  { id: "monthly", labelKey: "trafficUI.campaigns.columns.monthly" },
  { id: "global", labelKey: "trafficUI.campaigns.columns.global" },
  { id: "status", labelKey: "trafficUI.campaigns.columns.status" },
];

export const ALL_CAMPAIGN_COLUMNS: Record<CampaignColumnKey, boolean> =
  CAMPAIGN_COLUMNS.reduce(
    (acc, c) => ({ ...acc, [c.id]: true }),
    {} as Record<CampaignColumnKey, boolean>,
  );

const SORT_OPTIONS: Array<{ id: CampaignSortKey; labelKey: string }> = [
  { id: "recent", labelKey: "trafficUI.campaigns.toolbar.sort.recent" },
  { id: "name", labelKey: "trafficUI.campaigns.toolbar.sort.name" },
  { id: "callsToday", labelKey: "trafficUI.campaigns.toolbar.sort.callsToday" },
  { id: "revenueToday", labelKey: "trafficUI.campaigns.toolbar.sort.revenueToday" },
];

const STATUS_OPTIONS: Array<{ id: CampaignStatusFilter; labelKey: string }> = [
  { id: "all", labelKey: "trafficUI.campaigns.toolbar.statusFilter.all" },
  { id: "active", labelKey: "trafficUI.campaigns.toolbar.statusFilter.active" },
  { id: "paused", labelKey: "trafficUI.campaigns.toolbar.statusFilter.paused" },
  { id: "draft", labelKey: "trafficUI.campaigns.toolbar.statusFilter.draft" },
  { id: "archived", labelKey: "trafficUI.campaigns.toolbar.statusFilter.archived" },
];

interface CampaignsToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  sort: CampaignSortKey;
  onSort: (s: CampaignSortKey) => void;
  status: CampaignStatusFilter;
  onStatus: (s: CampaignStatusFilter) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  columns: Record<CampaignColumnKey, boolean>;
  onColumns: (cols: Record<CampaignColumnKey, boolean>) => void;
  onRefresh: () => void;
}

export function CampaignsToolbar({
  query,
  onQuery,
  sort,
  onSort,
  status,
  onStatus,
  pageSize,
  onPageSize,
  columns,
  onColumns,
  onRefresh,
}: CampaignsToolbarProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap items-center justify-end gap-1">
      {/* Search */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative h-8 w-8 text-muted-foreground hover:text-foreground",
              query && "text-foreground",
            )}
            aria-label={t("trafficUI.common.search")}
          >
            <Search className="h-4 w-4" />
            {query && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <Label htmlFor="campaign-search" className="text-xs text-muted-foreground">
            {t("trafficUI.campaigns.toolbar.searchLabel")}
          </Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="campaign-search"
              autoFocus
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("trafficUI.campaigns.toolbar.searchPlaceholder")}
              className="h-9 pl-7"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery("")}
                aria-label={t("trafficUI.common.clearSearch")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Sort */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t("trafficUI.common.sortBy")}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("trafficUI.common.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {SORT_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={() => onSort(o.id)}
              className={cn(sort === o.id && "text-accent")}
            >
              {t(o.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter (status) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "relative h-8 w-8 text-muted-foreground hover:text-foreground",
              status !== "all" && "text-foreground",
            )}
            aria-label={t("trafficUI.common.filter")}
          >
            <Filter className="h-4 w-4" />
            {status !== "all" && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("trafficUI.campaigns.toolbar.filterByStatus")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {STATUS_OPTIONS.map((o) => (
            <DropdownMenuItem
              key={o.id}
              onSelect={() => onStatus(o.id)}
              className={cn(status === o.id && "text-accent")}
            >
              {t(o.labelKey)}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Refresh */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-foreground"
        aria-label={t("trafficUI.common.refresh")}
        onClick={onRefresh}
      >
        <RefreshCw className="h-4 w-4" />
      </Button>

      {/* Columns (settings) */}
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label={t("trafficUI.common.columnSettings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t("trafficUI.common.columns")}</span>
            <button
              type="button"
              onClick={() => onColumns(ALL_CAMPAIGN_COLUMNS)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("trafficUI.common.showAll")}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {CAMPAIGN_COLUMNS.map((col) => {
              const id = `camp-col-${col.id}`;
              return (
                <Label
                  key={col.id}
                  htmlFor={id}
                  className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm font-normal hover:bg-secondary/50"
                >
                  <Checkbox
                    id={id}
                    checked={columns[col.id]}
                    onCheckedChange={() =>
                      onColumns({ ...columns, [col.id]: !columns[col.id] })
                    }
                  />
                  <span>{t(col.labelKey)}</span>
                </Label>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Page size */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="ml-2 h-8 gap-1.5 px-3">
            {t("trafficUI.common.onPage")} {pageSize}
            <ChevronDown className="h-3 w-3 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {[10, 25, 50, 100].map((n) => (
            <DropdownMenuCheckboxItem
              key={n}
              checked={pageSize === n}
              onCheckedChange={() => onPageSize(n)}
            >
              {n}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

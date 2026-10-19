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

export type PublisherTableSortKey = "revenue" | "calls" | "conv" | "recent";
export type PublisherTableStatusFilter = "all" | "active" | "paused" | "pending";

export type PublisherColumnKey =
  | "hourly"
  | "daily"
  | "monthly"
  | "global"
  | "status";

export const PUBLISHER_COLUMNS: Array<{ id: PublisherColumnKey; labelKey: string }> = [
  { id: "hourly", labelKey: "networkUI.common.hourly" },
  { id: "daily", labelKey: "networkUI.common.daily" },
  { id: "monthly", labelKey: "networkUI.common.monthly" },
  { id: "global", labelKey: "networkUI.common.global" },
  { id: "status", labelKey: "networkUI.common.status" },
];

export const ALL_PUBLISHER_COLUMNS: Record<PublisherColumnKey, boolean> =
  PUBLISHER_COLUMNS.reduce(
    (acc, c) => ({ ...acc, [c.id]: true }),
    {} as Record<PublisherColumnKey, boolean>,
  );

const SORT_OPTIONS: Array<{ id: PublisherTableSortKey; labelKey: string }> = [
  { id: "recent", labelKey: "networkUI.publishers.toolbar.sortOptions.recent" },
  { id: "revenue", labelKey: "networkUI.publishers.toolbar.sortOptions.revenue" },
  { id: "calls", labelKey: "networkUI.publishers.toolbar.sortOptions.calls" },
  { id: "conv", labelKey: "networkUI.publishers.toolbar.sortOptions.conv" },
];

const STATUS_OPTIONS: Array<{ id: PublisherTableStatusFilter; labelKey: string }> = [
  { id: "all", labelKey: "networkUI.publishers.toolbar.statusOptions.all" },
  { id: "active", labelKey: "networkUI.publishers.toolbar.statusOptions.active" },
  { id: "paused", labelKey: "networkUI.publishers.toolbar.statusOptions.paused" },
  { id: "pending", labelKey: "networkUI.publishers.toolbar.statusOptions.pending" },
];

interface PublishersToolbarProps {
  query: string;
  onQuery: (q: string) => void;
  sort: PublisherTableSortKey;
  onSort: (s: PublisherTableSortKey) => void;
  status: PublisherTableStatusFilter;
  onStatus: (s: PublisherTableStatusFilter) => void;
  pageSize: number;
  onPageSize: (n: number) => void;
  columns: Record<PublisherColumnKey, boolean>;
  onColumns: (cols: Record<PublisherColumnKey, boolean>) => void;
  onRefresh: () => void;
  /** Leave out to hide the Create button (the role has no Edit tick). */
  onCreate?: () => void;
}

export function PublishersTableToolbar({
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
  onCreate,
}: PublishersToolbarProps) {
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
            aria-label={t("networkUI.common.search")}
          >
            <Search className="h-4 w-4" />
            {query && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-3">
          <Label htmlFor="publisher-search" className="text-xs text-muted-foreground">
            {t("networkUI.publishers.toolbar.searchLabel")}
          </Label>
          <div className="relative mt-1.5">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="publisher-search"
              autoFocus
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder={t("networkUI.publishers.toolbar.searchPlaceholder")}
              className="h-9 pl-7"
            />
            {query && (
              <button
                type="button"
                onClick={() => onQuery("")}
                aria-label={t("networkUI.common.clearSearch")}
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
            aria-label={t("networkUI.common.sort")}
          >
            <ArrowUpDown className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("networkUI.common.sortBy")}</DropdownMenuLabel>
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
            aria-label={t("networkUI.common.filter")}
          >
            <Filter className="h-4 w-4" />
            {status !== "all" && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel>{t("networkUI.common.filterByStatus")}</DropdownMenuLabel>
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
        aria-label={t("networkUI.common.refresh")}
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
            aria-label={t("networkUI.common.columnSettings")}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-56 p-0">
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <span className="text-sm font-semibold">{t("networkUI.common.columns")}</span>
            <button
              type="button"
              onClick={() => onColumns(ALL_PUBLISHER_COLUMNS)}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("networkUI.common.showAll")}
            </button>
          </div>
          <div className="max-h-72 overflow-y-auto px-2 py-2">
            {PUBLISHER_COLUMNS.map((col) => {
              const id = `publisher-col-${col.id}`;
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
            {t("networkUI.common.onPage").replace("{count}", String(pageSize))}
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

      {/* Create */}
      {onCreate && (
        <Button size="sm" className="ml-1 h-8 px-4" onClick={onCreate}>
          {t("networkUI.common.create")}
        </Button>
      )}
    </div>
  );
}

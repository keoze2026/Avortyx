"use client";

import * as React from "react";
import {
  ArrowUpDown,
  Check,
  Filter,
  RotateCw,
  Search,
  Settings,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;
export type PageSize = (typeof PAGE_SIZE_OPTIONS)[number];

export interface SortOption {
  id: string;
  label: string;
}

export interface FilterOption {
  id: string;
  label: string;
}

export interface ColumnOption {
  id: string;
  label: string;
  /** When true, the column can't be hidden (e.g. row actions). */
  required?: boolean;
}

interface Props {
  /** Current search text. Reflected by the toolbar's inline search input. */
  query: string;
  onQuery: (q: string) => void;
  pageSize: PageSize;
  onPageSize: (n: PageSize) => void;
  /** Primary CTA on the far right (e.g. "Create", "Block Number"). */
  ctaLabel: string;
  onCta: () => void;
  /** Optional handler — defaults to a "Refreshed" toast. */
  onRefresh?: () => void;
  /**
   * Sort: render a popover with single-select options.
   * If omitted, the sort button toasts a coming-soon notice.
   */
  sort?: {
    options: SortOption[];
    value: string;
    onChange: (id: string) => void;
  };
  /**
   * Filter: render a popover with multi-select options.
   * If omitted, the filter button toasts a coming-soon notice.
   */
  filter?: {
    label?: string;
    options: FilterOption[];
    value: Set<string>;
    onChange: (next: Set<string>) => void;
  };
  /**
   * Column visibility: render a popover with checkbox-per-column. If omitted
   * the gear button toasts a coming-soon notice. Required columns can't be
   * unchecked and the "Show all" link restores the default set.
   */
  columns?: {
    options: ColumnOption[];
    value: Set<string>;
    onChange: (next: Set<string>) => void;
  };
}

/** Shared list-page toolbar — search, sort, filter, refresh, column-settings,
 *  page size, and a primary CTA. Used by the Suppression list, Track Numbers,
 *  and any future list surface that fits the same shape. */
export function TableToolbar({
  query,
  onQuery,
  pageSize,
  onPageSize,
  ctaLabel,
  onCta,
  onRefresh,
  sort,
  filter,
  columns,
}: Props) {
  const { t } = useTranslation();
  const [searchOpen, setSearchOpen] = React.useState(false);

  const handleRefresh = () => {
    if (onRefresh) onRefresh();
    else toast.success(t("tableToolbar.refreshed"));
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {searchOpen || query ? (
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder={t("tableToolbar.searchPlaceholder")}
            className="h-9 w-56 pl-7 pr-7 text-xs"
          />
          <button
            type="button"
            onClick={() => {
              onQuery("");
              setSearchOpen(false);
            }}
            aria-label={t("tableToolbar.closeSearch")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label={t("tableToolbar.search")}
          onClick={() => setSearchOpen(true)}
        >
          <Search className="h-4 w-4" />
        </Button>
      )}

      <SortPopover sort={sort} />
      <FilterPopover filter={filter} />

      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("tableToolbar.refresh")}
        onClick={handleRefresh}
      >
        <RotateCw className="h-4 w-4" />
      </Button>
      <ColumnsPopover columns={columns} />

      <Select
        value={String(pageSize)}
        onValueChange={(v) => onPageSize(Number(v) as PageSize)}
      >
        {/* Sizes to content with a floor, rather than a fixed w-32 that clipped
            "On page 100" — and clipped sooner still in locales where the
            phrase is longer than the English one. */}
        <SelectTrigger size="sm" className="h-9 w-auto min-w-[9rem]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {PAGE_SIZE_OPTIONS.map((n) => (
            <SelectItem key={n} value={String(n)}>
              {t("tableToolbar.onPage").replace("{n}", String(n))}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button size="sm" className="h-9" onClick={onCta}>
        {ctaLabel}
      </Button>
    </div>
  );
}

/* ─── Sort popover ────────────────────────────────────────────────────── */

function SortPopover({ sort }: { sort?: Props["sort"] }) {
  const { t } = useTranslation();
  if (!sort) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("tableToolbar.sort")}
        onClick={() => toast(t("tableToolbar.sortComingSoon"))}
      >
        <ArrowUpDown className="h-4 w-4" />
      </Button>
    );
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label={t("tableToolbar.sort")}
        >
          <ArrowUpDown className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        <div className="border-b border-border px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {t("tableToolbar.sortBy")}
        </div>
        <div className="py-1">
          {sort.options.map((opt) => {
            const active = sort.value === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => sort.onChange(opt.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-secondary/60",
                  active && "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center",
                    active ? "text-accent" : "text-transparent",
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Filter popover ──────────────────────────────────────────────────── */

function FilterPopover({ filter }: { filter?: Props["filter"] }) {
  const { t } = useTranslation();
  if (!filter) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("tableToolbar.filter")}
        onClick={() => toast(t("tableToolbar.filterComingSoon"))}
      >
        <Filter className="h-4 w-4" />
      </Button>
    );
  }
  const count = filter.value.size;
  const toggle = (id: string) => {
    const next = new Set(filter.value);
    next.has(id) ? next.delete(id) : next.add(id);
    filter.onChange(next);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "relative h-9 w-9 text-muted-foreground",
            count > 0 && "text-accent",
          )}
          aria-label={t("tableToolbar.filter")}
        >
          <Filter className="h-4 w-4" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-accent-foreground">
              {count}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1">
        <div className="flex items-center justify-between border-b border-border px-2 py-1.5">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {filter.label ?? t("tableToolbar.filter")}
          </span>
          {count > 0 && (
            <button
              type="button"
              onClick={() => filter.onChange(new Set())}
              className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("tableToolbar.clear")}
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {filter.options.map((opt) => {
            const id = `filter-${opt.id}`;
            const checked = filter.value.has(opt.id);
            return (
              <Label
                key={opt.id}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-normal hover:bg-secondary/50"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => toggle(opt.id)}
                />
                <span className="truncate">{opt.label}</span>
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ─── Column-settings popover ─────────────────────────────────────────── */

function ColumnsPopover({ columns }: { columns?: Props["columns"] }) {
  const { t } = useTranslation();
  if (!columns) {
    return (
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-muted-foreground"
        aria-label={t("tableToolbar.columnSettings")}
        onClick={() => toast(t("tableToolbar.columnSettingsComingSoon"))}
      >
        <Settings className="h-4 w-4" />
      </Button>
    );
  }
  const allIds = columns.options.map((o) => o.id);
  const toggle = (id: string, required?: boolean) => {
    if (required) return;
    const next = new Set(columns.value);
    next.has(id) ? next.delete(id) : next.add(id);
    columns.onChange(next);
  };
  const showAll = () => columns.onChange(new Set(allIds));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-muted-foreground"
          aria-label={t("tableToolbar.columnSettings")}
        >
          <Settings className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("tableToolbar.columns")}
          </span>
          <button
            type="button"
            onClick={showAll}
            className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("tableToolbar.showAll")}
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {columns.options.map((opt) => {
            const id = `col-${opt.id}`;
            const checked = columns.value.has(opt.id);
            return (
              <Label
                key={opt.id}
                htmlFor={id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-xs font-normal hover:bg-secondary/50",
                  opt.required && "cursor-default opacity-70",
                )}
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  disabled={opt.required}
                  onCheckedChange={() => toggle(opt.id, opt.required)}
                />
                <span className="truncate">
                  {opt.label}
                  {opt.required && (
                    <span className="ml-1 text-[10px] uppercase tracking-wider text-muted-foreground/70">
                      · {t("tableToolbar.always")}
                    </span>
                  )}
                </span>
              </Label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

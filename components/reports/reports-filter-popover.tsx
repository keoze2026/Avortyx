"use client";

import { useMemo, useState } from "react";
import { Filter, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import type { CallStatus } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const TOOLBAR_BTN_HOVER =
  "hover:bg-muted hover:text-foreground dark:hover:bg-muted/70";

export interface ReportFilters {
  campaignIds: string[];
  buyerIds: string[];
  publisherIds: string[];
  statuses: CallStatus[];
}

export const EMPTY_FILTERS: ReportFilters = {
  campaignIds: [],
  buyerIds: [],
  publisherIds: [],
  statuses: [],
};

const STATUS_KEYS: Array<{ id: CallStatus; labelKey: string }> = [
  { id: "completed", labelKey: "toolsUI.reports.filter.statusOptions.completed" },
  { id: "in-progress", labelKey: "toolsUI.reports.filter.statusOptions.inProgress" },
  { id: "ringing", labelKey: "toolsUI.reports.filter.statusOptions.ringing" },
  { id: "missed", labelKey: "toolsUI.reports.filter.statusOptions.missed" },
  { id: "rejected", labelKey: "toolsUI.reports.filter.statusOptions.rejected" },
  { id: "failed", labelKey: "toolsUI.reports.filter.statusOptions.failed" },
];

interface ReportsFilterPopoverProps {
  filters: ReportFilters;
  onChange: (filters: ReportFilters) => void;
}

export function ReportsFilterPopover({ filters, onChange }: ReportsFilterPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const STATUS_OPTIONS = useMemo(
    () => STATUS_KEYS.map((s) => ({ id: s.id, label: t(s.labelKey) })),
    [t],
  );

  // Derive option lists from the live entity stores — backend is the source
  // of truth, so the popover always shows every campaign/buyer/publisher the
  // user could pick. Sorted alphabetically.
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const buyers = useBuyersStore((s) => s.buyers);
  const publishers = usePublishersStore((s) => s.publishers);
  const facets = useMemo(() => {
    const toList = (rows: Array<{ id: string; name: string }>) =>
      rows
        .map((r) => ({ id: r.id, label: r.name }))
        .sort((a, b) => a.label.localeCompare(b.label));
    return {
      campaigns: toList(campaigns),
      buyers: toList(buyers),
      publishers: toList(publishers),
    };
  }, [campaigns, buyers, publishers]);

  const total =
    filters.campaignIds.length +
    filters.buyerIds.length +
    filters.publisherIds.length +
    filters.statuses.length;

  const clearAll = () => onChange(EMPTY_FILTERS);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className={cn("relative h-8 w-8", TOOLBAR_BTN_HOVER)}
          aria-label={t("toolsUI.reports.filter.triggerAria")}
        >
          <Filter className="h-4 w-4" />
          {total > 0 && (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold text-accent-foreground">
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[22rem] p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold">{t("toolsUI.reports.filter.title")}</span>
          {total > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-3 w-3" /> {t("toolsUI.reports.filter.clearAll")}
            </button>
          )}
        </div>

        <div className="max-h-[26rem] space-y-5 overflow-y-auto px-4 py-4">
          <FacetGroup
            title={t("toolsUI.reports.filter.campaigns")}
            options={facets.campaigns}
            selected={filters.campaignIds}
            onToggle={(id) => onChange(toggle(filters, "campaignIds", id))}
          />
          <FacetGroup
            title={t("toolsUI.reports.filter.buyers")}
            options={facets.buyers}
            selected={filters.buyerIds}
            onToggle={(id) => onChange(toggle(filters, "buyerIds", id))}
          />
          <FacetGroup
            title={t("toolsUI.reports.filter.publishers")}
            options={facets.publishers}
            selected={filters.publisherIds}
            onToggle={(id) => onChange(toggle(filters, "publisherIds", id))}
          />
          <FacetGroup
            title={t("toolsUI.reports.filter.status")}
            options={STATUS_OPTIONS}
            selected={filters.statuses}
            onToggle={(id) =>
              onChange({
                ...filters,
                statuses: filters.statuses.includes(id as CallStatus)
                  ? filters.statuses.filter((s) => s !== id)
                  : [...filters.statuses, id as CallStatus],
              })
            }
          />
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border px-4 py-3">
          <Button variant="ghost" size="sm" onClick={clearAll} disabled={total === 0}>
            {t("toolsUI.reports.filter.reset")}
          </Button>
          <Button size="sm" onClick={() => setOpen(false)}>
            {t("toolsUI.reports.filter.apply")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function toggle<K extends keyof Pick<ReportFilters, "campaignIds" | "buyerIds" | "publisherIds">>(
  filters: ReportFilters,
  key: K,
  id: string,
): ReportFilters {
  const list = filters[key];
  return {
    ...filters,
    [key]: list.includes(id) ? list.filter((x) => x !== id) : [...list, id],
  };
}

function FacetGroup<T extends string>({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: Array<{ id: T; label: string }>;
  selected: T[];
  onToggle: (id: T) => void;
}) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {selected.length > 0 && (
          <span className="text-[11px] text-accent">{t("toolsUI.reports.filter.selected").replace("{count}", String(selected.length))}</span>
        )}
      </div>
      {options.length > 6 && (
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("toolsUI.reports.filter.searchPlaceholder").replace("{section}", title.toLowerCase())}
          className="mb-2 h-8 text-xs"
        />
      )}
      <div className="space-y-1.5">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("toolsUI.reports.filter.noMatches")}</p>
        ) : (
          filtered.map((o) => {
            const id = `f-${title}-${o.id}`;
            const checked = selected.includes(o.id);
            return (
              <Label
                key={o.id}
                htmlFor={id}
                className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-1 text-sm font-normal hover:bg-secondary/50"
              >
                <Checkbox
                  id={id}
                  checked={checked}
                  onCheckedChange={() => onToggle(o.id)}
                />
                <span className="truncate">{o.label}</span>
              </Label>
            );
          })
        )}
      </div>
    </div>
  );
}

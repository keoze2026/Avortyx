"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { DestinationBuilder } from "@/components/destinations/destination-builder";
import { DestinationsTable } from "@/components/destinations/destinations-table";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { formatCompact } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";

type StatusFilter = "all" | "active" | "disabled";

export default function DestinationsPage() {
  const { t } = useTranslation();
  const destinations = useDestinationsStore((s) => s.destinations);
  const remoteStats = useDestinationsStore((s) => s.stats);
  const hydrated = useDestinationsStore((s) => s.hydrated);
  const fetchDestinations = useDestinationsStore((s) => s.fetch);
  const fetchStats = useDestinationsStore((s) => s.fetchStats);
  const setEnabled = useDestinationsStore((s) => s.setEnabled);
  const remove = useDestinationsStore((s) => s.remove);
  const update = useDestinationsStore((s) => s.update);
  const buyers = useBuyersStore((s) => s.buyers);

  // Hydrate on first mount. StoreHydrator may have already fired these once,
  // but it's idempotent — calling them again refreshes after the user has
  // been on the page for a while.
  useEffect(() => {
    if (!hydrated) void fetchDestinations();
    void fetchStats();
  }, [hydrated, fetchDestinations, fetchStats]);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [buyerFilter, setBuyerFilter] = useState<string>("all");
  const [pageSize, setPageSize] = useState(100);
  const [page, setPage] = useState(0);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [editId, setEditId] = useState<string | undefined>(undefined);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset to page 0 whenever the result set or page size changes.
  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, buyerFilter, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return destinations.filter((d) => {
      if (statusFilter === "active" && !d.enabled) return false;
      if (statusFilter === "disabled" && d.enabled) return false;
      if (buyerFilter !== "all" && d.buyerId !== buyerFilter) return false;
      if (q) {
        const buyer = buyers.find((b) => b.id === d.buyerId);
        const haystack = `${d.name} ${d.tfn} ${buyer?.name ?? ""}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [destinations, query, statusFilter, buyerFilter, buyers]);

  // Summary stats: prefer the dedicated /api/destinations/stats/ endpoint
  // (single source of truth for live counters). Fall back to a client-side
  // roll-up if the endpoint hasn't responded yet — that way the header isn't
  // blank on first paint.
  const stats = useMemo(() => {
    if (remoteStats) {
      return {
        activeLive: remoteStats.activeLive,
        totalLive: remoteStats.totalLive,
        totalCC: remoteStats.totalCC,
        activeTFNs: remoteStats.activeTfns,
        vacantCC: remoteStats.vacantCC,
      };
    }
    let totalCC = 0;
    let activeTFNs = 0;
    for (const d of destinations) {
      if (!d.enabled) continue;
      activeTFNs += 1;
      totalCC += d.concurrencyCap;
    }
    return { activeLive: 0, totalLive: 0, totalCC, activeTFNs, vacantCC: totalCC };
  }, [destinations, remoteStats]);

  const openCreate = () => {
    setEditId(undefined);
    setBuilderOpen(true);
  };

  const openEdit = (id: string) => {
    setEditId(id);
    setBuilderOpen(true);
  };

  const handleToggle = async (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    try {
      await setEnabled(id, !d.enabled);
      toast.success(
        d.enabled
          ? t("networkUI.destinations.toast.paused").replace("{name}", d.name)
          : t("networkUI.destinations.toast.enabled").replace("{name}", d.name),
      );
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't update destination."));
    }
  };

  const handleDelete = async (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    try {
      await remove(id);
      toast.success(t("networkUI.destinations.toast.removed").replace("{name}", d.name));
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't delete destination."));
    }
  };

  // Resolve current selection against the live destinations list so removed /
  // toggled rows never get re-processed by a stale id.
  const selectedDestinations = useMemo(
    () => destinations.filter((d) => selectedIds.has(d.id)),
    [destinations, selectedIds],
  );

  const onBulkPlay = async () => {
    if (selectedDestinations.length === 0) return;
    const targets = selectedDestinations;
    await Promise.allSettled(targets.map((d) => setEnabled(d.id, true)));
    toast.success(
      t("common.bulk.toast.activated")
        .replace("{count}", String(targets.length))
        .replace("{entity}", t("common.bulk.entities.destinations")),
    );
    setSelectedIds(new Set());
  };

  const onBulkPause = async () => {
    if (selectedDestinations.length === 0) return;
    const targets = selectedDestinations;
    await Promise.allSettled(targets.map((d) => setEnabled(d.id, false)));
    toast.success(
      t("common.bulk.toast.paused")
        .replace("{count}", String(targets.length))
        .replace("{entity}", t("common.bulk.entities.destinations")),
    );
    setSelectedIds(new Set());
  };

  const onBulkDelete = async () => {
    if (selectedDestinations.length === 0) return;
    const targets = selectedDestinations;
    await Promise.allSettled(targets.map((d) => remove(d.id)));
    toast.success(
      t("common.bulk.toast.deleted")
        .replace("{count}", String(targets.length))
        .replace("{entity}", t("common.bulk.entities.destinations")),
    );
    setSelectedIds(new Set());
  };

  const handleUpdateCap = async (
    id: string,
    field: "concurrencyCap" | "dailyCap" | "monthlyCap",
    value: number,
  ) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    try {
      await update(id, { [field]: value });
      const fieldLabel = t(`networkUI.destinations.toast.fields.${field}`);
      toast.success(
        t("networkUI.destinations.toast.capUpdated")
          .replace("{name}", d.name)
          .replace("{field}", fieldLabel)
          .replace("{value}", value > 0 ? value.toLocaleString("en-US", { useGrouping: false }) : "∞"),
      );
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't update cap."));
    }
  };

  return (
    <>
      <PageHeader
        title={t("networkUI.destinations.page.title")}
        description={t("networkUI.destinations.page.description")}
        actions={
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4" /> {t("networkUI.destinations.page.newDestination")}
          </Button>
        }
      />

      {/* Filters + inline summary stats card */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("networkUI.destinations.page.searchPlaceholder")}
            className="h-9 w-72 pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger size="sm" className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("networkUI.destinations.page.allStatuses")}</SelectItem>
            <SelectItem value="active">{t("networkUI.destinations.page.active")}</SelectItem>
            <SelectItem value="disabled">{t("networkUI.destinations.page.disabled")}</SelectItem>
          </SelectContent>
        </Select>
        <Select value={buyerFilter} onValueChange={setBuyerFilter}>
          <SelectTrigger size="sm" className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("networkUI.destinations.page.allBuyers")}</SelectItem>
            {buyers.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Inline summary stats — one bordered card, all 5 stats split by hairlines */}
        <div className="ml-auto inline-flex h-9 items-stretch divide-x divide-border overflow-hidden rounded-md border border-border bg-card">
          {[
            { label: t("networkUI.destinations.page.activeLive"), value: formatCompact(stats.activeLive) },
            { label: t("networkUI.destinations.page.totalLive"), value: formatCompact(stats.totalLive) },
            { label: t("networkUI.destinations.page.totalCC"), value: formatCompact(stats.totalCC) },
            { label: t("networkUI.destinations.page.activeTFNs"), value: formatCompact(stats.activeTFNs) },
            { label: t("networkUI.destinations.page.vacantCC"), value: formatCompact(stats.vacantCC) },
          ].map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-1.5 px-3 text-[11px] text-muted-foreground"
            >
              <span>{s.label}</span>
              <span className="text-sm font-semibold tabular-nums tracking-tight text-foreground">
                {s.value}
              </span>
            </div>
          ))}
        </div>

        <div className="text-xs text-muted-foreground tabular-nums">
          {filtered.length} of {destinations.length}
        </div>
      </div>

      {selectedDestinations.length > 0 && (
        <BulkActionsBar
          count={selectedDestinations.length}
          onPlay={onBulkPlay}
          onPause={onBulkPause}
          onDelete={onBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          entity={t("common.bulk.entities.destinations")}
        />
      )}

      <DestinationsTable
        destinations={filtered.slice(page * pageSize, page * pageSize + pageSize)}
        onToggle={handleToggle}
        onEdit={openEdit}
        onDelete={handleDelete}
        onUpdateCap={handleUpdateCap}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
      />
      <Pagination
        page={page}
        pageSize={pageSize}
        total={filtered.length}
        onPage={setPage}
        onPageSize={setPageSize}
      />

      <DestinationBuilder
        open={builderOpen}
        onOpenChange={(v) => {
          setBuilderOpen(v);
          if (!v) setEditId(undefined);
        }}
        editId={editId}
      />
    </>
  );
}

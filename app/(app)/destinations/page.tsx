"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { DestinationBuilder } from "@/components/destinations/destination-builder";
import { DestinationsTable } from "@/components/destinations/destinations-table";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { CloneDialog } from "@/components/shared/clone-dialog";
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
import { useUIStore } from "@/lib/store/ui-store";
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
  const setEnabledMany = useDestinationsStore((s) => s.setEnabledMany);
  const enableExclusive = useDestinationsStore((s) => s.enableExclusive);
  const remove = useDestinationsStore((s) => s.remove);
  const update = useDestinationsStore((s) => s.update);
  const cloneDestination = useDestinationsStore((s) => s.clone);
  const buyers = useBuyersStore((s) => s.buyers);
  const timeZone = useUIStore((s) => s.reportTimezone);

  // Clone confirmation (opened from the + icon on a row).
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);

  // Hydrate on first mount. StoreHydrator may have already fired these once,
  // but it's idempotent — calling them again refreshes after the user has
  // been on the page for a while.
  useEffect(() => {
    if (!hydrated) void fetchDestinations();
    void fetchStats();
  }, [hydrated, fetchDestinations, fetchStats]);

  // Daily and Monthly are counted in the portal's time zone: re-load the
  // list and the header numbers when the user changes it.
  const [loadedZone, setLoadedZone] = useState(timeZone);
  useEffect(() => {
    if (timeZone === loadedZone) return;
    setLoadedZone(timeZone);
    void fetchDestinations();
    void fetchStats();
  }, [timeZone, loadedZone, fetchDestinations, fetchStats]);

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
    })
      // Active destinations always first, disabled ones after; the existing
      // order is kept within each group (the sort is stable).
      .sort((a, b) => Number(b.enabled) - Number(a.enabled));
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
      if (d.enabled) {
        await setEnabled(id, false);
        toast.success(t("networkUI.destinations.toast.paused").replace("{name}", d.name));
      } else {
        // Switching ON: a buyer can have many live TFNs, so only another
        // destination live on this same number is switched off first.
        const off = await enableExclusive(id);
        toast.success(t("networkUI.destinations.toast.enabled").replace("{name}", d.name), {
          description: off.length
            ? t("bulk.destinations.switchedOff").replace("{names}", off.map((o) => o.name).join(", "))
            : undefined,
        });
      }
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

  const handleClone = (id: string) => {
    const d = destinations.find((x) => x.id === id);
    if (!d) return;
    setCloneTarget({ id: d.id, name: d.name });
    setCloneOpen(true);
  };

  const handleConfirmClone = async () => {
    if (!cloneTarget) return;
    try {
      const copy = await cloneDestination(cloneTarget.id);
      toast.success(`Cloned as "${copy.name}"`, {
        description: "It is switched off. Change its number, or switch the original off, before turning it on.",
      });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't clone the destination."));
      throw e; // keeps the dialog open so the user can try again
    }
  };

  // Resolve current selection against the live destinations list so removed /
  // toggled rows never get re-processed by a stale id.
  const selectedDestinations = useMemo(
    () => destinations.filter((d) => selectedIds.has(d.id)),
    [destinations, selectedIds],
  );

  /**
   * Play / pause the selected TFNs one at a time and say exactly what happened.
   * Before, all were sent at once (so the server's old "one live destination
   * per buyer" rule refused most of them), one refusal put the whole
   * list back on screen, and a "done" message showed even when nothing changed.
   */
  const runBulk = async (enabled: boolean) => {
    if (selectedDestinations.length === 0) return;
    const targets = selectedDestinations;
    const nameOf = (id: string) => targets.find((d) => d.id === id)?.name ?? id;
    const { ok, failed, skipped, switchedOff } = await setEnabledMany(
      targets.map((d) => d.id),
      enabled,
    );
    const entity = t("common.bulk.entities.destinations");
    if (failed.length === 0) {
      // Skipping (one live per number) and switching off are the rule
      // working, not errors - one calm summary.
      const notes = [
        switchedOff.length
          ? t("bulk.destinations.switchedOff").replace("{names}", switchedOff.map((o) => o.name).join(", "))
          : "",
        skipped.length
          ? t("bulk.destinations.skipped").replace("{names}", skipped.map(nameOf).join(", "))
          : "",
      ].filter(Boolean);
      toast.success(
        t(enabled ? "common.bulk.toast.activated" : "common.bulk.toast.paused")
          .replace("{count}", String(ok.length))
          .replace("{entity}", entity),
        { description: notes.length ? notes.join("\n") : undefined, duration: notes.length ? 8000 : undefined },
      );
      setSelectedIds(new Set());
      return;
    }
    toast.error(
      t(enabled ? "bulk.destinations.playPartial" : "bulk.destinations.pausePartial")
        .replace("{ok}", String(ok.length))
        .replace("{total}", String(targets.length))
        .replace("{failed}", String(failed.length)),
      {
        description: failed
          .slice(0, 3)
          .map((f) => `${nameOf(f.id)}: ${f.message}`)
          .join("\n"),
        duration: 10000,
      },
    );
    // Keep the ones that could not be changed selected, so they are easy to find.
    setSelectedIds(new Set(failed.map((f) => f.id)));
  };

  const onBulkPlay = () => runBulk(true);
  const onBulkPause = () => runBulk(false);

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
        onClone={handleClone}
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

      <CloneDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        entity="destination"
        sourceName={cloneTarget?.name ?? ""}
        note="The copy starts switched off, because two live destinations can't share a number. Change its number, or switch the original off, before turning it on."
        onConfirm={handleConfirmClone}
      />
    </>
  );
}
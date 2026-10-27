"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2 } from "lucide-react";
import { toast } from "sonner";

import { BuyersTable } from "@/components/buyers/buyers-table";
import {
  ALL_BUYER_COLUMNS,
  BuyersTableToolbar,
  type BuyerColumnKey,
  type BuyerTableSortKey,
  type BuyerTableStatusFilter,
} from "@/components/buyers/buyers-table-toolbar";
import { EditBuyerDialog } from "@/components/buyers/edit-buyer-dialog";
import { InviteBuyerDialog } from "@/components/buyers/invite-buyer-dialog";
import { DestinationBuilder } from "@/components/destinations/destination-builder";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { ListLoading } from "@/components/shared/list-loading";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { usePermissions } from "@/lib/my-permissions";

export default function BuyersPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const { can } = usePermissions();
  const buyers = useBuyersStore((s) => s.buyers);
  // Until the first load finishes, show a loading table and "—" in the
  // summary - not "No buyers match" and zeros, which flashed on every refresh.
  const hydrated = useBuyersStore((s) => s.hydrated);
  const loadError = useBuyersStore((s) => s.error);
  const refetch = useBuyersStore((s) => s.fetch);
  const waiting = !hydrated && buyers.length === 0;
  const setBuyerStatus = useBuyersStore((s) => s.setStatus);
  const setStatusMany = useBuyersStore((s) => s.setStatusMany);
  const remove = useBuyersStore((s) => s.remove);
  const fetchStats = useBuyersStore((s) => s.fetchStats);

  // The list payload doesn't carry usage counters (spend today / month,
  // calls), so the HOURLY / DAILY / MONTHLY / GLOBAL columns read $0.00
  // straight off the list. Pull each buyer's counters from its /stats
  // endpoint once the list is in — keyed on the id set so a re-fetch of the
  // same buyers (the store replacing the array) doesn't fan out again.
  // Once the list response carries the four spend windows, no per-row calls.
  const buyerIdKey = buyers
    .filter((b) => !b.statsFromList)
    .map((b) => b.id)
    .join(",");
  useEffect(() => {
    if (!buyerIdKey) return;
    for (const id of buyerIdKey.split(",")) void fetchStats(id);
  }, [buyerIdKey, fetchStats]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  // "Add TFN" on a row: the destination dialog, with that buyer already picked.
  const [addTfnFor, setAddTfnFor] = useState<string | null>(null);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BuyerTableStatusFilter>("all");
  const [sort, setSort] = useState<BuyerTableSortKey>("recent");
  // 50 buyers per page by default (boss request); 10 / 25 / 100 still selectable.
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(0);
  const [columns, setColumns] =
    useState<Record<BuyerColumnKey, boolean>>(ALL_BUYER_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Whenever the result set or page size changes, snap back to page 0 so the
  // current page never points past the end of the filtered list.
  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, sort, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = buyers.filter((b) => {
      if (statusFilter !== "all" && b.status !== statusFilter) return false;
      if (
        q &&
        !`${b.name} ${b.organization} ${b.contactName ?? ""} ${b.email ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "spend") return b.spendToday - a.spendToday;
      if (sort === "calls") return b.callsToday - a.callsToday;
      if (sort === "bid") return b.bidAmount - a.bidAmount;
      return b.createdAt - a.createdAt;
    });
  }, [buyers, query, statusFilter, sort]);

  const start = page * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const stats = useMemo(() => {
    const active = buyers.filter((b) => b.status === "active").length;
    const capped = buyers.filter((b) => b.status === "capped").length;
    const spend = buyers.reduce((s, b) => s + b.spendToday, 0);
    const calls = buyers.reduce((s, b) => s + b.callsToday, 0);
    return { total: buyers.length, active, capped, spend, calls };
  }, [buyers]);

  const onToggle = (id: string) => {
    const b = buyers.find((x) => x.id === id);
    if (!b) return;
    const next = b.status === "active" ? "paused" : "active";
    setBuyerStatus(id, next);
    toast.success(
      next === "active"
        ? t("networkUI.buyers.toast.activated").replace("{name}", localName(b.name))
        : t("networkUI.buyers.toast.paused").replace("{name}", localName(b.name)),
    );
  };

  const onArchive = (id: string) => {
    const b = buyers.find((x) => x.id === id);
    if (!b) return;
    remove(id);
    toast.success(t("networkUI.buyers.toast.removed").replace("{name}", localName(b.name)));
  };

  const selectedBuyers = useMemo(
    () => buyers.filter((b) => selectedIds.has(b.id)),
    [buyers, selectedIds],
  );

  /**
   * Play / pause the selected rows together (CH-268). Before, each row was
   * sent on its own and one refusal put the whole list back, so 2-3 rows
   * showed live again for 5-10 seconds after Pause all.
   */
  const runBulk = async (status: "active" | "paused") => {
    if (selectedBuyers.length === 0) return;
    const targets = selectedBuyers;
    const { ok, failed } = await setStatusMany(
      targets.map((b) => b.id),
      status,
    );
    const entity = t("common.bulk.entities.buyers");
    if (failed.length === 0) {
      toast.success(
        t(status === "active" ? "common.bulk.toast.activated" : "common.bulk.toast.paused")
          .replace("{count}", String(ok.length))
          .replace("{entity}", entity),
      );
      setSelectedIds(new Set());
      return;
    }
    const nameOf = (id: string) => {
      const n = targets.find((b) => b.id === id)?.name;
      return n ? localName(n) : id;
    };
    toast.error(
      t(status === "active" ? "bulk.destinations.playPartial" : "bulk.destinations.pausePartial")
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

  const onBulkPlay = () => void runBulk("active");

  const onBulkPause = () => void runBulk("paused");

  const onBulkDelete = () => {
    if (selectedBuyers.length === 0) return;
    for (const b of selectedBuyers) remove(b.id);
    toast.success(
      t("common.bulk.toast.deleted")
        .replace("{count}", String(selectedBuyers.length))
        .replace("{entity}", t("common.bulk.entities.buyers")),
    );
    setSelectedIds(new Set());
  };

  return (
    <>
      <PageHeader
        title={t("networkUI.buyers.page.title")}
        description={t("networkUI.buyers.page.description")}
      />

      {/* Inventory summary */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("networkUI.buyers.stats.total"), value: waiting ? "—" : formatCompact(stats.total) },
          { label: t("networkUI.buyers.stats.active"), value: waiting ? "—" : formatCompact(stats.active) },
          { label: t("networkUI.buyers.stats.capped"), value: waiting ? "—" : formatCompact(stats.capped) },
          { label: t("networkUI.buyers.stats.spendToday"), value: waiting ? "—" : formatCurrency(stats.spend) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xl font-semibold tabular-nums tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <BuyersTableToolbar
        query={query}
        onQuery={setQuery}
        sort={sort}
        onSort={setSort}
        status={statusFilter}
        onStatus={setStatusFilter}
        pageSize={pageSize}
        onPageSize={setPageSize}
        columns={columns}
        onColumns={setColumns}
        onRefresh={() => toast.success(t("networkUI.buyers.toast.refreshed"))}
        onCreate={can("buyers", "edit") ? () => setInviteOpen(true) : undefined}
      />

      {selectedBuyers.length > 0 && can("buyers", "edit") && (
        <BulkActionsBar
          count={selectedBuyers.length}
          onPlay={onBulkPlay}
          onPause={onBulkPause}
          onDelete={can("buyers", "delete") ? onBulkDelete : undefined}
          onClear={() => setSelectedIds(new Set())}
          entity={t("common.bulk.entities.buyers")}
        />
      )}

      {waiting ? (
        <ListLoading error={loadError} onRetry={() => void refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          tone="emerald"
          title={t("networkUI.buyers.empty.title")}
          description={t("networkUI.buyers.empty.description")}
        />
      ) : (
        <>
          <BuyersTable
            buyers={visible}
            columns={columns}
            onToggle={onToggle}
            onArchive={onArchive}
            onEdit={setEditId}
            onAddTfn={setAddTfnFor}
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
        </>
      )}

      <InviteBuyerDialog open={inviteOpen} onOpenChange={setInviteOpen} />
      <DestinationBuilder
        open={addTfnFor !== null}
        onOpenChange={(open) => {
          if (!open) setAddTfnFor(null);
        }}
        defaultBuyerId={addTfnFor ?? undefined}
      />
      <EditBuyerDialog
        buyerId={editId}
        onOpenChange={(open) => !open && setEditId(null)}
      />
    </>
  );
}
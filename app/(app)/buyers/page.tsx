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
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompact, formatCurrency } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";

export default function BuyersPage() {
  const { t } = useTranslation();
  const buyers = useBuyersStore((s) => s.buyers);
  const setBuyerStatus = useBuyersStore((s) => s.setStatus);
  const remove = useBuyersStore((s) => s.remove);
  const fetchStats = useBuyersStore((s) => s.fetchStats);

  // The list payload doesn't carry usage counters (spend today / month,
  // calls), so the HOURLY / DAILY / MONTHLY / GLOBAL columns read $0.00
  // straight off the list. Pull each buyer's counters from its /stats
  // endpoint once the list is in — keyed on the id set so a re-fetch of the
  // same buyers (the store replacing the array) doesn't fan out again.
  const buyerIdKey = buyers.map((b) => b.id).join(",");
  useEffect(() => {
    if (!buyerIdKey) return;
    for (const id of buyerIdKey.split(",")) void fetchStats(id);
  }, [buyerIdKey, fetchStats]);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<BuyerTableStatusFilter>("all");
  const [sort, setSort] = useState<BuyerTableSortKey>("recent");
  const [pageSize, setPageSize] = useState(25);
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
        ? t("networkUI.buyers.toast.activated").replace("{name}", b.name)
        : t("networkUI.buyers.toast.paused").replace("{name}", b.name),
    );
  };

  const onArchive = (id: string) => {
    const b = buyers.find((x) => x.id === id);
    if (!b) return;
    remove(id);
    toast.success(t("networkUI.buyers.toast.removed").replace("{name}", b.name));
  };

  const selectedBuyers = useMemo(
    () => buyers.filter((b) => selectedIds.has(b.id)),
    [buyers, selectedIds],
  );

  const onBulkPlay = () => {
    if (selectedBuyers.length === 0) return;
    for (const b of selectedBuyers) setBuyerStatus(b.id, "active");
    toast.success(
      t("common.bulk.toast.activated")
        .replace("{count}", String(selectedBuyers.length))
        .replace("{entity}", t("common.bulk.entities.buyers")),
    );
    setSelectedIds(new Set());
  };

  const onBulkPause = () => {
    if (selectedBuyers.length === 0) return;
    for (const b of selectedBuyers) setBuyerStatus(b.id, "paused");
    toast.success(
      t("common.bulk.toast.paused")
        .replace("{count}", String(selectedBuyers.length))
        .replace("{entity}", t("common.bulk.entities.buyers")),
    );
    setSelectedIds(new Set());
  };

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
          { label: t("networkUI.buyers.stats.total"), value: formatCompact(stats.total) },
          { label: t("networkUI.buyers.stats.active"), value: formatCompact(stats.active) },
          { label: t("networkUI.buyers.stats.capped"), value: formatCompact(stats.capped) },
          { label: t("networkUI.buyers.stats.spendToday"), value: formatCurrency(stats.spend) },
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
        onCreate={() => setInviteOpen(true)}
      />

      {selectedBuyers.length > 0 && (
        <BulkActionsBar
          count={selectedBuyers.length}
          onPlay={onBulkPlay}
          onPause={onBulkPause}
          onDelete={onBulkDelete}
          onClear={() => setSelectedIds(new Set())}
          entity={t("common.bulk.entities.buyers")}
        />
      )}

      {filtered.length === 0 ? (
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
      <EditBuyerDialog
        buyerId={editId}
        onOpenChange={(open) => !open && setEditId(null)}
      />
    </>
  );
}

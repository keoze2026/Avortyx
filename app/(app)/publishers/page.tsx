"use client";

import { useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { toast } from "sonner";

import { InvitePublisherDialog } from "@/components/publishers/invite-publisher-dialog";
import { PublishersTable } from "@/components/publishers/publishers-table";
import {
  ALL_PUBLISHER_COLUMNS,
  PublishersTableToolbar,
  type PublisherColumnKey,
  type PublisherTableSortKey,
  type PublisherTableStatusFilter,
} from "@/components/publishers/publishers-table-toolbar";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { formatCompact, formatCurrency } from "@/lib/format";
import { usePublishersStore } from "@/lib/store/publishers-store";

export default function PublishersPage() {
  const { t } = useTranslation();
  const publishers = usePublishersStore((s) => s.publishers);
  const setPublisherStatus = usePublishersStore((s) => s.setStatus);
  const remove = usePublishersStore((s) => s.remove);

  const [inviteOpen, setInviteOpen] = useState(false);

  // Toolbar state
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<PublisherTableStatusFilter>("all");
  const [sort, setSort] = useState<PublisherTableSortKey>("recent");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [columns, setColumns] =
    useState<Record<PublisherColumnKey, boolean>>(ALL_PUBLISHER_COLUMNS);

  // Reset to page 0 whenever the result set or page size changes.
  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, sort, pageSize]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = publishers.filter((p) => {
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (
        q &&
        !`${p.name} ${p.organization} ${p.contactName ?? ""} ${p.email ?? ""}`
          .toLowerCase()
          .includes(q)
      )
        return false;
      return true;
    });
    return [...list].sort((a, b) => {
      if (sort === "revenue") return b.revenueToday - a.revenueToday;
      if (sort === "calls") return b.callsToday - a.callsToday;
      if (sort === "conv") return b.conversionRate - a.conversionRate;
      return b.createdAt - a.createdAt;
    });
  }, [publishers, query, statusFilter, sort]);

  const start = page * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const stats = useMemo(() => {
    const active = publishers.filter((p) => p.status === "active").length;
    const revenue = publishers.reduce((s, p) => s + p.revenueToday, 0);
    const pending = publishers.reduce((s, p) => s + p.pendingPayout, 0);
    return { total: publishers.length, active, revenue, pending };
  }, [publishers]);

  const onToggle = (id: string) => {
    const p = publishers.find((x) => x.id === id);
    if (!p) return;
    const next = p.status === "active" ? "paused" : "active";
    setPublisherStatus(id, next);
    toast.success(
      next === "active"
        ? t("networkUI.publishers.toast.activated").replace("{name}", p.name)
        : t("networkUI.publishers.toast.paused").replace("{name}", p.name),
    );
  };

  const onArchive = (id: string) => {
    const p = publishers.find((x) => x.id === id);
    if (!p) return;
    remove(id);
    toast.success(t("networkUI.publishers.toast.removed").replace("{name}", p.name));
  };

  return (
    <>
      <PageHeader
        title={t("networkUI.publishers.page.title")}
        description={t("networkUI.publishers.page.description")}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: t("networkUI.publishers.page.totalPublishers"), value: formatCompact(stats.total) },
          { label: t("networkUI.publishers.page.active"), value: formatCompact(stats.active) },
          { label: t("networkUI.publishers.page.revenueToday"), value: formatCurrency(stats.revenue) },
          { label: t("networkUI.publishers.page.pendingPayouts"), value: formatCurrency(stats.pending) },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4">
              <div className="text-xl font-semibold tabular-nums tracking-tight">{s.value}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <PublishersTableToolbar
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
        onRefresh={() => toast.success(t("networkUI.publishers.toast.refreshed"))}
        onCreate={() => setInviteOpen(true)}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          tone="violet"
          title={t("networkUI.publishers.empty.title")}
          description={t("networkUI.publishers.empty.description")}
        />
      ) : (
        <>
          <PublishersTable
            publishers={visible}
            columns={columns}
            onToggle={onToggle}
            onArchive={onArchive}
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

      <InvitePublisherDialog open={inviteOpen} onOpenChange={setInviteOpen} />
    </>
  );
}

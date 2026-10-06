"use client";

import { useEffect, useMemo, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";

import { CampaignBuilder } from "@/components/campaigns/campaign-builder";
import { CampaignsTable, PROGRESS_ORDER, campaignProgress } from "@/components/campaigns/campaigns-table";
import {
  ALL_CAMPAIGN_COLUMNS,
  CampaignsToolbar,
  type CampaignColumnKey,
  type CampaignSortKey,
  type CampaignStatusFilter,
} from "@/components/campaigns/campaigns-toolbar";
import { BulkActionsBar } from "@/components/shared/bulk-actions-bar";
import { EmptyState } from "@/components/shared/empty-state";
import { CloneDialog } from "@/components/shared/clone-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";

export default function CampaignsPage() {
  const { t } = useTranslation();
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const setCampaignStatus = useCampaignsStore((s) => s.setStatus);
  const remove = useCampaignsStore((s) => s.remove);
  const cloneCampaign = useCampaignsStore((s) => s.clone);

  const [open, setOpen] = useState(false);

  // Clone confirmation (opened from the + icon on a row).
  const [cloneOpen, setCloneOpen] = useState(false);
  const [cloneTarget, setCloneTarget] = useState<{ id: string; name: string } | null>(null);

  // Toolbar state — lifted from the table so search/sort/filter/columns are
  // all wired through the new toolbar above the card.
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<CampaignSortKey>("recent");
  const [statusFilter, setStatusFilter] = useState<CampaignStatusFilter>("all");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(0);
  const [columns, setColumns] =
    useState<Record<CampaignColumnKey, boolean>>(ALL_CAMPAIGN_COLUMNS);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Reset to page 0 whenever the result set or page size changes so the
  // current page never points past the end of the filtered list.
  useEffect(() => {
    setPage(0);
  }, [query, statusFilter, sort, pageSize]);

  // Tracking numbers per campaign — the same count the Progress badge uses.
  const allNumbers = useNumbersStore((s) => s.numbers);
  const numbersByCampaign = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of allNumbers ?? []) {
      if (!n.campaignId) continue;
      map.set(n.campaignId, (map.get(n.campaignId) ?? 0) + 1);
    }
    return map;
  }, [allNumbers]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = campaigns;
    if (statusFilter !== "all") {
      list = list.filter((c) => c.status === statusFilter);
    }
    if (q) {
      list = list.filter((c) =>
        `${c.name} ${c.vertical}`.toLowerCase().includes(q),
      );
    }
    // Ready always first, then Paused, then Incomplete; the chosen sort
    // (recent, name, calls, revenue) orders campaigns within each group.
    const rank = (c: (typeof list)[number]) =>
      PROGRESS_ORDER[campaignProgress(c, numbersByCampaign.get(c.id) ?? 0)];
    return [...list].sort((a, b) => {
      const byProgress = rank(a) - rank(b);
      if (byProgress !== 0) return byProgress;
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "callsToday") return b.callsToday - a.callsToday;
      if (sort === "revenueToday") return b.revenueToday - a.revenueToday;
      return b.createdAt - a.createdAt;
    });
  }, [campaigns, query, statusFilter, sort, numbersByCampaign]);

  const start = page * pageSize;
  const visible = filtered.slice(start, start + pageSize);

  const onToggle = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    const next = c.status === "active" ? "paused" : "active";
    setCampaignStatus(id, next);
    toast.success(
      next === "active"
        ? t("trafficUI.campaigns.toast.activated").replace("{name}", c.name)
        : t("trafficUI.campaigns.toast.paused").replace("{name}", c.name),
    );
  };

  const onArchive = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    remove(id);
    toast.success(t("trafficUI.campaigns.toast.archived").replace("{name}", c.name));
  };

  const onClone = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    setCloneTarget({ id: c.id, name: c.name });
    setCloneOpen(true);
  };

  const onConfirmClone = async () => {
    if (!cloneTarget) return;
    try {
      const copy = await cloneCampaign(cloneTarget.id);
      toast.success(`Cloned as "${copy.name}"`, {
        description: "It starts paused. Attach a tracking number, then switch it on.",
      });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Couldn't clone the campaign."));
      throw e; // keeps the dialog open so the user can try again
    }
  };

  // Resolve the live selection against the current campaigns list so we never
  // operate on rows that have already been archived / removed.
  const selectedCampaigns = useMemo(
    () => campaigns.filter((c) => selectedIds.has(c.id)),
    [campaigns, selectedIds],
  );

  const onBulkPlay = () => {
    if (selectedCampaigns.length === 0) return;
    for (const c of selectedCampaigns) setCampaignStatus(c.id, "active");
    toast.success(
      t("common.bulk.toast.activated")
        .replace("{count}", String(selectedCampaigns.length))
        .replace("{entity}", t("common.bulk.entities.campaigns")),
    );
    setSelectedIds(new Set());
  };

  const onBulkPause = () => {
    if (selectedCampaigns.length === 0) return;
    for (const c of selectedCampaigns) setCampaignStatus(c.id, "paused");
    toast.success(
      t("common.bulk.toast.paused")
        .replace("{count}", String(selectedCampaigns.length))
        .replace("{entity}", t("common.bulk.entities.campaigns")),
    );
    setSelectedIds(new Set());
  };

  const onBulkDelete = () => {
    if (selectedCampaigns.length === 0) return;
    for (const c of selectedCampaigns) remove(c.id);
    toast.success(
      t("common.bulk.toast.deleted")
        .replace("{count}", String(selectedCampaigns.length))
        .replace("{entity}", t("common.bulk.entities.campaigns")),
    );
    setSelectedIds(new Set());
  };

  return (
    <>
      <PageHeader
        title={t("trafficUI.campaigns.pageTitle")}
        description={t("trafficUI.campaigns.pageDescription")}
        actions={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.newCampaign")}
          </Button>
        }
      />

      {campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          tone="emerald"
          title={t("trafficUI.campaigns.empty.title")}
          description={t("trafficUI.campaigns.empty.description")}
          actions={
            <Button onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.createCampaign")}
            </Button>
          }
        />
      ) : (
        <>
          <CampaignsToolbar
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
            onRefresh={() => toast.success(t("trafficUI.campaigns.refreshed"))}
          />

          {selectedCampaigns.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <BulkActionsBar
                count={selectedCampaigns.length}
                onPlay={onBulkPlay}
                onPause={onBulkPause}
                onDelete={onBulkDelete}
                onClear={() => setSelectedIds(new Set())}
                entity={t("common.bulk.entities.campaigns")}
              />
            </div>
          )}

          {filtered.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              tone="emerald"
              title={t("trafficUI.campaigns.emptyMatch.title")}
              description={t("trafficUI.campaigns.emptyMatch.description")}
            />
          ) : (
            <>
              <CampaignsTable
                campaigns={visible}
                columns={columns}
                onToggle={onToggle}
                onArchive={onArchive}
                onClone={onClone}
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
        </>
      )}

      <CampaignBuilder open={open} onOpenChange={setOpen} />

      <CloneDialog
        open={cloneOpen}
        onOpenChange={setCloneOpen}
        entity="campaign"
        sourceName={cloneTarget?.name ?? ""}
        note="The copy starts paused. Tracking numbers are not copied (each number belongs to one campaign), so attach one before switching it on."
        onConfirm={onConfirmClone}
      />
    </>
  );
}
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
import { ListLoading } from "@/components/shared/list-loading";
import { CloneDialog } from "@/components/shared/clone-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import { usePartnerPermissions } from "@/hooks/use-partner-permissions";
import { usePermissions } from "@/lib/my-permissions";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useNumbersStore } from "@/lib/store/numbers-store";

export default function CampaignsPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  // A publisher login: Manage Traffic switched off = look, don't change.
  // Creating a campaign also needs Number Creation (the server's "create").
  const partnerCan = usePartnerPermissions().can;
  // An employee: the Roles-screen ticks decide (Edit Campaign data / Delete).
  const staffCan = usePermissions().can;
  const canManage = partnerCan("manage_traffic") && staffCan("campaigns", "edit-campaign");
  const canCreate = canManage && partnerCan("number_creation");
  const canDelete = staffCan("campaigns", "delete");
  const campaigns = useCampaignsStore((s) => s.campaigns);
  // Until the first load finishes, show a loading table - not "No campaigns
  // yet" (which flashed on every refresh before the real list arrived).
  const hydrated = useCampaignsStore((s) => s.hydrated);
  const loadError = useCampaignsStore((s) => s.error);
  const refetch = useCampaignsStore((s) => s.fetch);
  const waiting = !hydrated && campaigns.length === 0;
  const setCampaignStatus = useCampaignsStore((s) => s.setStatus);
  const setStatusMany = useCampaignsStore((s) => s.setStatusMany);
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
        ? t("trafficUI.campaigns.toast.activated").replace("{name}", localName(c.name))
        : t("trafficUI.campaigns.toast.paused").replace("{name}", localName(c.name)),
    );
  };

  const onArchive = (id: string) => {
    const c = campaigns.find((x) => x.id === id);
    if (!c) return;
    remove(id);
    toast.success(t("trafficUI.campaigns.toast.archived").replace("{name}", localName(c.name)));
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
      toast.success(t("x5.campaigns.clonedAs").replace("{name}", localName(copy.name)), {
        description: t("x5.campaigns.clonedHint"),
      });
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("x5.campaigns.cloneFailed")));
      throw e; // keeps the dialog open so the user can try again
    }
  };

  // Resolve the live selection against the current campaigns list so we never
  // operate on rows that have already been archived / removed.
  const selectedCampaigns = useMemo(
    () => campaigns.filter((c) => selectedIds.has(c.id)),
    [campaigns, selectedIds],
  );

  /**
   * Play / pause the selected rows together (CH-268). Before, each row was
   * sent on its own and one refusal put the whole list back, so 2-3 rows
   * showed live again for 5-10 seconds after Pause all.
   */
  const runBulk = async (status: "active" | "paused") => {
    if (selectedCampaigns.length === 0) return;
    const targets = selectedCampaigns;
    const { ok, failed } = await setStatusMany(
      targets.map((c) => c.id),
      status,
    );
    const entity = t("common.bulk.entities.campaigns");
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
      const n = targets.find((c) => c.id === id)?.name;
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
          canCreate ? (
            <Button size="sm" onClick={() => setOpen(true)}>
              <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.newCampaign")}
            </Button>
          ) : undefined
        }
      />

      {waiting ? (
        <ListLoading error={loadError} onRetry={() => void refetch()} />
      ) : campaigns.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          tone="emerald"
          title={t("trafficUI.campaigns.empty.title")}
          description={t("trafficUI.campaigns.empty.description")}
          actions={
            canCreate ? (
              <Button onClick={() => setOpen(true)}>
                <Plus className="h-4 w-4" /> {t("trafficUI.campaigns.createCampaign")}
              </Button>
            ) : undefined
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

          {canManage && selectedCampaigns.length > 0 && (
            <div className="flex items-center justify-between gap-3">
              <BulkActionsBar
                count={selectedCampaigns.length}
                onPlay={onBulkPlay}
                onPause={onBulkPause}
                onDelete={canDelete ? onBulkDelete : undefined}
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
                canManage={canManage}
                canCreate={canCreate}
                canDelete={canDelete}
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
        sourceName={localName(cloneTarget?.name ?? "")}
        note={t("x5.campaigns.cloneNote")}
        onConfirm={onConfirmClone}
      />
    </>
  );
}
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Info, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { CreateVoipShieldDialog } from "@/components/suppression/create-voip-shield-dialog";
import {
  PAGE_SIZE_OPTIONS,
  SuppressionToolbar,
  type ColumnOption,
  type FilterOption,
  type PageSize,
  type SortOption,
} from "@/components/suppression/suppression-toolbar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import type { VoipShieldEntry } from "@/lib/mock/suppression";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useVoipShieldStore } from "@/lib/store/voip-shield-store";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";
import { LocalName } from "@/lib/i18n/local-name";

type SortKey = "name-asc" | "name-desc" | "size-desc" | "size-asc";

export default function VoipShieldPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();

  const SORT_OPTIONS: SortOption[] = [
    { id: "name-asc", label: t("toolsUI.suppression.voipShield.sort.nameAsc") },
    { id: "name-desc", label: t("toolsUI.suppression.voipShield.sort.nameDesc") },
    { id: "size-desc", label: t("toolsUI.suppression.voipShield.sort.sizeDesc") },
    { id: "size-asc", label: t("toolsUI.suppression.voipShield.sort.sizeAsc") },
  ];

  const COLUMN_OPTIONS: ColumnOption[] = [
    { id: "name", label: t("toolsUI.suppression.columns.name") },
    { id: "campaign", label: t("toolsUI.suppression.columns.campaign") },
    { id: "size", label: t("toolsUI.suppression.columns.size") },
    { id: "actions", label: t("toolsUI.suppression.columns.actions"), required: true },
  ];
  const DEFAULT_COLUMNS = new Set(COLUMN_OPTIONS.map((c) => c.id));

  // Live campaigns from the real store (was MOCK_CAMPAIGNS) — hydrated from
  // GET /api/campaigns/ on app boot. We rebuild the id→name map via useMemo
  // so any new/edited campaign reflects in the chips here without a refresh.
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const campaignNameById = React.useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns],
  );

  function campaignLabel(entry: VoipShieldEntry): string {
    if (entry.campaignIds.length === 0) return t("toolsUI.suppression.allCampaigns");
    if (entry.campaignIds.length === 1) {
      return campaignNameById.get(entry.campaignIds[0]) ?? entry.campaignIds[0];
    }
    const first = campaignNameById.get(entry.campaignIds[0]) ?? entry.campaignIds[0];
    return `${first} +${entry.campaignIds.length - 1}`;
  }

  const shields = useVoipShieldStore((s) => s.shields);
  const add = useVoipShieldStore((s) => s.add);
  const remove = useVoipShieldStore((s) => s.remove);

  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<SortKey>("name-asc");
  const [campaignFilter, setCampaignFilter] = React.useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(DEFAULT_COLUMNS);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<VoipShieldEntry | null>(null);

  React.useEffect(() => {
    setPage(0);
  }, [query, sortKey, campaignFilter, pageSize]);

  // Build the campaign filter option list — "All Campaigns" + every known campaign.
  const filterOptions = React.useMemo<FilterOption[]>(
    () => [
      { id: "__all__", label: t("toolsUI.suppression.allCampaigns") },
      ...campaigns.map((c) => ({ id: c.id, label: c.name })),
    ],
    [campaigns, t],
  );

  const rows = React.useMemo(() => {
    let items = shields;
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((e) =>
        `${e.name} ${campaignLabel(e)}`.toLowerCase().includes(q),
      );
    }
    if (campaignFilter.size > 0) {
      items = items.filter((e) => {
        if (campaignFilter.has("__all__") && e.campaignIds.length === 0) return true;
        return e.campaignIds.some((id) => campaignFilter.has(id));
      });
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "size-desc":
          return b.blockedCarriers.length - a.blockedCarriers.length;
        case "size-asc":
          return a.blockedCarriers.length - b.blockedCarriers.length;
      }
    });
    return sorted;
  }, [shields, query, sortKey, campaignFilter]);

  const visible = rows.slice(page * pageSize, page * pageSize + pageSize);
  const allChecked = visible.length > 0 && visible.every((e) => selected.has(e.id));

  const toggleAll = () => {
    setSelected((curr) => {
      const next = new Set(curr);
      if (allChecked) visible.forEach((e) => next.delete(e.id));
      else visible.forEach((e) => next.add(e.id));
      return next;
    });
  };

  const toggle = (id: string) => {
    setSelected((curr) => {
      const next = new Set(curr);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const onCreate = async (name: string) => {
    const created = await add(name);
    toast.success(t("toolsUI.suppression.voipShield.toastCreated").replace("{name}", name));
    router.push(`${ROUTES.voipShield}/${created.id}`);
  };

  const confirmRemove = (entry: VoipShieldEntry) => {
    remove(entry.id);
    setSelected((curr) => {
      const next = new Set(curr);
      next.delete(entry.id);
      return next;
    });
    toast.success(t("toolsUI.suppression.voipShield.toastRemoved").replace("{name}", entry.name));
    setRemoving(null);
  };

  return (
    <>
      <PageHeader
        title={t("toolsUI.suppression.voipShield.title")}
        description={
          <span className="inline-flex items-center gap-1.5">
            <Info className="h-3.5 w-3.5" />
            {t("toolsUI.suppression.voipShield.paidNotice")}
          </span>
        }
      />

      <SuppressionToolbar
        query={query}
        onQuery={setQuery}
        pageSize={pageSize}
        onPageSize={setPageSize}
        ctaLabel={can("voip-shield", "edit") ? t("toolsUI.suppression.voipShield.createCta") : undefined}
        onCta={can("voip-shield", "edit") ? () => setCreateOpen(true) : undefined}
        sort={{
          options: SORT_OPTIONS,
          value: sortKey,
          onChange: (id) => setSortKey(id as SortKey),
        }}
        filter={{
          label: t("toolsUI.suppression.voipShield.filterByCampaign"),
          options: filterOptions,
          value: campaignFilter,
          onChange: setCampaignFilter,
        }}
        columns={{
          options: COLUMN_OPTIONS,
          value: visibleColumns,
          onChange: (next) => {
            // The required "actions" column must always stay visible.
            const guarded = new Set(next);
            guarded.add("actions");
            setVisibleColumns(guarded);
          },
        }}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[700px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 w-10 text-left">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label={t("toolsUI.suppression.aria.selectAll")}
                  />
                </TableHead>
                {visibleColumns.has("name") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.name")}</TableHead>
                )}
                {visibleColumns.has("campaign") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.campaign")}</TableHead>
                )}
                {visibleColumns.has("size") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.size")}</TableHead>
                )}
                <TableHead className="pr-4">{t("toolsUI.suppression.columns.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visible.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell
                    colSpan={1 + visibleColumns.size}
                    className="py-10 text-center text-xs text-muted-foreground"
                  >
                    {t("toolsUI.suppression.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                visible.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="pl-4 text-left">
                      <Checkbox
                        checked={selected.has(e.id)}
                        onCheckedChange={() => toggle(e.id)}
                        aria-label={t("toolsUI.suppression.aria.selectRow").replace("{label}", e.name)}
                      />
                    </TableCell>
                    {visibleColumns.has("name") && (
                      <TableCell className="text-left font-medium"><LocalName name={e.name} /></TableCell>
                    )}
                    {visibleColumns.has("campaign") && (
                      <TableCell className="text-left text-muted-foreground">
                        {campaignLabel(e)}
                      </TableCell>
                    )}
                    {visibleColumns.has("size") && (
                      <TableCell className="text-left tabular-nums">
                        {formatNumber(e.blockedCarriers.length)}
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Can area="voip-shield" action="edit"><Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("toolsUI.suppression.aria.editRow").replace("{label}", e.name)}
                          onClick={() => router.push(`${ROUTES.voipShield}/${e.id}`)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button></Can>
                        <Can area="voip-shield" action="delete"><Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("toolsUI.suppression.aria.removeRow").replace("{label}", e.name)}
                          onClick={() => setRemoving(e)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button></Can>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={rows.length}
        onPage={setPage}
        onPageSize={(n) => setPageSize(n as PageSize)}
        pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
      />

      <CreateVoipShieldDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreate}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("toolsUI.suppression.removeConfirm.shieldTitle").replace("{name}", removing?.name ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("toolsUI.suppression.removeConfirm.shieldDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("toolsUI.suppression.removeConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && confirmRemove(removing)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("toolsUI.suppression.removeConfirm.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

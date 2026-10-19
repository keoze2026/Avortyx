"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { CreateTcpaShieldDialog } from "@/components/suppression/create-tcpa-shield-dialog";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ROUTES } from "@/lib/constants";
import {
  TCPA_PROVIDER_TYPES,
  type TcpaShieldEntry,
} from "@/lib/mock/suppression";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useTcpaShieldStore } from "@/lib/store/tcpa-shield-store";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

type SortKey = "name-asc" | "name-desc" | "type-asc" | "active-first";

/** Build a "first +N" label from a shield's campaign id list, given a
 *  live id→name resolver. Defined as a pure helper so the page-level
 *  useMemo can call it without re-binding the resolver. */
function makeCampaignLabel(nameById: Map<string, string>) {
  return (entry: TcpaShieldEntry): string => {
    if (entry.campaignIds.length === 0) return "—";
    if (entry.campaignIds.length === 1) {
      return nameById.get(entry.campaignIds[0]) ?? entry.campaignIds[0];
    }
    const first = nameById.get(entry.campaignIds[0]) ?? entry.campaignIds[0];
    return `${first} +${entry.campaignIds.length - 1}`;
  };
}

export default function TcpaShieldPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();

  const SORT_OPTIONS: SortOption[] = [
    { id: "name-asc", label: t("toolsUI.suppression.tcpaShield.sort.nameAsc") },
    { id: "name-desc", label: t("toolsUI.suppression.tcpaShield.sort.nameDesc") },
    { id: "type-asc", label: t("toolsUI.suppression.tcpaShield.sort.typeAsc") },
    { id: "active-first", label: t("toolsUI.suppression.tcpaShield.sort.activeFirst") },
  ];

  const COLUMN_OPTIONS: ColumnOption[] = [
    { id: "name", label: t("toolsUI.suppression.columns.name") },
    { id: "campaign", label: t("toolsUI.suppression.columns.campaign") },
    { id: "type", label: t("toolsUI.suppression.columns.type") },
    { id: "status", label: t("toolsUI.suppression.columns.status") },
    { id: "actions", label: t("toolsUI.suppression.columns.actions"), required: true },
  ];
  const DEFAULT_COLUMNS = new Set(COLUMN_OPTIONS.map((c) => c.id));

  const providers = useTcpaShieldStore((s) => s.providers);
  const add = useTcpaShieldStore((s) => s.add);
  const remove = useTcpaShieldStore((s) => s.remove);
  const setActive = useTcpaShieldStore((s) => s.setActive);

  // Live campaigns (was MOCK_CAMPAIGNS). The id→name map is rebuilt only
  // when the campaigns array reference actually changes.
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const campaignNameById = React.useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns],
  );
  const campaignLabel = React.useMemo(
    () => makeCampaignLabel(campaignNameById),
    [campaignNameById],
  );

  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = React.useState(0);
  const [sortKey, setSortKey] = React.useState<SortKey>("name-asc");
  const [typeFilter, setTypeFilter] = React.useState<Set<string>>(new Set());
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(DEFAULT_COLUMNS);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = React.useState(false);
  const [removing, setRemoving] = React.useState<TcpaShieldEntry | null>(null);

  React.useEffect(() => {
    setPage(0);
  }, [query, sortKey, typeFilter, pageSize]);

  const filterOptions = React.useMemo<FilterOption[]>(
    () => TCPA_PROVIDER_TYPES.map((t) => ({ id: t, label: t })),
    [],
  );

  const rows = React.useMemo(() => {
    let items = providers;
    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter((p) =>
        `${p.name} ${p.type} ${campaignLabel(p)}`.toLowerCase().includes(q),
      );
    }
    if (typeFilter.size > 0) {
      items = items.filter((p) => typeFilter.has(p.type));
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "type-asc":
          return a.type.localeCompare(b.type);
        case "active-first":
          return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [providers, query, sortKey, typeFilter, campaignLabel]);

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

  const onCreate = async ({ name, type }: { name: string; type: TcpaShieldEntry["type"] }) => {
    const created = await add(name, type);
    toast.success(t("toolsUI.suppression.tcpaShield.toastCreated").replace("{name}", name));
    router.push(`${ROUTES.tcpaShield}/${created.id}`);
  };

  const confirmRemove = (entry: TcpaShieldEntry) => {
    remove(entry.id);
    setSelected((curr) => {
      const next = new Set(curr);
      next.delete(entry.id);
      return next;
    });
    toast.success(t("toolsUI.suppression.tcpaShield.toastRemoved").replace("{name}", entry.name));
    setRemoving(null);
  };

  return (
    <>
      <PageHeader title={t("toolsUI.suppression.tcpaShield.title")} />

      <SuppressionToolbar
        query={query}
        onQuery={setQuery}
        pageSize={pageSize}
        onPageSize={setPageSize}
        ctaLabel={can("voip-shield", "edit") ? t("toolsUI.suppression.tcpaShield.createCta") : undefined}
        onCta={can("voip-shield", "edit") ? () => setCreateOpen(true) : undefined}
        sort={{
          options: SORT_OPTIONS,
          value: sortKey,
          onChange: (id) => setSortKey(id as SortKey),
        }}
        filter={{
          label: t("toolsUI.suppression.tcpaShield.filterByType"),
          options: filterOptions,
          value: typeFilter,
          onChange: setTypeFilter,
        }}
        columns={{
          options: COLUMN_OPTIONS,
          value: visibleColumns,
          onChange: (next) => {
            const guarded = new Set(next);
            guarded.add("actions");
            setVisibleColumns(guarded);
          },
        }}
      />

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[800px]">
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
                {visibleColumns.has("type") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.type")}</TableHead>
                )}
                {visibleColumns.has("status") && <TableHead>{t("toolsUI.suppression.columns.status")}</TableHead>}
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
                      <TableCell className="text-left font-medium">{e.name}</TableCell>
                    )}
                    {visibleColumns.has("campaign") && (
                      <TableCell className="text-left text-muted-foreground">
                        {campaignLabel(e)}
                      </TableCell>
                    )}
                    {visibleColumns.has("type") && (
                      <TableCell className="text-left text-muted-foreground">
                        {e.type}
                      </TableCell>
                    )}
                    {visibleColumns.has("status") && (
                      <TableCell>
                        <Switch
                          checked={e.active}
                          disabled={!can("voip-shield", "edit")}
                          onCheckedChange={(v) => {
                            setActive(e.id, Boolean(v));
                            toast.success(
                              (v
                                ? t("toolsUI.suppression.tcpaShield.toastActivated")
                                : t("toolsUI.suppression.tcpaShield.toastPaused")
                              ).replace("{name}", e.name),
                            );
                          }}
                          aria-label={t("toolsUI.suppression.aria.toggleRow").replace("{label}", e.name)}
                        />
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Can area="voip-shield" action="edit"><Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("toolsUI.suppression.aria.editRow").replace("{label}", e.name)}
                          onClick={() => router.push(`${ROUTES.tcpaShield}/${e.id}`)}
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

      <CreateTcpaShieldDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={onCreate}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("toolsUI.suppression.removeConfirm.shieldTitle").replace("{name}", removing?.name ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("toolsUI.suppression.removeConfirm.providerDescription")}
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

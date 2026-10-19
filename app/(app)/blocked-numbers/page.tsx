"use client";

import * as React from "react";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { BlockNumberDialog } from "@/components/suppression/block-number-dialog";
import {
  PAGE_SIZE_OPTIONS,
  SuppressionToolbar,
  type ColumnOption,
  type FilterOption,
  type PageSize,
  type SortOption,
} from "@/components/suppression/suppression-toolbar";
import { UpdateNumberDialog } from "@/components/suppression/update-number-dialog";
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
import type { BlockedNumberEntry } from "@/lib/mock/suppression";
import { useBlockedNumbersStore } from "@/lib/store/blocked-numbers-store";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useUIStore } from "@/lib/store/ui-store";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

const ALL_CAMPAIGNS_ID = "__all__";

type SortKey = "newest" | "oldest" | "number-asc" | "number-desc" | "campaign-asc";

const INTL_LOCALE: Record<string, string> = { en: "en-US", zh: "zh-CN", ja: "ja-JP", ru: "ru-RU" };

/** When a number was blocked, in the portal's timezone and language:
 *  "Oct 15, 2026, 08:42 PM". "—" when the server didn't say. */
function blockedOnLabel(ts: number | undefined, locale: string, timeZone: string): string {
  if (!ts) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  };
  const tag = INTL_LOCALE[locale] ?? locale;
  try {
    return new Intl.DateTimeFormat(tag, { ...opts, timeZone }).format(new Date(ts));
  } catch {
    return new Intl.DateTimeFormat(tag, opts).format(new Date(ts));
  }
}

/** "18302094480" → "+18302094480"; if scope is prefix we append "*". */
function displayNumber(entry: BlockedNumberEntry): string {
  const base = `+${entry.number}`;
  return entry.scope === "prefix" ? `${base}*` : base;
}

export default function BlockedNumbersPage() {
  const { t, locale } = useTranslation();
  const { can } = usePermissions();
  const timeZone = useUIStore((s) => s.reportTimezone);

  const SORT_OPTIONS: SortOption[] = [
    { id: "newest", label: t("toolsUI.suppression.blockedNumbers.sort.newest") },
    { id: "oldest", label: t("toolsUI.suppression.blockedNumbers.sort.oldest") },
    { id: "number-asc", label: t("toolsUI.suppression.blockedNumbers.sort.numberAsc") },
    { id: "number-desc", label: t("toolsUI.suppression.blockedNumbers.sort.numberDesc") },
    { id: "campaign-asc", label: t("toolsUI.suppression.blockedNumbers.sort.campaignAsc") },
  ];

  const COLUMN_OPTIONS: ColumnOption[] = [
    { id: "number", label: t("toolsUI.suppression.columns.blockedNumber") },
    { id: "campaign", label: t("toolsUI.suppression.columns.campaign") },
    { id: "blockedOn", label: t("toolsUI.suppression.columns.blockedOn") },
    { id: "actions", label: t("toolsUI.suppression.columns.actions"), required: true },
  ];
  const DEFAULT_COLUMNS = new Set(COLUMN_OPTIONS.map((c) => c.id));

  // Live campaigns from the real store (was previously MOCK_CAMPAIGNS).
  // Hydrated from GET /api/campaigns/ on app boot.
  const campaigns = useCampaignsStore((s) => s.campaigns);
  const campaignNameById = React.useMemo(
    () => new Map(campaigns.map((c) => [c.id, c.name])),
    [campaigns],
  );

  function campaignLabel(entry: BlockedNumberEntry): string {
    if (!entry.campaignId) return t("toolsUI.suppression.allCampaigns");
    // Fall back to the raw id if the matching campaign hasn't loaded yet
    // (or was deleted) so the row never renders blank.
    return campaignNameById.get(entry.campaignId) ?? entry.campaignId;
  }

  const numbers = useBlockedNumbersStore((s) => s.numbers);
  const addNumber = useBlockedNumbersStore((s) => s.add);
  const updateNumber = useBlockedNumbersStore((s) => s.update);
  const removeNumber = useBlockedNumbersStore((s) => s.remove);
  const removeManyNumbers = useBlockedNumbersStore((s) => s.removeMany);

  const [query, setQuery] = React.useState("");
  const [pageSize, setPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [page, setPage] = React.useState(0);
  // The number blocked most recently is always on top.
  const [sortKey, setSortKey] = React.useState<SortKey>("newest");
  const [campaignFilter, setCampaignFilter] = React.useState<Set<string>>(new Set());

  // Reset to page 0 whenever the result set or page size changes.
  React.useEffect(() => {
    setPage(0);
  }, [query, sortKey, campaignFilter, pageSize]);
  const [visibleColumns, setVisibleColumns] = React.useState<Set<string>>(DEFAULT_COLUMNS);
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [createOpen, setCreateOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<BlockedNumberEntry | null>(null);
  const [removing, setRemoving] = React.useState<BlockedNumberEntry | null>(null);
  const [bulkRemoveOpen, setBulkRemoveOpen] = React.useState(false);
  const [bulkRemoving, setBulkRemoving] = React.useState(false);

  // Resolve the selection against the live list so a row that is already gone
  // is never counted or sent to the backend again.
  const selectedEntries = React.useMemo(
    () => numbers.filter((n) => selected.has(n.id)),
    [numbers, selected],
  );

  // Campaign filter options — "All Campaigns" pseudo-option + every real campaign.
  const filterOptions = React.useMemo<FilterOption[]>(
    () => [
      { id: ALL_CAMPAIGNS_ID, label: t("toolsUI.suppression.allCampaigns") },
      ...campaigns.map((c) => ({ id: c.id, label: c.name })),
    ],
    [campaigns, t],
  );

  const rows = React.useMemo(() => {
    let items = numbers;
    const q = query.trim().toLowerCase().replace(/\D/g, "");
    if (q) {
      items = items.filter(
        (n) =>
          n.number.includes(q) ||
          campaignLabel(n).toLowerCase().includes(query.trim().toLowerCase()),
      );
    }
    if (campaignFilter.size > 0) {
      items = items.filter((n) => {
        if (campaignFilter.has(ALL_CAMPAIGNS_ID) && !n.campaignId) return true;
        return n.campaignId !== undefined && campaignFilter.has(n.campaignId);
      });
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (sortKey) {
        case "newest":
          return (b.blockedAt ?? 0) - (a.blockedAt ?? 0);
        case "oldest":
          return (a.blockedAt ?? 0) - (b.blockedAt ?? 0);
        case "number-asc":
          return a.number.localeCompare(b.number);
        case "number-desc":
          return b.number.localeCompare(a.number);
        case "campaign-asc":
          return campaignLabel(a).localeCompare(campaignLabel(b));
      }
    });
    return sorted;
  }, [numbers, query, sortKey, campaignFilter]);

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

  const onBlock = async (input: {
    number: string;
    scope: BlockedNumberEntry["scope"];
    campaignId?: string;
  }) => {
    const created = await addNumber(input);
    toast.success(t("toolsUI.suppression.blockedNumbers.toastBlocked").replace("{number}", created.number));
  };

  const onSaveUpdate = ({
    id,
    number,
    campaignId,
  }: {
    id: string;
    /** Read-only echo of the entry's number; backend treats this as immutable
     *  after creation, so we keep it in the toast text but DO NOT send it. */
    number: string;
    campaignId?: string;
  }) => {
    updateNumber(id, { campaignId });
    toast.success(t("toolsUI.suppression.blockedNumbers.toastUpdated").replace("{number}", number));
  };

  const confirmRemove = (entry: BlockedNumberEntry) => {
    removeNumber(entry.id);
    setSelected((curr) => {
      const next = new Set(curr);
      next.delete(entry.id);
      return next;
    });
    toast.success(t("toolsUI.suppression.blockedNumbers.toastUnblocked").replace("{number}", displayNumber(entry)));
    setRemoving(null);
  };

  const confirmBulkRemove = async () => {
    const ids = selectedEntries.map((e) => e.id);
    if (ids.length === 0) return;
    setBulkRemoving(true);
    const failed = await removeManyNumbers(ids);
    setBulkRemoving(false);
    setBulkRemoveOpen(false);
    // Keep the failed rows checked so they can be retried in one click.
    setSelected(new Set(failed));
    const done = ids.length - failed.length;
    if (done > 0) {
      toast.success(t("toolsUI.suppression.blockedNumbers.toastBulkUnblocked").replace("{count}", String(done)));
    }
    if (failed.length > 0) {
      toast.error(t("toolsUI.suppression.blockedNumbers.toastBulkUnblockFailed").replace("{count}", String(failed.length)));
    }
  };

  return (
    <>
      <PageHeader title={t("toolsUI.suppression.blockedNumbers.title")} />

      <SuppressionToolbar
        query={query}
        onQuery={setQuery}
        pageSize={pageSize}
        onPageSize={setPageSize}
        ctaLabel={can("blocked-numbers", "edit") ? t("toolsUI.suppression.blockedNumbers.createCta") : undefined}
        onCta={can("blocked-numbers", "edit") ? () => setCreateOpen(true) : undefined}
        sort={{
          options: SORT_OPTIONS,
          value: sortKey,
          onChange: (id) => setSortKey(id as SortKey),
        }}
        filter={{
          label: t("toolsUI.suppression.blockedNumbers.filterByCampaign"),
          options: filterOptions,
          value: campaignFilter,
          onChange: setCampaignFilter,
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

      {selectedEntries.length > 0 && (
        <div className="flex items-center gap-2">
          <Can area="blocked-numbers" action="delete"><Button
            size="sm"
            variant="destructive"
            onClick={() => setBulkRemoveOpen(true)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            {t("toolsUI.suppression.blockedNumbers.bulkUnblockCta").replace("{count}", String(selectedEntries.length))}
          </Button></Can>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            {t("common.bulk.clear")}
          </Button>
        </div>
      )}

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table className="min-w-[600px]">
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 w-10 text-left">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={toggleAll}
                    aria-label={t("toolsUI.suppression.aria.selectAll")}
                  />
                </TableHead>
                {visibleColumns.has("number") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.blockedNumber")}</TableHead>
                )}
                {visibleColumns.has("campaign") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.campaign")}</TableHead>
                )}
                {visibleColumns.has("blockedOn") && (
                  <TableHead className="text-left">{t("toolsUI.suppression.columns.blockedOn")}</TableHead>
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
                        aria-label={t("toolsUI.suppression.aria.selectRow").replace("{label}", displayNumber(e))}
                      />
                    </TableCell>
                    {visibleColumns.has("number") && (
                      <TableCell className="text-left font-mono">
                        {displayNumber(e)}
                      </TableCell>
                    )}
                    {visibleColumns.has("campaign") && (
                      <TableCell className="text-left text-muted-foreground">
                        {campaignLabel(e)}
                      </TableCell>
                    )}
                    {visibleColumns.has("blockedOn") && (
                      <TableCell className="text-left tabular-nums text-muted-foreground">
                        {blockedOnLabel(e.blockedAt, locale, timeZone)}
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Can area="blocked-numbers" action="edit"><Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("toolsUI.suppression.aria.editRow").replace("{label}", displayNumber(e))}
                          onClick={() => setEditing(e)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button></Can>
                        <Can area="blocked-numbers" action="delete"><Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("toolsUI.suppression.aria.unblockRow").replace("{label}", displayNumber(e))}
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

      <BlockNumberDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onBlock={onBlock}
      />

      <UpdateNumberDialog
        entry={editing}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
        onSave={onSaveUpdate}
      />

      <AlertDialog open={removing !== null} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("toolsUI.suppression.blockedNumbers.confirmUnblockTitle").replace("{number}", removing ? displayNumber(removing) : "")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("toolsUI.suppression.blockedNumbers.confirmUnblockDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("toolsUI.suppression.removeConfirm.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => removing && confirmRemove(removing)}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("toolsUI.suppression.blockedNumbers.confirmUnblockAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={bulkRemoveOpen}
        onOpenChange={(o) => !bulkRemoving && setBulkRemoveOpen(o)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("toolsUI.suppression.blockedNumbers.confirmBulkUnblockTitle").replace("{count}", String(selectedEntries.length))}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("toolsUI.suppression.blockedNumbers.confirmBulkUnblockDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkRemoving}>
              {t("toolsUI.suppression.removeConfirm.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkRemoving}
              onClick={(ev) => {
                // Stay open until the deletes finish so the button can't be clicked twice.
                ev.preventDefault();
                void confirmBulkRemove();
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("toolsUI.suppression.blockedNumbers.confirmUnblockAction")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

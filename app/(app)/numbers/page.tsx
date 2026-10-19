"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { CreateNumberPoolDialog } from "@/components/numbers/create-number-pool-dialog";
import { PoolsTable, POOL_COLUMNS } from "@/components/numbers/pools-table";
import { ProvisionNumberDialog } from "@/components/numbers/provision-number-dialog";
import {
  TrackNumbersTable,
  TRACK_NUMBERS_COLUMNS,
  deriveCountry,
  deriveName,
  deriveVendor,
} from "@/components/numbers/track-numbers-table";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import {
  PAGE_SIZE_OPTIONS,
  TableToolbar,
  type ColumnOption,
  type FilterOption,
  type PageSize,
  type SortOption,
} from "@/components/shared/table-toolbar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { NumberPool, TrackingNumber } from "@/lib/types";
import { usePermissions } from "@/lib/my-permissions";

/* ─── Sort definitions ───────────────────────────────────────────────── */

type NumberSortKey =
  | "number-asc"
  | "number-desc"
  | "calls-desc"
  | "calls-asc"
  | "renew-soonest";

const NUMBER_SORT_KEYS: Array<{ id: NumberSortKey; labelKey: string }> = [
  { id: "number-asc", labelKey: "trafficUI.numbers.sort.numberAsc" },
  { id: "number-desc", labelKey: "trafficUI.numbers.sort.numberDesc" },
  { id: "calls-desc", labelKey: "trafficUI.numbers.sort.callsDesc" },
  { id: "calls-asc", labelKey: "trafficUI.numbers.sort.callsAsc" },
  { id: "renew-soonest", labelKey: "trafficUI.numbers.sort.renewSoonest" },
];

type PoolSortKey = "name-asc" | "name-desc" | "size-desc" | "active-first";

const POOL_SORT_KEYS: Array<{ id: PoolSortKey; labelKey: string }> = [
  { id: "name-asc", labelKey: "trafficUI.numbers.sort.nameAsc" },
  { id: "name-desc", labelKey: "trafficUI.numbers.sort.nameDesc" },
  { id: "size-desc", labelKey: "trafficUI.numbers.sort.sizeDesc" },
  { id: "active-first", labelKey: "trafficUI.numbers.sort.activeFirst" },
];

/* ─── Default visible columns ────────────────────────────────────────── */

const DEFAULT_NUMBER_COLUMNS = new Set(TRACK_NUMBERS_COLUMNS.map((c) => c.id));
const DEFAULT_POOL_COLUMNS = new Set(POOL_COLUMNS.map((c) => c.id));

/* ─── Page ───────────────────────────────────────────────────────────── */

export default function NumbersPage() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const router = useRouter();
  const numbers = useNumbersStore((s) => s.numbers);
  const NUMBER_SORT_OPTIONS: SortOption[] = NUMBER_SORT_KEYS.map((o) => ({ id: o.id, label: t(o.labelKey) }));
  const POOL_SORT_OPTIONS: SortOption[] = POOL_SORT_KEYS.map((o) => ({ id: o.id, label: t(o.labelKey) }));
  const pools = useNumbersStore((s) => s.pools);
  const addPool = useNumbersStore((s) => s.addPool);

  const [provisionOpen, setProvisionOpen] = React.useState(false);
  const [createPoolOpen, setCreatePoolOpen] = React.useState(false);
  const [tab, setTab] = React.useState<"all" | "pools">("all");

  const onCreatePool = async (input: {
    name: string;
    country: string;
    closedBrowserDelaySec: number;
    idleTimeSec: number;
    autoBuy: boolean;
  }) => {
    const created = await addPool({
      name: input.name,
      // We don't pick a campaign at create-time — that happens on the detail page.
      campaignId: "",
      campaignName: "",
      rotationStrategy: "round-robin",
      numberCount: 0,
      callsToday: 0,
      active: true,
      country: input.country,
      closedBrowserDelaySec: input.closedBrowserDelaySec,
      idleTimeSec: input.idleTimeSec,
      autoBuy: input.autoBuy,
      phoneNumberFormat: "E164",
      attachedNumberIds: [],
      vendorEnabled: false,
      trafficSourcesEnabled: false,
      trafficSources: [],
    });
    toast.success(t("trafficUI.numbers.pools.toast.created").replace("{name}", input.name));
    router.push(`${ROUTES.numbers}/pools/${created.id}`);
  };

  /* ── All Numbers tab state ── */
  const [allQuery, setAllQuery] = React.useState("");
  const [allPageSize, setAllPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [allPage, setAllPage] = React.useState(0);
  const [allSortKey, setAllSortKey] = React.useState<NumberSortKey>("number-asc");
  const [allTypeFilter, setAllTypeFilter] = React.useState<Set<string>>(new Set());
  const [allColumns, setAllColumns] = React.useState<Set<string>>(DEFAULT_NUMBER_COLUMNS);
  const [allSelected, setAllSelected] = React.useState<Set<string>>(new Set());

  // Reset to page 0 whenever the result set or page size changes.
  React.useEffect(() => {
    setAllPage(0);
  }, [allQuery, allSortKey, allTypeFilter, allPageSize]);

  const allFilterOptions = React.useMemo<FilterOption[]>(
    () => [
      { id: "local", label: t("trafficUI.numbers.typeOptions.local") },
      { id: "tollfree", label: t("trafficUI.numbers.typeOptions.tollfree") },
      { id: "international", label: t("trafficUI.numbers.typeOptions.international") },
    ],
    [t],
  );
  const allColumnOptions = React.useMemo<ColumnOption[]>(
    () => TRACK_NUMBERS_COLUMNS.map((c) => ({ id: c.id, label: t(c.labelKey), required: (c as { required?: boolean }).required })),
    [t],
  );

  const allRows = useFilteredNumbers(numbers, {
    query: allQuery,
    sortKey: allSortKey,
    typeFilter: allTypeFilter,
  });
  const allVisible = allRows.slice(allPage * allPageSize, allPage * allPageSize + allPageSize);

  /* ── Pools tab state ── */
  const [poolsQuery, setPoolsQuery] = React.useState("");
  const [poolsPageSize, setPoolsPageSize] = React.useState<PageSize>(PAGE_SIZE_OPTIONS[1]);
  const [poolsPage, setPoolsPage] = React.useState(0);
  const [poolsSortKey, setPoolsSortKey] = React.useState<PoolSortKey>("name-asc");
  const [poolsActiveFilter, setPoolsActiveFilter] = React.useState<Set<string>>(new Set());
  const [poolsColumns, setPoolsColumns] = React.useState<Set<string>>(DEFAULT_POOL_COLUMNS);
  const [poolsSelected, setPoolsSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setPoolsPage(0);
  }, [poolsQuery, poolsSortKey, poolsActiveFilter, poolsPageSize]);

  const poolsFilterOptions = React.useMemo<FilterOption[]>(
    () => [
      { id: "active", label: t("trafficUI.numbers.statusOptions.active") },
      { id: "paused", label: t("trafficUI.numbers.statusOptions.paused") },
    ],
    [t],
  );
  const poolsColumnOptions = React.useMemo<ColumnOption[]>(
    () => POOL_COLUMNS.map((c) => ({ id: c.id, label: t(c.labelKey), required: (c as { required?: boolean }).required })),
    [t],
  );

  const poolsRows = useFilteredPools(pools, {
    query: poolsQuery,
    sortKey: poolsSortKey,
    activeFilter: poolsActiveFilter,
  });
  const poolsVisible = poolsRows.slice(
    poolsPage * poolsPageSize,
    poolsPage * poolsPageSize + poolsPageSize,
  );

  /* ── Selection helpers (per tab) ── */
  const makeToggleAll =
    (visible: Array<{ id: string }>, current: Set<string>, set: (s: Set<string>) => void) =>
    () => {
      const allChecked = visible.length > 0 && visible.every((x) => current.has(x.id));
      const next = new Set(current);
      if (allChecked) visible.forEach((x) => next.delete(x.id));
      else visible.forEach((x) => next.add(x.id));
      set(next);
    };
  const makeToggle =
    (current: Set<string>, set: (s: Set<string>) => void) =>
    (id: string) => {
      const next = new Set(current);
      next.has(id) ? next.delete(id) : next.add(id);
      set(next);
    };

  const guardActions =
    (defaults: Set<string>) =>
    (next: Set<string>): Set<string> => {
      const guarded = new Set(next);
      guarded.add("actions");
      // Ensure we don't end up with an empty list — restore defaults if everything was hidden.
      if (guarded.size === 1) defaults.forEach((d) => guarded.add(d));
      return guarded;
    };

  return (
    <>
      <PageHeader
        title={t("trafficUI.numbers.pageTitle")}
        description={t("trafficUI.numbers.pageDescription")}
      />

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="gap-4">
        <TabsList>
          <TabsTrigger value="all">{t("trafficUI.numbers.tabs.tracking")}</TabsTrigger>
          <TabsTrigger value="pools">{t("trafficUI.numbers.tabs.pools")}</TabsTrigger>
        </TabsList>

        {/* ─── All numbers ─── */}
        <TabsContent value="all" className="space-y-4">
          <TableToolbar
            query={allQuery}
            onQuery={setAllQuery}
            pageSize={allPageSize}
            onPageSize={setAllPageSize}
            ctaLabel={can("tracking-numbers", "edit") ? t("trafficUI.numbers.cta.create") : undefined}
            onCta={can("tracking-numbers", "edit") ? () => setProvisionOpen(true) : undefined}
            sort={{
              options: NUMBER_SORT_OPTIONS,
              value: allSortKey,
              onChange: (id) => setAllSortKey(id as NumberSortKey),
            }}
            filter={{
              label: t("trafficUI.numbers.filterType"),
              options: allFilterOptions,
              value: allTypeFilter,
              onChange: setAllTypeFilter,
            }}
            columns={{
              options: allColumnOptions,
              value: allColumns,
              onChange: (next) => setAllColumns(guardActions(DEFAULT_NUMBER_COLUMNS)(next)),
            }}
          />
          <TrackNumbersTable
            numbers={allVisible}
            visibleColumns={allColumns}
            selected={allSelected}
            onToggle={makeToggle(allSelected, setAllSelected)}
            onToggleAll={makeToggleAll(allVisible, allSelected, setAllSelected)}
          />
          <Pagination
            page={allPage}
            pageSize={allPageSize}
            total={allRows.length}
            onPage={setAllPage}
            onPageSize={(n) => setAllPageSize(n as PageSize)}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          />
        </TabsContent>

        {/* ─── Pools ─── */}
        <TabsContent value="pools" className="space-y-4">
          <TableToolbar
            query={poolsQuery}
            onQuery={setPoolsQuery}
            pageSize={poolsPageSize}
            onPageSize={setPoolsPageSize}
            ctaLabel={can("number-pools", "edit") ? t("trafficUI.numbers.cta.create") : undefined}
            onCta={can("number-pools", "edit") ? () => setCreatePoolOpen(true) : undefined}
            sort={{
              options: POOL_SORT_OPTIONS,
              value: poolsSortKey,
              onChange: (id) => setPoolsSortKey(id as PoolSortKey),
            }}
            filter={{
              label: t("trafficUI.numbers.filterStatus"),
              options: poolsFilterOptions,
              value: poolsActiveFilter,
              onChange: setPoolsActiveFilter,
            }}
            columns={{
              options: poolsColumnOptions,
              value: poolsColumns,
              onChange: (next) => setPoolsColumns(guardActions(DEFAULT_POOL_COLUMNS)(next)),
            }}
          />
          <PoolsTable
            pools={poolsVisible}
            visibleColumns={poolsColumns}
            selected={poolsSelected}
            onToggle={makeToggle(poolsSelected, setPoolsSelected)}
            onToggleAll={makeToggleAll(poolsVisible, poolsSelected, setPoolsSelected)}
          />
          <Pagination
            page={poolsPage}
            pageSize={poolsPageSize}
            total={poolsRows.length}
            onPage={setPoolsPage}
            onPageSize={(n) => setPoolsPageSize(n as PageSize)}
            pageSizeOptions={[...PAGE_SIZE_OPTIONS]}
          />
        </TabsContent>

      </Tabs>

      <ProvisionNumberDialog open={provisionOpen} onOpenChange={setProvisionOpen} />

      <CreateNumberPoolDialog
        open={createPoolOpen}
        onOpenChange={setCreatePoolOpen}
        onCreate={onCreatePool}
      />
    </>
  );
}

/* ─── Filtering / sorting hooks ──────────────────────────────────────── */

function useFilteredNumbers(
  numbers: TrackingNumber[],
  args: { query: string; sortKey: NumberSortKey; typeFilter: Set<string> },
): TrackingNumber[] {
  return React.useMemo(() => {
    let items = numbers;
    const q = args.query.trim().toLowerCase();
    if (q) {
      items = items.filter((n) => {
        const haystack = `${n.number} ${deriveName(n)} ${deriveCountry(n)} ${deriveVendor(n)} ${n.campaignName ?? ""} ${n.state ?? ""}`;
        return haystack.toLowerCase().includes(q);
      });
    }
    if (args.typeFilter.size > 0) {
      items = items.filter((n) => args.typeFilter.has(n.type));
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (args.sortKey) {
        case "number-asc":
          return a.number.localeCompare(b.number);
        case "number-desc":
          return b.number.localeCompare(a.number);
        case "calls-desc":
          return b.callsToday - a.callsToday;
        case "calls-asc":
          return a.callsToday - b.callsToday;
        case "renew-soonest":
          return a.id.localeCompare(b.id); // deterministic — renew dates derive from id
      }
    });
    return sorted;
  }, [numbers, args.query, args.sortKey, args.typeFilter]);
}

function useFilteredPools(
  pools: NumberPool[],
  args: { query: string; sortKey: PoolSortKey; activeFilter: Set<string> },
): NumberPool[] {
  return React.useMemo(() => {
    let items = pools;
    const q = args.query.trim().toLowerCase();
    if (q) {
      items = items.filter((p) =>
        `${p.name} ${p.campaignName}`.toLowerCase().includes(q),
      );
    }
    if (args.activeFilter.size > 0) {
      const wantActive = args.activeFilter.has("active");
      const wantPaused = args.activeFilter.has("paused");
      items = items.filter((p) => (p.active ? wantActive : wantPaused));
    }
    const sorted = [...items];
    sorted.sort((a, b) => {
      switch (args.sortKey) {
        case "name-asc":
          return a.name.localeCompare(b.name);
        case "name-desc":
          return b.name.localeCompare(a.name);
        case "size-desc":
          return b.numberCount - a.numberCount;
        case "active-first":
          return Number(b.active) - Number(a.active) || a.name.localeCompare(b.name);
      }
    });
    return sorted;
  }, [pools, args.query, args.sortKey, args.activeFilter]);
}


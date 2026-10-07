"use client";

import { useEffect, useMemo, useState } from "react";
import { PhoneCall } from "lucide-react";
import { toast } from "sonner";

import { useTranslation } from "@/hooks/use-translation";
import { CallDetailSheet } from "@/components/calls/call-detail-sheet";
import { ALL_COLUMNS, CallsToolbar } from "@/components/calls/calls-toolbar";
import { CallsTable } from "@/components/calls/calls-table";
import { ReportsPinGate } from "@/components/reports/reports-pin-gate";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Pagination } from "@/components/shared/pagination";
import { rangeDayKeys, totals, type DateRange } from "@/lib/analytics";
import { analyticsService } from "@/lib/api/services/analytics.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import {
  CALL_LOG_LINK_HEADERS,
  DESTINATION_NAME_HEADER,
  DESTINATION_NUMBER_HEADER,
  DURATION_HEADER,
  destinationNameMap,
  destinationOf,
  exportNumber,
  formatDuration as formatExportDuration,
  statusLabel,
  upperLabels,
} from "@/lib/call-log-export";
import { callMatches, useServerCallSearch } from "@/lib/call-search";
import { dateStamped, downloadRows, type ExportColumn, type ExportFormat } from "@/lib/export";
import { isPinRequiredError } from "@/lib/reports-scope";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useReportsAccess } from "@/lib/store/security-store";
import { useUIStore } from "@/lib/store/ui-store";
import { formatCompact, formatCurrency, formatDuration, formatPercent, zonedDayKey } from "@/lib/format";
import type { Call, CallStatus } from "@/lib/types";

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.map((c) => c.id));

/** Columns written to the CSV / XLSX file - the same names, order and formats
 *  as the Reports call-log export (see lib/call-log-export.ts). Numeric fields
 *  (payout, revenue) stay numbers so XLSX keeps their type. */
function callExportColumns(destinationNames: ReadonlyMap<string, string>): ExportColumn<Call>[] {
  return upperLabels<Call>([
    { label: "Call ID", value: (c) => c.id },
    { label: "Started", value: (c) => new Date(c.startedAt).toISOString() },
    { label: "Caller ID", value: (c) => exportNumber(c.callerNumber) },
    { label: "Called Number", value: (c) => exportNumber(c.calledNumber) },
    { label: "Campaign", value: (c) => c.campaignName },
    { label: "Publisher", value: (c) => c.publisherName ?? "" },
    { label: "Buyer", value: (c) => c.buyerName ?? "" },
    { label: DESTINATION_NAME_HEADER, value: (c) => destinationOf(c, destinationNames).name },
    { label: DESTINATION_NUMBER_HEADER, value: (c) => destinationOf(c, destinationNames).number },
    { label: "State", value: (c) => c.geo.state ?? "" },
    { label: "Status", value: (c) => statusLabel(c.statusRaw ?? c.status) },
    { label: DURATION_HEADER, value: (c) => formatExportDuration(c.durationSec) },
    { label: "Payout", value: (c) => c.payout },
    { label: "Revenue", value: (c) => c.revenue },
    { label: "Recording", value: (c) => c.recordingUrl ?? "" },
  ]);
}

export default function CallsPage() {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<DateRange>("7d");
  const [statuses, setStatuses] = useState<Set<CallStatus>>(new Set());
  const [campaignFilter, setCampaignFilter] = useState("all");
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(DEFAULT_VISIBLE);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [selected, setSelected] = useState<Call | null>(null);

  const campaigns = useCampaignsStore((s) => s.campaigns);

  // The selected range, as calendar days in the report timezone — "Today"
  // is today's date there, not a rolling 24 hours (which let yesterday
  // evening's calls sit under "Today"). Fetched from the backend for
  // exactly those days, like the Dashboard and Reports pages; this used to
  // filter the shared 200-row `recent` cache, which capped every range at
  // whatever happened to be in it ("102 of 200").
  const timeZone = useUIStore((s) => s.reportTimezone);
  // Destination names for the export's DESTINATION NAME column.
  const destinations = useDestinationsStore((s) => s.destinations);
  const destinationNames = useMemo(() => destinationNameMap(destinations), [destinations]);
  const { from: fromKey, to: toKey } = rangeDayKeys(range, timeZone);
  const [rangeCalls, setRangeCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);

  // Today is open to everyone; a range that starts earlier is history, which
  // needs the reports PIN once one exists (the server refuses it otherwise).
  const needsPin = fromKey < zonedDayKey(Date.now(), timeZone);
  const access = useReportsAccess(needsPin);
  const mayLoad = !needsPin || access.canFetch;

  useEffect(() => {
    if (!mayLoad) {
      setRangeCalls([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    analyticsService
      .allCalls({ dateFrom: fromKey, dateTo: toKey }, { timeZone })
      .then((items) => {
        if (!cancelled) setRangeCalls(items);
      })
      .catch((e) => {
        if (cancelled) return;
        // "History is locked" is not an error: the PIN prompt says so.
        if (!isPinRequiredError(e)) toast.error(friendlyErrorMessage(e, "Couldn't load calls for this range"));
        setRangeCalls([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey, timeZone, mayLoad]);

  // A typed phone number is also searched on the server, across the whole log
  // for these dates and this campaign (lib/call-search.ts). Until it answers,
  // the on-screen matches show at once.
  const serverBase = useMemo(
    () =>
      mayLoad && fromKey
        ? { dateFrom: fromKey, dateTo: toKey, campaignId: campaignFilter !== "all" ? campaignFilter : undefined }
        : null,
    [mayLoad, fromKey, toKey, campaignFilter],
  );
  const server = useServerCallSearch(serverBase, query, timeZone);

  const filtered = useMemo(() => {
    let calls = server.results ?? rangeCalls;
    if (campaignFilter !== "all") calls = calls.filter((c) => c.campaignId === campaignFilter);
    if (statuses.size > 0) calls = calls.filter((c) => statuses.has(c.status));
    if (query.trim()) {
      // Names / text as typed; phone numbers on their digits, with or without
      // the leading 1, in any format - caller, dialled (tracking) number and
      // the buyer's destination.
      calls = calls.filter((c) =>
        callMatches(
          c,
          query,
          `${c.callerNumber} ${c.calledNumber ?? ""} ${c.destinationNumber ?? ""} ${c.campaignName} ${c.publisherName ?? ""} ${c.buyerName ?? ""} ${c.geo.state ?? ""}`,
        ),
      );
    }
    return calls;
  }, [query, campaignFilter, statuses, rangeCalls, server.results]);

  const summary = useMemo(() => totals(filtered), [filtered]);

  // Reset page on filter change
  const filterKey = `${query}|${range}|${campaignFilter}|${[...statuses].sort().join(",")}`;
  useMemoResetPage(filterKey, setPage);

  const paged = useMemo(() => {
    const start = page * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const toggleStatus = (s: CallStatus) =>
    setStatuses((curr) => {
      const next = new Set(curr);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });

  const toggleColumn = (id: string) =>
    setVisibleColumns((curr) => {
      const next = new Set(curr);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const onExport = (format: ExportFormat) => {
    downloadRows(
      format,
      callExportColumns(destinationNames),
      filtered,
      dateStamped(`calls-${range}`),
      "Calls",
      { boldHeader: true, linkColumns: CALL_LOG_LINK_HEADERS },
    );
    toast.success(
      t("toolsUI.callLogs.toastExport")
        .replace("{count}", String(filtered.length))
        .replace("{format}", format.toUpperCase()),
    );
  };

  return (
    <>
      <PageHeader
        title={t("toolsUI.callLogs.pageTitle")}
        description={t("toolsUI.callLogs.pageDescription")}
      />

      <ReportsPinGate needsPin={needsPin} onCancel={() => setRange("today")}>
        {/* Summary tiles */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <SummaryCard label={t("toolsUI.callLogs.summary.totalCalls")} value={formatCompact(summary.count)} />
          <SummaryCard label={t("toolsUI.callLogs.summary.won")} value={formatCompact(summary.completed)} />
          <SummaryCard label={t("toolsUI.callLogs.summary.conversion")} value={formatPercent(summary.conversionRate * 100, 1)} />
          <SummaryCard label={t("toolsUI.callLogs.summary.revenue")} value={formatCurrency(summary.revenue)} />
        </div>

        <CallsToolbar
          query={query}
          onQuery={setQuery}
          range={range}
          onRange={setRange}
          statuses={statuses}
          onToggleStatus={toggleStatus}
          campaignFilter={campaignFilter}
          onCampaign={setCampaignFilter}
          campaigns={campaigns}
          visibleColumns={visibleColumns}
          onToggleColumn={toggleColumn}
          onExport={onExport}
          count={filtered.length}
          total={rangeCalls.length}
        />

        {filtered.length === 0 && !loading && !server.searching ? (
          <EmptyState
            icon={PhoneCall}
            tone="cyan"
            title={t("toolsUI.callLogs.emptyTitle")}
            description={t("toolsUI.callLogs.emptyDescription")}
          />
        ) : (
          <>
            <CallsTable
              calls={paged}
              visibleColumns={visibleColumns}
              onSelect={setSelected}
              selectedId={selected?.id}
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPage={setPage}
              onPageSize={(n) => {
                setPageSize(n);
                setPage(0);
              }}
            />
          </>
        )}

        {/* Tiny footer note explaining avg duration */}
        <p className="-mt-3 text-[11px] text-muted-foreground">
          {t("toolsUI.callLogs.avgDurationLabel")} <span className="font-mono text-foreground">{formatDuration(summary.avgDurationSec)}</span>
        </p>

        <CallDetailSheet
          call={selected}
          onOpenChange={(o) => {
            if (!o) setSelected(null);
          }}
        />
      </ReportsPinGate>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="font-mono text-2xl font-semibold">{value}</div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

/** Tiny hook — resets a page counter when a dependency key changes. */
function useMemoResetPage(key: string, setPage: (n: number) => void) {
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}

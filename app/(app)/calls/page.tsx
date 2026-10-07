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
import { DURATION_MIN_HEADER, secondsToMinutes, statusLabel, upperLabels } from "@/lib/call-log-export";
import { dateStamped, downloadRows, type ExportColumn, type ExportFormat } from "@/lib/export";
import { isPinRequiredError } from "@/lib/reports-scope";
import { useCampaignsStore } from "@/lib/store/campaigns-store";
import { useReportsAccess } from "@/lib/store/security-store";
import { useUIStore } from "@/lib/store/ui-store";
import { formatCompact, formatCurrency, formatDuration, formatPercent, zonedDayKey } from "@/lib/format";
import type { Call, CallStatus } from "@/lib/types";

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.map((c) => c.id));

/** Columns written to the CSV / XLSX file. Shared shape — numeric fields
 *  (duration, payout, revenue) are emitted as numbers so XLSX preserves typing.
 *  Headers in capitals, Status capitalised, Duration in minutes (see
 *  lib/call-log-export.ts). */
const CALL_EXPORT_COLUMNS: ExportColumn<Call>[] = upperLabels<Call>([
  { label: "ID", value: (c) => c.id },
  { label: "Started", value: (c) => new Date(c.startedAt).toISOString() },
  { label: "Caller", value: (c) => c.callerNumber },
  { label: "Destination", value: (c) => c.destinationNumber },
  { label: "Campaign", value: (c) => c.campaignName },
  { label: "Buyer", value: (c) => c.buyerName ?? "" },
  { label: "Publisher", value: (c) => c.publisherName ?? "" },
  { label: "State", value: (c) => c.geo.state ?? "" },
  { label: "Status", value: (c) => statusLabel(c.statusRaw ?? c.status) },
  { label: DURATION_MIN_HEADER, value: (c) => secondsToMinutes(c.durationSec) },
  { label: "Payout", value: (c) => c.payout },
  { label: "Revenue", value: (c) => c.revenue },
]);

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

  const filtered = useMemo(() => {
    let calls = rangeCalls;
    if (campaignFilter !== "all") calls = calls.filter((c) => c.campaignId === campaignFilter);
    if (statuses.size > 0) calls = calls.filter((c) => statuses.has(c.status));
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      // Phone numbers are matched on their digits, so "+1 (877) 489-3778",
      // "18774893778" and "8774893778" all find the same call. The number that
      // was DIALLED (the tracking number) and the buyer's destination are
      // searched as well as the caller - before, searching a tracking number
      // could never find the calls made to it.
      const qDigits = q.replace(/\D/g, "");
      const digitsOf = (s?: string) => (s ?? "").replace(/\D/g, "");
      calls = calls.filter((c) => {
        const text = `${c.callerNumber} ${c.calledNumber ?? ""} ${c.destinationNumber ?? ""} ${c.campaignName} ${c.publisherName ?? ""} ${c.buyerName ?? ""} ${c.geo.state ?? ""}`.toLowerCase();
        if (text.includes(q)) return true;
        if (qDigits.length < 4) return false;
        return [c.callerNumber, c.calledNumber, c.destinationNumber].some((n) => digitsOf(n).includes(qDigits));
      });
    }
    return calls;
  }, [query, campaignFilter, statuses, rangeCalls]);

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
      CALL_EXPORT_COLUMNS,
      filtered,
      dateStamped(`calls-${range}`),
      "Calls",
      { boldHeader: true },
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

        {filtered.length === 0 && !loading ? (
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

"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { BarChart3, PieChart, X } from "lucide-react";
import { toast } from "sonner";

import { CallLogTable } from "@/components/reports/call-log-table";
import { CallPerfCard } from "@/components/reports/call-perf-card";
import { CallSummaryTable } from "@/components/reports/call-summary-table";
import { HourlyDistribution } from "@/components/reports/hourly-distribution";
import { EMPTY_FILTERS, type ReportFilters } from "@/components/reports/reports-filter-popover";
import { ReportsPinGate } from "@/components/reports/reports-pin-gate";
import {
  DEFAULT_REPORTS_VISIBILITY,
  ReportsToolbar,
  type ReportsVisibility,
} from "@/components/reports/reports-toolbar";
import { TotalCallsDonut } from "@/components/reports/total-calls-donut";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { callStatusFilterToQuery, matchesCallStatusFilter, type CallStatusFilter } from "@/lib/call-status";
import { useCallsStore } from "@/lib/store/calls-store";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Reuses the Call Summary's own column labels so the reset strip names the
 *  active filter with the exact word the operator just clicked. */
const STATUS_FILTER_LABEL_KEYS: Record<CallStatusFilter, string> = {
  connected: "toolsUI.reports.summary.columns.connected",
  qualified: "toolsUI.reports.summary.columns.qualified",
  notConnected: "toolsUI.reports.summary.columns.noConnect",
};

export default function ReportsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [visibility, setVisibility] = useState<ReportsVisibility>(DEFAULT_REPORTS_VISIBILITY);
  // Set by clicking a Connected / Qualified / Not Connected total in the Call
  // Summary card below. Narrows the Call Log to matching rows; cleared by
  // clicking the same total again or the reset control above the log.
  const [statusFilter, setStatusFilter] = useState<CallStatusFilter | null>(null);
  // Mobile-only chart switch — desktop always shows both. The donut is hidden
  // on mobile because it eats vertical real-estate; the toggle button below
  // swaps which chart occupies the main slot.
  const [mobileChart, setMobileChart] = useState<"hourly" | "donut">("hourly");

  // Reads from the shared calls store (populated by the StoreHydrator on app
  // mount). Filtering happens client-side for the cached slice. The one
  // exception is the Connected/Qualified click-filters below, which query
  // the backend directly via fetchPage() rather than filtering this cache —
  // the cache only holds the most recent 200 calls, not the full history a
  // status filter should search.
  const recentCalls = useCallsStore((s) => s.recent);
  const fetchCallsPage = useCallsStore((s) => s.fetchPage);
  // Same precedence the topbar uses: the live socket count when it's
  // actually flowing, the dashboard KPI snapshot otherwise. Needed because
  // the call log (`recentCalls`, and `filtered` below) is a completed-call
  // record — it can never contain an in-progress call, so summing it for
  // "Live" always reads 0. See the comment on CallSummaryTable's `liveNow`
  // prop for the rest of this story.
  const kpis = useCallsStore((s) => s.kpis);
  const socketLiveCount = useCallsStore((s) => s.liveCount);
  const liveNow = socketLiveCount > 0 ? socketLiveCount : (kpis?.liveCalls ?? 0);

  const filtered = useMemo(() => {
    const start = dateRange?.from ? startOfDay(dateRange.from).getTime() : -Infinity;
    const end = dateRange?.from
      ? endOfDay(dateRange.to ?? dateRange.from).getTime()
      : Infinity;

    const campaignSet = new Set(filters.campaignIds);
    const buyerSet = new Set(filters.buyerIds);
    const publisherSet = new Set(filters.publisherIds);
    const statusSet = new Set(filters.statuses);

    return recentCalls.filter((c) => {
      if (c.startedAt < start || c.startedAt > end) return false;
      if (campaignSet.size > 0 && !campaignSet.has(c.campaignId)) return false;
      if (buyerSet.size > 0 && (!c.buyerId || !buyerSet.has(c.buyerId))) return false;
      if (publisherSet.size > 0 && (!c.publisherId || !publisherSet.has(c.publisherId))) {
        return false;
      }
      if (statusSet.size > 0 && !statusSet.has(c.status)) return false;
      return true;
    });
  }, [dateRange, filters, recentCalls]);

  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, c) => s + c.revenue, 0);
    const payout = filtered.reduce((s, c) => s + c.payout, 0);
    return { revenue, payout };
  }, [filtered]);

  // Connected / Qualified query the backend directly (GET /api/analytics/calls
  // with status=ANSWERED or is_qualified=true) rather than filtering the
  // client cache — see the comment on `recentCalls` above. Not Connected has
  // no backend param in the contract yet, so it stays a client-side filter.
  const [remoteLogCalls, setRemoteLogCalls] = useState<Call[] | null>(null);
  const [logLoading, setLogLoading] = useState(false);

  useEffect(() => {
    if (statusFilter !== "connected" && statusFilter !== "qualified") {
      setRemoteLogCalls(null);
      setLogLoading(false);
      return;
    }

    let cancelled = false;
    setLogLoading(true);

    const fromIso = dateRange?.from ? new Date(dateRange.from).toISOString().slice(0, 10) : undefined;
    const toIso = dateRange?.to
      ? new Date(dateRange.to).toISOString().slice(0, 10)
      : fromIso;

    // NOTE: campaign/buyer/publisher and the toolbar's own status multi-select
    // aren't threaded through here — CallLogQuery only takes one id per field,
    // not the arrays this page's filter popover collects, so there's no way to
    // serialize a multi-select into this request without guessing a wire
    // format the backend hasn't specified. Clicking a total currently searches
    // the full account within the date range, not "within the campaigns I've
    // also filtered to" — flagged here rather than silently narrowed wrong.
    fetchCallsPage({
      pageSize: 200,
      dateFrom: fromIso,
      dateTo: toIso,
      ...callStatusFilterToQuery(statusFilter),
    })
      .then((result) => {
        if (cancelled) return;
        setRemoteLogCalls(result.items);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(friendlyErrorMessage(e, "Couldn't load filtered calls"));
        setRemoteLogCalls([]);
      })
      .finally(() => {
        if (!cancelled) setLogLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [statusFilter, dateRange, fetchCallsPage]);

  // Narrows the Call Log to whichever Call Summary total was clicked. The
  // summary's own totals keep reading from `filtered` unfiltered by this —
  // clicking "Qualified" shows only qualified calls below, it doesn't shrink
  // the Qualified total itself to match.
  const logCalls = useMemo(() => {
    if (statusFilter === "notConnected") {
      return filtered.filter((c) => matchesCallStatusFilter(c, "notConnected"));
    }
    if (statusFilter === "connected" || statusFilter === "qualified") {
      // While the request is in flight (or hasn't resolved yet), show
      // nothing rather than flashing the full unfiltered list — `logLoading`
      // drives the actual loading row in CallLogTable.
      return remoteLogCalls ?? [];
    }
    return filtered;
  }, [filtered, statusFilter, remoteLogCalls]);

  // The PIN gate trips when the requested range starts before today's
  // midnight. Today-only views always pass through.
  const needsPin = useMemo(() => {
    if (!dateRange?.from) return false;
    const todayStart = startOfDay(new Date()).getTime();
    return startOfDay(dateRange.from).getTime() < todayStart;
  }, [dateRange]);

  const cancelHistorical = () => {
    const today = new Date();
    setDateRange({ from: today, to: today });
  };

  return (
    <>
      <PageHeader
        title={t("page.reports.title")}
        description={t("page.reports.description")}
      />

      <ReportsToolbar
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        onRefresh={() => toast.success(t("page.reports.refreshed"))}
        filters={filters}
        onFiltersChange={setFilters}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        liveNow={liveNow}
      />

      <ReportsPinGate needsPin={needsPin} onCancel={cancelHistorical}>
        {/* Row 1 — Hourly distribution (2/3) + perf card over donut (1/3).
            On mobile, only one of the two charts is shown at a time and the
            toggle button below the toolbar swaps between them. */}
        {(visibility.hourly || visibility.donut || visibility.perf) && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(visibility.hourly || visibility.donut) && (
              /* lg:h-full so the chart matches the stacked cards beside it.
                 Scoped to lg — on mobile the columns stack and each sizes
                 to its own content. */
              <div className="relative lg:col-span-2 lg:h-full">
                {/* Mobile-only chart switcher — only matters when both are visible */}
                {visibility.hourly && visibility.donut && (
                  <button
                    type="button"
                    onClick={() =>
                      setMobileChart((v) => (v === "hourly" ? "donut" : "hourly"))
                    }
                    aria-label={
                      mobileChart === "hourly"
                        ? "Show total calls donut"
                        : "Show hourly distribution"
                    }
                    className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:bg-secondary hover:text-foreground lg:hidden"
                  >
                    {mobileChart === "hourly" ? (
                      <PieChart className="h-4 w-4" />
                    ) : (
                      <BarChart3 className="h-4 w-4" />
                    )}
                  </button>
                )}
                {visibility.hourly && (
                  <div
                    className={cn(
                      visibility.donut && mobileChart === "donut" ? "hidden" : "block",
                      "lg:block lg:h-full",
                    )}
                  >
                    <HourlyDistribution calls={filtered} className="lg:h-full" />
                  </div>
                )}
                {visibility.donut && (
                  <div
                    className={cn(
                      visibility.hourly && mobileChart === "hourly" ? "hidden" : "block",
                      "lg:hidden",
                    )}
                  >
                    <TotalCallsDonut calls={filtered} />
                  </div>
                )}
              </div>
            )}
            {(visibility.perf || visibility.donut) && (
              <div className="flex flex-col gap-4 lg:h-full">
                {visibility.perf && (
                  <CallPerfCard revenue={summary.revenue} payout={summary.payout} />
                )}
                {visibility.donut && (
                  <div className="hidden min-h-0 flex-1 lg:block">
                    <TotalCallsDonut calls={filtered} />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {visibility.summary && (
          <CallSummaryTable
            calls={filtered}
            activeStatusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            liveNow={liveNow}
          />
        )}

        {/* Lives at the page level, not inside CallSummaryTable, so it's
            reachable to clear the filter even if the operator hides the
            summary card via the toolbar's view-settings toggle. */}
        {statusFilter && (
          <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
            <span className="text-muted-foreground">
              {t("toolsUI.reports.summary.filteredBy")}{" "}
              <span className="font-semibold text-accent">
                {t(STATUS_FILTER_LABEL_KEYS[statusFilter])}
              </span>
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 gap-1 px-2 text-xs"
              onClick={() => setStatusFilter(null)}
            >
              <X className="h-3 w-3" />
              {t("toolsUI.reports.summary.resetFilter")}
            </Button>
          </div>
        )}

        {visibility.log && <CallLogTable calls={logCalls} loading={logLoading} />}
      </ReportsPinGate>
    </>
  );
}

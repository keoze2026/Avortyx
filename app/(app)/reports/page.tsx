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
import {
  analyticsService,
  type CallLogQuery,
  type EntitySummary,
  type SummaryEntity,
} from "@/lib/api/services/analytics.service";
import { billingService } from "@/lib/api/services/billing.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { matchesCallStatusFilter, type CallStatusFilter } from "@/lib/call-status";
import { calendarDayKey, dayKeyToLocalDate, zonedDayKey } from "@/lib/format";
import { useCallsStore } from "@/lib/store/calls-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Reuses the Call Summary's own column labels so the reset strip names the
 *  active filter with the exact word the operator just clicked. */
const STATUS_FILTER_LABEL_KEYS: Record<CallStatusFilter, string> = {
  connected: "toolsUI.reports.summary.columns.connected",
  qualified: "toolsUI.reports.summary.columns.qualified",
  notConnected: "toolsUI.reports.summary.columns.noConnect",
};

export default function ReportsPage() {
  const { t } = useTranslation();
  // Every reporting surface on this page renders in this timezone (the Call
  // Log's timestamps, the hourly chart's buckets) — "today" has to mean
  // today in that zone too, or an operator ahead of it opens on tomorrow.
  const timeZone = useUIStore((s) => s.reportTimezone);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = dayKeyToLocalDate(zonedDayKey(Date.now(), timeZone));
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

  // Same precedence the topbar uses: the live socket count when it's
  // actually flowing, the dashboard KPI snapshot otherwise. Needed because
  // the call log (`rangeCalls`, and `filtered` below) is a completed-call
  // record — it can never contain an in-progress call, so summing it for
  // "Live" always reads 0. See the comment on CallSummaryTable's `liveNow`
  // prop for the rest of this story.
  const kpis = useCallsStore((s) => s.kpis);
  const socketLiveCount = useCallsStore((s) => s.liveCount);
  const liveNow = socketLiveCount > 0 ? socketLiveCount : (kpis?.liveCalls ?? 0);

  // The picker's values are calendar days — read their Y-M-D directly.
  // Converting `getTime()` through the report zone shifted the key a day
  // earlier for any browser ahead of that zone (see `calendarDayKey`).
  const fromKey = dateRange?.from ? calendarDayKey(dateRange.from) : undefined;
  const toKey = dateRange?.to ? calendarDayKey(dateRange.to) : fromKey;

  // The page's base dataset — every call in the selected range, fetched
  // directly from the backend. This used to read from the shared calls
  // store's `recent` cache (the most recent 200 calls *account-wide*, not
  // scoped to any date range) filtered client-side by a browser-local-time
  // day boundary. On a day with more than 200 calls total recently, or for
  // an operator whose browser timezone doesn't match the report timezone,
  // that silently dropped or misdated real rows — which is exactly the "DB
  // says 146, portal shows 113" gap this replaces.
  const [rangeCalls, setRangeCalls] = useState<Call[]>([]);
  const [rangeLoading, setRangeLoading] = useState(false);
  // The backend's per-entity aggregates for the same range — the Call
  // Summary's Campaign / Buyer / Publisher tabs read their counters from
  // these rather than re-deriving them from the call log (the two disagreed
  // on Qualified, and Dupe only exists server-side).
  const [summaries, setSummaries] = useState<Record<SummaryEntity, EntitySummary[]>>({
    campaign: [],
    buyer: [],
    publisher: [],
    carrier: [],
  });

  // The account's telco rate, for the Call Summary's Cost column
  // (per_minute_rate × talk minutes — see CallSummaryTable). Fetched once:
  // it's an account-level figure, not per range.
  const [perMinuteRate, setPerMinuteRate] = useState<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    billingService
      .account()
      .then((a) => {
        if (!cancelled) setPerMinuteRate(a.rates?.perMinute);
      })
      .catch(() => {
        // Leave undefined — Cost and Net render "—" rather than $0.00.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!fromKey) {
      setSummaries({ campaign: [], buyer: [], publisher: [], carrier: [] });
      return;
    }
    let cancelled = false;
    const range = { dateFrom: fromKey, dateTo: toKey };
    // Each one is independent — a failing endpoint just leaves its tab on
    // the call-log derivation instead of blanking the others.
    Promise.all(
      (["campaign", "buyer", "publisher", "carrier"] as const).map((entity) =>
        analyticsService.entitySummary(entity, range).catch(() => [] as EntitySummary[]),
      ),
    ).then(([campaign, buyer, publisher, carrier]) => {
      if (!cancelled) setSummaries({ campaign, buyer, publisher, carrier });
    });
    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey]);

  // An aggregate is per entity for the whole range; it can't be narrowed by
  // the other filters. So a tab only gets its aggregate when the only active
  // entity filter (if any) is its own — then it just picks the matching
  // rows — and no status filter is set.
  const summariesForTable = useMemo(() => {
    if (filters.statuses.length > 0) return undefined;
    const active: Record<SummaryEntity, string[]> = {
      campaign: filters.campaignIds,
      buyer: filters.buyerIds,
      publisher: filters.publisherIds,
      // There's no carrier filter on the page, so the carrier aggregate is
      // used whenever no entity filter at all is active.
      carrier: [],
    };
    const out: Partial<Record<SummaryEntity, EntitySummary[]>> = {};
    for (const entity of ["campaign", "buyer", "publisher", "carrier"] as const) {
      const othersActive = (Object.keys(active) as SummaryEntity[]).some(
        (k) => k !== entity && active[k].length > 0,
      );
      if (othersActive) continue;
      const own = new Set(active[entity]);
      out[entity] = own.size > 0 ? summaries[entity].filter((r) => own.has(r.entityId)) : summaries[entity];
    }
    return out;
  }, [filters, summaries]);

  useEffect(() => {
    if (!fromKey) {
      setRangeCalls([]);
      return;
    }
    let cancelled = false;
    setRangeLoading(true);
    analyticsService
      .allCalls({ dateFrom: fromKey, dateTo: toKey }, { timeZone })
      .then((items) => {
        if (!cancelled) setRangeCalls(items);
      })
      .catch((e) => {
        if (cancelled) return;
        toast.error(friendlyErrorMessage(e, "Couldn't load calls for this range"));
        setRangeCalls([]);
      })
      .finally(() => {
        if (!cancelled) setRangeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromKey, toKey, timeZone]);

  const filtered = useMemo(() => {
    const campaignSet = new Set(filters.campaignIds);
    const buyerSet = new Set(filters.buyerIds);
    const publisherSet = new Set(filters.publisherIds);
    const statusSet = new Set(filters.statuses);

    // Date scoping already happened server-side (dateFrom/dateTo above) — no
    // client-side day-boundary re-check here, since that's what applied the
    // wrong (browser-local) timezone in the first place.
    return rangeCalls.filter((c) => {
      if (campaignSet.size > 0 && !campaignSet.has(c.campaignId)) return false;
      if (buyerSet.size > 0 && (!c.buyerId || !buyerSet.has(c.buyerId))) return false;
      if (publisherSet.size > 0 && (!c.publisherId || !publisherSet.has(c.publisherId))) {
        return false;
      }
      if (statusSet.size > 0 && !statusSet.has(c.status)) return false;
      return true;
    });
  }, [filters, rangeCalls]);

  const summary = useMemo(() => {
    const revenue = filtered.reduce((s, c) => s + c.revenue, 0);
    const payout = filtered.reduce((s, c) => s + c.payout, 0);
    return { revenue, payout };
  }, [filtered]);

  // Narrows the Call Log to whichever Call Summary total was clicked. The
  // summary's own totals keep reading from `filtered` unfiltered by this —
  // clicking "Qualified" shows only qualified calls below, it doesn't shrink
  // the Qualified total itself to match.
  //
  // All three filters are applied client-side to the exact same `filtered`
  // set the Call Summary counted, with the exact same predicate
  // (`matchesCallStatusFilter`). Connected and Qualified used to fire a
  // separate backend query instead (`status=completed` / `is_qualified=true`)
  // — a second definition of the same bucket, on a dataset that ignored the
  // campaign/buyer/publisher filters the summary respected, and keyed on an
  // `is_qualified` field the CDR payload doesn't carry. Two definitions meant
  // the total said 64 and the list underneath it showed something else. One
  // predicate over one dataset makes that disagreement impossible.
  const logCalls = useMemo(() => {
    if (!statusFilter) return filtered;
    return filtered.filter((c) => matchesCallStatusFilter(c, statusFilter));
  }, [filtered, statusFilter]);

  const exportQuery = useMemo<Omit<CallLogQuery, "page" | "pageSize"> | null>(() => {
    if (!fromKey) return null;
    if (filters.campaignIds.length > 1 || filters.buyerIds.length > 1 || filters.publisherIds.length > 1) {
      return null;
    }
    if (filters.statuses.length > 0) return null;
    if (statusFilter === "notConnected") return null;
    return {
      dateFrom: fromKey,
      dateTo: toKey,
      campaignId: filters.campaignIds[0],
      buyerId: filters.buyerIds[0],
      publisherId: filters.publisherIds[0],
      status: statusFilter === "connected" ? "completed" : undefined,
      isQualified: statusFilter === "qualified" ? true : undefined,
    };
  }, [fromKey, toKey, filters, statusFilter]);

  // The PIN gate trips when the requested range starts before today's
  // midnight *in the report timezone* — Today-only views always pass
  // through. Comparing "YYYY-MM-DD" keys instead of raw timestamps sidesteps
  // the browser-local-vs-report-timezone mismatch a plain Date comparison
  // would reintroduce.
  const needsPin = useMemo(() => {
    if (!fromKey) return false;
    return fromKey < zonedDayKey(Date.now(), timeZone);
  }, [fromKey, timeZone]);

  const cancelHistorical = () => {
    const today = dayKeyToLocalDate(zonedDayKey(Date.now(), timeZone));
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
            summaries={summariesForTable}
            perMinuteRate={perMinuteRate}
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

        {visibility.log && (
          <CallLogTable
            calls={logCalls}
            loading={rangeLoading}
            exportQuery={exportQuery}
            // Manual hang-up: refresh the row in place from the backend's
            // final state (status / duration / charged) rather than waiting
            // for the next poll.
            onCallPatched={(id, patch) =>
              setRangeCalls((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
            }
          />
        )}
      </ReportsPinGate>
    </>
  );
}
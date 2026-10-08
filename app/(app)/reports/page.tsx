"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { DateRange } from "react-day-picker";
import { BarChart3, Loader2, PieChart, X } from "lucide-react";
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
import type { CallLogQuery, EntitySummary, SummaryEntity } from "@/lib/api/services/analytics.service";
import { ApiError, friendlyErrorMessage } from "@/lib/api/errors";
import { matchesCallStatusFilter, type CallStatusFilter } from "@/lib/call-status";
import { ROUTES } from "@/lib/constants";
import { calendarDayKey, dayKeyToLocalDate, zonedDayKey } from "@/lib/format";
import { REPORTS_POLICY, latestReportDay, latestReportDayKey } from "@/lib/reports-policy";
import { getCachedReport, loadReportShared, prefetchReport, reportKey, todayAndYesterday } from "@/lib/reports-cache";
import { useCallsStore } from "@/lib/store/calls-store";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReportsAccess } from "@/lib/store/security-store";
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

/** Shown while the data on hand belongs to a different range (stable references). */
const NO_RANGE_CALLS: Call[] = [];
const NO_SUMMARIES: Record<SummaryEntity, EntitySummary[]> = { campaign: [], buyer: [], publisher: [], carrier: [] };

export default function ReportsPage() {
  const role = useAuthStore((st) => st.user?.role);
  const { t } = useTranslation();
  // Every reporting surface on this page renders in this timezone (the Call
  // Log's timestamps, the hourly chart's buckets) — "today" has to mean
  // today in that zone too, or an operator ahead of it opens on tomorrow.
  const timeZone = useUIStore((s) => s.reportTimezone);
  const router = useRouter();
  // Reports covers completed days only (see lib/reports-policy.ts): the newest
  // day that can be picked is yesterday, and that is where the page opens.
  const latestKey = latestReportDayKey(timeZone);
  const latestDay = useMemo(() => latestReportDay(timeZone), [timeZone, latestKey]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const day = latestReportDay(timeZone);
    return { from: day, to: day };
  });
  // A range that reaches past the newest allowed day (the time zone changed, or
  // midnight passed while the page was open) is pulled back to it.
  useEffect(() => {
    if (!dateRange?.from) return;
    const to = calendarDayKey(dateRange.to ?? dateRange.from);
    if (to <= latestKey) return;
    const from = calendarDayKey(dateRange.from) > latestKey ? latestDay : dateRange.from;
    setDateRange({ from, to: latestDay });
  }, [dateRange, latestKey, latestDay]);
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

  // The PIN applies when the requested range starts before today's midnight
  // *in the report timezone*. Comparing "YYYY-MM-DD" keys instead of raw
  // timestamps sidesteps the browser-local-vs-report-timezone mismatch a
  // plain Date comparison would reintroduce.
  const needsPin = useMemo(() => {
    if (!fromKey) return false;
    return fromKey < zonedDayKey(Date.now(), timeZone);
  }, [fromKey, timeZone]);

  // The PIN is held by the server. Nothing is requested while the range is
  // locked (the server would refuse it anyway), and what is already on screen
  // is dropped the moment the page locks.
  const access = useReportsAccess(needsPin);

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

  /*
   * One load per VIEW (range + time zone). The call list and the four
   * aggregates are fetched together and put on screen together, and the data
   * on screen is always tagged with the view it belongs to:
   *
   *   - the moment the range changes, nothing from the previous range is
   *     shown any more (it isn't cleared later, when a response lands - it is
   *     never rendered under the new range at all);
   *   - every load gets a number; a response from a load that has since been
   *     replaced is thrown away, so a slow answer for the old day can never
   *     land on top of the new one;
   *   - a refresh (auto or manual) is skipped while a load is in flight, and
   *     re-loads the SAME view, keeping its current figures until the new
   *     ones arrive - all at once.
   *
   * Before, the summary table and the call log each kept the previous day on
   * screen until their own request finished, at different moments, so for a
   * few seconds the page showed a mix of two days.
   */
  const viewKey = fromKey && access.canFetch ? `${fromKey}|${toKey ?? fromKey}|${timeZone}` : "";
  const [loadedKey, setLoadedKey] = useState("");
  const [refreshTick, setRefreshTick] = useState(0);
  // Saved data of exactly this view (lib/reports-cache.ts): shown at once while
  // the fresh copy loads behind it - never another day's figures.
  const userId = useAuthStore((s) => s.user?.id);
  const view = useMemo(() => {
    if (!viewKey) return null;
    const [dateFrom, dateTo, zone] = viewKey.split("|");
    return { dateFrom, dateTo, timeZone: zone };
  }, [viewKey]);
  const cached = useMemo(
    () => (view ? getCachedReport(reportKey(view)) : null),
    // loadedKey: re-read after every load, so the saved copy is the newest one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [view, userId, loadedKey],
  );
  const loadSeq = useRef(0);
  const loadInFlight = useRef(false);
  const manualRefresh = useRef(false);

  useEffect(() => {
    if (!viewKey) {
      loadSeq.current += 1; // anything still in flight is now stale
      loadInFlight.current = false;
      setRangeLoading(false);
      return;
    }
    const seq = ++loadSeq.current;
    loadInFlight.current = true;
    setRangeLoading(true);
    const current = view!;
    // Shared with a prefetch of the same view: one download, not two.
    loadReportShared(current)
      .then((data) => {
        if (seq !== loadSeq.current) return; // replaced by a newer load
        setRangeCalls(data.calls);
        setSummaries(data.summaries);
        setLoadedKey(viewKey);
        if (manualRefresh.current) toast.success(t("page.reports.refreshed"));
        // Load the other of today / yesterday in advance - the switch people
        // make most - so it opens instantly too (skipped while history is
        // locked behind the reports PIN).
        for (const other of todayAndYesterday(current.timeZone)) {
          if (other.dateFrom !== current.dateFrom || other.dateTo !== current.dateTo) prefetchReport(other);
        }
      })
      .catch((e) => {
        if (seq !== loadSeq.current) return;
        // 423: the server wants the PIN. The lock screen takes over, so no
        // error toast - the security store has already been told.
        if (!(e instanceof ApiError && e.status === 423)) {
          toast.error(friendlyErrorMessage(e, "Couldn't load calls for this range"));
        }
      })
      .finally(() => {
        if (seq !== loadSeq.current) return;
        loadInFlight.current = false;
        manualRefresh.current = false;
        setRangeLoading(false);
      });
    // No cleanup: a newer load bumps loadSeq, which is what discards this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewKey, refreshTick]);

  /** True only for data that belongs to the range on screen right now. */
  const showingView = viewKey !== "" && loadedKey === viewKey;
  // This view's fresh data, else its saved copy, else nothing - never another view's.
  const viewCalls = showingView ? rangeCalls : (cached?.calls ?? NO_RANGE_CALLS);
  const viewSummaries = showingView ? summaries : (cached?.summaries ?? NO_SUMMARIES);
  /** Loading a range with nothing to show yet (not a refresh, no saved copy). */
  const switchingView = rangeLoading && !showingView && !cached;

  // A range that ends before today never changes, so the timer does not reload
  // it; a click on Refresh always does. Never while a load is running.
  const includesToday = !!toKey && toKey >= zonedDayKey(Date.now(), timeZone);
  const onRefresh = (source: "auto" | "manual" = "manual") => {
    if (!viewKey || loadInFlight.current) return;
    if (source === "auto" && !includesToday) return;
    manualRefresh.current = source === "manual";
    setRefreshTick((n) => n + 1);
  };

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
      out[entity] = own.size > 0 ? viewSummaries[entity].filter((r) => own.has(r.entityId)) : viewSummaries[entity];
    }
    return out;
  }, [filters, viewSummaries]);

  const filtered = useMemo(() => {
    const campaignSet = new Set(filters.campaignIds);
    const buyerSet = new Set(filters.buyerIds);
    const publisherSet = new Set(filters.publisherIds);
    const statusSet = new Set(filters.statuses);

    // Date scoping already happened server-side (dateFrom/dateTo above) — no
    // client-side day-boundary re-check here, since that's what applied the
    // wrong (browser-local) timezone in the first place.
    return viewCalls.filter((c) => {
      if (campaignSet.size > 0 && !campaignSet.has(c.campaignId)) return false;
      if (buyerSet.size > 0 && (!c.buyerId || !buyerSet.has(c.buyerId))) return false;
      if (publisherSet.size > 0 && (!c.publisherId || !publisherSet.has(c.publisherId))) {
        return false;
      }
      if (statusSet.size > 0 && !statusSet.has(c.status)) return false;
      return true;
    });
  }, [filters, viewCalls]);

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

  // Backing out of the PIN screen. Where today can be shown, drop back to
  // today; otherwise there is nothing to show here, so go to the Dashboard.
  const cancelHistorical = () => {
    if (REPORTS_POLICY.includeToday) {
      const today = dayKeyToLocalDate(zonedDayKey(Date.now(), timeZone));
      setDateRange({ from: today, to: today });
    } else {
      router.push(ROUTES.dashboard);
    }
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
        onRefresh={onRefresh}
        filters={filters}
        onFiltersChange={setFilters}
        visibility={visibility}
        onVisibilityChange={setVisibility}
        liveNow={liveNow}
        showLive={REPORTS_POLICY.showLive}
        latestDay={latestDay}
      />

      <ReportsPinGate
        needsPin={needsPin}
        onCancel={cancelHistorical}
        cancelLabel={REPORTS_POLICY.includeToday ? undefined : "Back to dashboard"}
      >
        {/* A new range is loading: nothing from the previous range is shown,
            and this says so instead of the panels reading as "no calls". */}
        {switchingView && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("common.loadingRange").replace("{range}", fromKey === toKey || !toKey ? (fromKey ?? "") : `${fromKey} – ${toKey}`)}
          </div>
        )}
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
                  <CallPerfCard
                    revenue={role === "publisher" ? null : summary.revenue}
                    payout={role === "buyer" ? null : summary.payout}
                  />
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
            showLive={REPORTS_POLICY.showLive}
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
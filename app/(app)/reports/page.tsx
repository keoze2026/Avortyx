"use client";

import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { BarChart3, PieChart } from "lucide-react";
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
import { useTranslation } from "@/hooks/use-translation";
import { useCallsStore } from "@/lib/store/calls-store";
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

export default function ReportsPage() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => {
    const today = new Date();
    return { from: today, to: today };
  });
  const [filters, setFilters] = useState<ReportFilters>(EMPTY_FILTERS);
  const [visibility, setVisibility] = useState<ReportsVisibility>(DEFAULT_REPORTS_VISIBILITY);
  // Mobile-only chart switch — desktop always shows both. The donut is hidden
  // on mobile because it eats vertical real-estate; the toggle button below
  // swaps which chart occupies the main slot.
  const [mobileChart, setMobileChart] = useState<"hourly" | "donut">("hourly");

  // Reads from the shared calls store (populated by the StoreHydrator on app
  // mount). Filtering happens client-side for the cached slice; the Call Log
  // table at the bottom of this page pages directly against the backend.
  const recentCalls = useCallsStore((s) => s.recent);

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

        {visibility.summary && <CallSummaryTable calls={filtered} />}

        {visibility.log && <CallLogTable calls={filtered} />}
      </ReportsPinGate>
    </>
  );
}

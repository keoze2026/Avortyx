"use client";

import { useEffect, useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DestinationSummaryTable } from "@/components/dashboard/destination-summary-table";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopCampaignsBars } from "@/components/dashboard/top-campaigns-bars";
import { VerticalDonut } from "@/components/dashboard/vertical-donut";
import { CallPerfCard } from "@/components/reports/call-perf-card";
import { HourlyDistribution } from "@/components/reports/hourly-distribution";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { PageHeader } from "@/components/shared/page-header";
import { TimezonePicker } from "@/components/shared/timezone-picker";
import { useTranslation } from "@/hooks/use-translation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { analyticsService } from "@/lib/api/services/analytics.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { calendarDayKey, dayKeyToLocalDate, toE164, zonedDayKey } from "@/lib/format";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call } from "@/lib/types";

const ALL_DEST = "all";

/** Re-pull the selected day while it's today, so live traffic keeps landing
 *  on the dashboard without a reload. Historical days don't change. */
const TODAY_REFRESH_MS = 30_000;

export default function DashboardPage() {
  const { t } = useTranslation();
  const destinations = useDestinationsStore((s) => s.destinations);
  // Buyers (live) — for the destination-dropdown label "buyer name" column.
  const buyers = useBuyersStore((s) => s.buyers);
  const buyerById = useMemo(() => new Map(buyers.map((b) => [b.id, b])), [buyers]);
  const [destinationTfn, setDestinationTfn] = useState<string>(ALL_DEST);
  const allSelected = destinationTfn === ALL_DEST;

  // The dashboard is scoped to one date range — default today — chosen from
  // the same preset picker as Reports (Today, Yesterday, This week, Last 7
  // days, …, Custom range). Applying a range is what triggers the backend
  // query below; nothing is filtered client-side by date.
  //
  // "Today" is today *in the report timezone* (the zone every chart and the
  // Call Log render in), so an operator in Tokyo reporting on New York time
  // opens on New York's current day. The picked dates are calendar days,
  // and their "YYYY-MM-DD" keys are read straight off the calendar values —
  // never via `date.getTime()` + a timezone, which shifts the day for any
  // browser ahead of the report zone (see `calendarDayKey`). Those keys are
  // what's sent to the API as date_from / date_to.
  const timeZone = useUIStore((s) => s.reportTimezone);
  const todayKey = zonedDayKey(Date.now(), timeZone);
  const today = useMemo(() => dayKeyToLocalDate(todayKey), [todayKey]);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => ({ from: today, to: today }));
  const fromKey = dateRange?.from ? calendarDayKey(dateRange.from) : todayKey;
  const toKey = dateRange?.to ? calendarDayKey(dateRange.to) : fromKey;
  /** The range is exactly today — live counters apply and the view auto-refreshes. */
  const isToday = fromKey === todayKey && toKey === todayKey;
  /** The range ends today (or later), so new calls can still land in it. */
  const includesToday = toKey >= todayKey;

  // The range's calls, fetched from the backend for exactly fromKey..toKey.
  // This used to read the calls store's `recent` cache — the most recent 200
  // calls account-wide, with no date sent to the API — and filter it
  // client-side to the picked day. Any date older than what happened to be
  // in those 200 rows was empty by construction, which is why every
  // historical date showed 0 calls / $0 across the whole page.
  const [dayCalls, setDayCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async (showSpinner: boolean) => {
      if (showSpinner) setLoading(true);
      try {
        const items = await analyticsService.allCalls({ dateFrom: fromKey, dateTo: toKey }, { timeZone });
        if (!cancelled) setDayCalls(items);
      } catch (e) {
        if (cancelled) return;
        toast.error(friendlyErrorMessage(e, "Couldn't load calls for this date range"));
        setDayCalls([]);
      } finally {
        if (!cancelled && showSpinner) setLoading(false);
      }
    };
    void load(true);
    if (!includesToday) return () => { cancelled = true; };
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(false);
    }, TODAY_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [fromKey, toKey, includesToday, timeZone]);

  // Calls per destination TFN in the selected range — the secondary label in
  // the destination dropdown, so the operator can see which TFNs were hot
  // in the span they're looking at. For today the count comes straight off
  // the Destination record (`calls_today` from the destinations API), which
  // includes in-flight calls a completed-call log can't; for any other
  // range it's tallied from the range's fetched calls.
  const callsByTfn = useMemo(() => {
    const map = new Map<string, number>();
    // Keyed by E.164 so a CDR that spells the number "18779641530" still
    // matches a destination stored as "+18779641530".
    if (isToday) {
      for (const d of destinations) map.set(toE164(d.tfn), d.dailyCalls);
      return map;
    }
    for (const c of dayCalls) {
      const k = toE164(c.destinationNumber);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [dayCalls, destinations, isToday]);

  // When a destination is selected, scope everything to just its calls.
  const scopedCalls = useMemo(() => {
    if (allSelected) return dayCalls;
    const wanted = toE164(destinationTfn);
    return dayCalls.filter((c) => toE164(c.destinationNumber) === wanted);
  }, [destinationTfn, allSelected, dayCalls]);

  const summary = useMemo(() => ({
    revenue: scopedCalls.reduce((s, c) => s + c.revenue, 0),
    payout: scopedCalls.reduce((s, c) => s + c.payout, 0),
  }), [scopedCalls]);

  const dateLabel = isToday
    ? t("sharedUI.dateRange.today")
    : fromKey === toKey
      ? fromKey
      : `${fromKey} ~ ${toKey}`;

  return (
    <>
      <PageHeader
        title={t("page.dashboard.title")}
        description={t("page.dashboard.description")}
        actions={
          <>
            <TimezonePicker />
            <Select value={destinationTfn} onValueChange={setDestinationTfn}>
              <SelectTrigger size="sm" className="w-[20rem]">
                <SelectValue placeholder={t("dashboard.allDestinations")} />
              </SelectTrigger>
              <SelectContent align="end" className="max-h-80">
                <SelectItem value={ALL_DEST}>{t("dashboard.allDestinations")}</SelectItem>
                {destinations.map((d) => {
                  const buyer = buyerById.get(d.buyerId);
                  const calls = callsByTfn.get(toE164(d.tfn)) ?? 0;
                  return (
                    <SelectItem key={d.id} value={d.tfn}>
                      <span className="flex items-center gap-2">
                        <span className="font-medium">{d.name}</span>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {d.tfn}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {buyer?.name ?? d.buyerName ?? "—"} · {calls} {t("dashboard.callsToday")}
                        </span>
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <DateRangePicker value={dateRange} onChange={setDateRange} today={today} />
          </>
        }
      />

      {/* Row 1 — Hourly CALLS chart (primary) + donut on the right.
          Uses the same composed-chart component as the Reports page so the
          two surfaces share an identical visual language. */}
      <div
        className="grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-3"
        style={loading ? { opacity: 0.6 } : undefined}
        aria-busy={loading}
      >
        {/* h-full on both wrapper and card so the chart matches the height of
            the two stacked cards beside it; the chart then centres in the
            extra space rather than leaving a gap at the bottom. */}
        <div className="h-full lg:col-span-2">
          <HourlyDistribution calls={scopedCalls} className="h-full" />
        </div>
        <div className="flex h-full min-w-0 flex-col gap-4">
          <CallPerfCard revenue={summary.revenue} payout={summary.payout} />
          <div className="min-h-0 flex-1">
            <VerticalDonut calls={scopedCalls} />
          </div>
        </div>
      </div>

      {/* Row 2 — Top campaigns + Revenue by hour (secondary) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <TopCampaignsBars calls={scopedCalls} dateLabel={dateLabel} />
        <RevenueChart calls={scopedCalls} dateLabel={dateLabel} />
      </div>

      {/* Row 3 — Destinations table (each TFN with its own CC and Cap) */}
      <DestinationSummaryTable
        calls={dayCalls}
        dateLabel={dateLabel}
        useLiveCounters={isToday}
        destinationFilter={allSelected ? undefined : destinationTfn}
      />
    </>
  );
}

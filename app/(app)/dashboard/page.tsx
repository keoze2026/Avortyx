"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { toast } from "sonner";

import { DestinationSummaryTable } from "@/components/dashboard/destination-summary-table";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { TopCampaignsBars } from "@/components/dashboard/top-campaigns-bars";
import { VerticalDonut } from "@/components/dashboard/vertical-donut";
import { CallPerfCard } from "@/components/reports/call-perf-card";
import { HourlyDistribution } from "@/components/reports/hourly-distribution";
import { ReportsPinGate } from "@/components/reports/reports-pin-gate";
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
import type { DashboardSnapshot } from "@/lib/api/services/analytics.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { getCachedSnapshot, loadSnapshotShared, snapshotKey } from "@/lib/dashboard-snapshot";
import { isPinRequiredError } from "@/lib/reports-scope";
import { calendarDayKey, dayKeyToLocalDate, toE164, zonedDayKey } from "@/lib/format";
import { useAuthStore } from "@/lib/store/auth-store";
import { useReportsAccess } from "@/lib/store/security-store";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useCallsStore } from "@/lib/store/calls-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import { useUIStore } from "@/lib/store/ui-store";
import type { Call, Destination } from "@/lib/types";

const NO_CALLS: Call[] = [];

const ALL_DEST = "all";

/** Re-pull the selected day while it's today, so live traffic keeps landing
 *  on the dashboard without a reload. Historical days don't change. */
const TODAY_REFRESH_MS = 15_000;
/** Also re-pull when the live-call count changes (a call started or ended) -
 *  but never more often than this. */
const LIVE_CHANGE_MIN_GAP_MS = 8_000;
/** Coming back to the tab re-pulls if the figures are older than this. */
const RETURN_REFRESH_MIN_GAP_MS = 10_000;

/** useLayoutEffect on the client (paints cached figures before the first frame),
 *  useEffect on the server (where layout effects only warn). */
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

/** Empty, stable: the destinations table while a non-today view is loading. */
const NO_DESTINATIONS: Destination[] = [];

const countsOf = (snap: DashboardSnapshot) =>
  new Map(snap.destinations.map((d) => [toE164(d.tfn), d.dailyCalls] as [string, number]));

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
  // Today is open to everyone; any range that starts earlier is history, which
  // needs the reports PIN once one exists (the server refuses it otherwise).
  const needsPin = fromKey < todayKey;
  const access = useReportsAccess(needsPin);
  /** False only while history is locked - then nothing is requested or shown. */
  const mayLoad = !needsPin || access.canFetch;

  // Every panel on this page — header figures, charts, campaigns and
  // destinations — comes from one GET /api/analytics/snapshot, taken at a
  // single moment. Separate requests landed a second or two apart during live
  // traffic, so panels disagreed (192 in the header, 190 in the chart).
  // Hourly points are requested once; the chart adds them up into days and
  // weeks itself, so switching H / D / M needs no extra request.
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  // Dropdown call counts from the last "All destinations" snapshot — a
  // filtered snapshot only carries the chosen destination.
  const [allDestCounts, setAllDestCounts] = useState<Map<string, number> | null>(null);

  const destination = allSelected ? undefined : destinationTfn;
  const userId = useAuthStore((s) => s.user?.id);
  const viewKey = snapshotKey({ dateFrom: fromKey, dateTo: toKey, timeZone, destination });

  // A new date range or time zone makes the per-destination counts out of date.
  // Declared BEFORE the cache effect below so the cache can refill them.
  useIsoLayoutEffect(() => {
    setAllDestCounts(null);
  }, [fromKey, toKey, timeZone]);

  // Show the last snapshot of this view in the same frame the page appears (or
  // the view changes) - the refresh below then happens behind it. Without this
  // every visit and every date / destination change started from empty panels.
  useIsoLayoutEffect(() => {
    if (!mayLoad) return;
    const cached = getCachedSnapshot(viewKey);
    if (!cached) {
      // Nothing saved for this view yet: show nothing rather than the previous
      // view's figures under the new date (that mix is what read as "both days
      // on screen"). The load below fills it in.
      setSnapshot(null);
      return;
    }
    setSnapshot(cached);
    if (allSelected) setAllDestCounts(countsOf(cached));
  }, [viewKey, userId, allSelected, mayLoad]);

  const lastLoadAt = useRef(0);
  const refreshRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    // History is locked behind the reports PIN: ask for nothing (the gate below
    // is showing) and drop what was on screen. Loads again the moment it unlocks.
    if (!mayLoad) {
      refreshRef.current = null;
      setSnapshot(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    const view = { dateFrom: fromKey, dateTo: toKey, timeZone, destination };
    // Only dim the panels when there is nothing of THIS view to show yet.
    const hadCache = !!getCachedSnapshot(snapshotKey(view));

    const load = async (viewChanged: boolean) => {
      if (viewChanged && !hadCache) setLoading(true);
      try {
        // Shared with the prefetch started at sign-in: one request, not two.
        const snap = await loadSnapshotShared(view);
        if (cancelled) return;
        lastLoadAt.current = Date.now();
        setSnapshot(snap);
        if (allSelected) setAllDestCounts(countsOf(snap));
      } catch (e) {
        if (cancelled) return;
        // Failed after the user changed the view: don't leave the previous
        // view's numbers sitting under the new label. A failed background
        // refresh keeps what is on screen.
        if (viewChanged && !hadCache) setSnapshot(null);
        // "History is locked" is not an error: the PIN prompt below says so.
        if (isPinRequiredError(e)) return;
        toast.error(friendlyErrorMessage(e, "Couldn't load the dashboard for this date range"), {
          id: "dashboard-load-error",
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load(true);
    if (!includesToday) {
      refreshRef.current = null;
      return () => {
        cancelled = true;
      };
    }
    refreshRef.current = () => {
      if (document.visibilityState === "visible") void load(false);
    };
    const id = window.setInterval(() => refreshRef.current?.(), TODAY_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - lastLoadAt.current > RETURN_REFRESH_MIN_GAP_MS) {
        refreshRef.current?.();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      refreshRef.current = null;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [fromKey, toKey, includesToday, timeZone, allSelected, destinationTfn, mayLoad]);

  // A call started or ended (the live count moved): pull fresh figures now
  // instead of waiting for the next timer tick.
  const liveCount = useCallsStore((s) => s.liveCount);
  useEffect(() => {
    if (!includesToday || lastLoadAt.current === 0) return;
    if (Date.now() - lastLoadAt.current < LIVE_CHANGE_MIN_GAP_MS) return;
    refreshRef.current?.();
  }, [liveCount, includesToday]);

  // The header shows today's account-wide figures on every page. The
  // snapshot carries exactly that when the view is today with all
  // destinations, so then the header reads the snapshot (and pauses its own
  // poll) to match the panels below. Any other view leaves the header as is.
  const headerFromSnapshot = isToday && allSelected;
  useEffect(() => {
    if (!headerFromSnapshot) return;
    useCallsStore.getState().setSnapshotDrivesKpis(true);
    return () => useCallsStore.getState().setSnapshotDrivesKpis(false);
  }, [headerFromSnapshot]);
  useEffect(() => {
    if (headerFromSnapshot && snapshot) useCallsStore.getState().setKpis(snapshot.kpis);
  }, [headerFromSnapshot, snapshot]);

  // Calls per destination TFN in the selected range — the secondary label in
  // the destination dropdown.
  const callsByTfn = useMemo(() => {
    if (allDestCounts) return allDestCounts;
    const map = new Map<string, number>();
    if (isToday) {
      for (const d of destinations) map.set(toE164(d.tfn), d.dailyCalls);
    }
    return map;
  }, [allDestCounts, destinations, isToday]);

  const summary = useMemo(() => ({
    // While the snapshot is loading the card shows zeros; once it arrives,
    // null means withheld for this role and the cell disappears entirely.
    revenue: snapshot ? snapshot.kpis.totalRevenue : 0,
    payout: snapshot ? snapshot.kpis.totalPayout : 0,
  }), [snapshot]);

  const donutTotals = useMemo(() => {
    const points = snapshot?.timeSeries ?? [];
    const connected = points.reduce((s, p) => s + p.connected, 0);
    const notConnected = points.reduce((s, p) => s + p.noAnswer, 0);
    return { total: connected + notConnected, connected, notConnected };
  }, [snapshot]);

  const updatedLabel = snapshot
    ? new Date(snapshot.takenAt).toLocaleTimeString(undefined, { timeZone })
    : null;
  const updatedKey = t("dashboard.updatedAt");
  const updatedPrefix = updatedKey === "dashboard.updatedAt" ? "Updated" : updatedKey;

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
            {updatedLabel && (
              <span className="whitespace-nowrap text-[11px] text-muted-foreground tabular-nums">
                {updatedPrefix} {updatedLabel}
                {loading && " · Updating…"}
              </span>
            )}
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

      {/* Everything below is the account's history when the range starts before
          today, so it sits behind the reports PIN (today never does). */}
      <ReportsPinGate needsPin={needsPin} onCancel={() => setDateRange({ from: today, to: today })}>
        {/* A view with nothing saved yet is loading: say so, so its empty
            panels are not read as real zeros. */}
        {loading && !snapshot && (
          <div
            role="status"
            className="mb-3 flex items-center gap-2 rounded-md border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t("common.loadingRange").replace("{range}", dateLabel)}
          </div>
        )}
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
            <HourlyDistribution calls={NO_CALLS} series={snapshot?.timeSeries ?? []} className="h-full" />
          </div>
          <div className="flex h-full min-w-0 flex-col gap-4">
            <CallPerfCard revenue={summary.revenue} payout={summary.payout} />
            <div className="min-h-0 flex-1">
              <VerticalDonut totals={donutTotals} />
            </div>
          </div>
        </div>

        {/* Row 2 — Top campaigns + Revenue by hour (secondary) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TopCampaignsBars calls={NO_CALLS} campaignSummaries={snapshot?.campaigns ?? []} dateLabel={dateLabel} />
          <RevenueChart calls={NO_CALLS} series={snapshot?.timeSeries ?? []} dateLabel={dateLabel} />
        </div>

        {/* Row 3 — Destinations table (each TFN with its own CC and Cap) */}
        <DestinationSummaryTable
          calls={NO_CALLS}
          // While a view loads, only TODAY may fall back to the live
          // destination counters - for any other range they are the wrong day.
          rangeDestinations={snapshot?.destinations ?? (isToday ? undefined : NO_DESTINATIONS)}
          dateLabel={dateLabel}
          useLiveCounters={isToday}
          destinationFilter={allSelected ? undefined : destinationTfn}
        />
      </ReportsPinGate>
    </>
  );
}
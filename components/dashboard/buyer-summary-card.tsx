"use client";

/**
 * CH-399 (Sir, 30 Oct, design screenshot): the dashboard's Buyers card, in
 * place of the Destinations table - one row per active buyer, with its live
 * concurrency against its maximum, its daily cap, calls and revenue, and the
 * two headline facts underneath.
 *
 * Built from the same figures the Destinations table used (each active TFN of
 * an active buyer: live calls, CC cap, daily cap, calls and revenue for the
 * selected day), added up per buyer. A buyer login sees only its own row; the
 * Pause / Edit actions are for staff who may edit buyers.
 */
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Info, MoreHorizontal, Pause, TrendingUp } from "lucide-react";
import { toast } from "sonner";

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
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { formatCurrency, formatNumber, toE164 } from "@/lib/format";
import { usePermissions } from "@/lib/my-permissions";
import { useAuthStore } from "@/lib/store/auth-store";
import { useBuyersStore } from "@/lib/store/buyers-store";
import { useDestinationsStore } from "@/lib/store/destinations-store";
import type { Buyer, Call, Destination } from "@/lib/types";
import { cn } from "@/lib/utils";

interface BuyerSummaryCardProps {
  /** The selected range's calls - already date-scoped by the page. */
  calls: Call[];
  rangeDestinations?: Destination[];
  /** "Today", or the selected date(s). */
  dateLabel: string;
  /** True when the range is today: per-TFN counters from the destinations API. */
  useLiveCounters?: boolean;
  /** When set, only the buyer of the destination with this TFN. */
  destinationFilter?: string;
}

interface Row {
  id: string;
  name: string;
  buyer: Buyer | undefined;
  live: number;
  /** Sum of its TFNs' CC caps; 0 = at least one is unlimited. */
  max: number;
  /** The buyer's own daily cap, else the sum of its TFNs' daily caps; 0 = none. */
  dailyCap: number;
  calls: number;
  revenue: number;
  /** Has a TFN switched on and the buyer itself is active: it can take a
   *  call right now. False for a buyer that worked today and is paused now. */
  activeNow: boolean;
}

type Show = "all" | "live" | "idle";
type SortBy = "revenue" | "calls" | "live";

const GREEN = "text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]";
const GREEN_BG = "bg-[oklch(0.62_0.18_155)] dark:bg-[oklch(0.78_0.18_155)]";

function buildRows(
  destinations: Destination[],
  filter: string | undefined,
  calls: Call[],
  buyers: Buyer[],
  useLiveCounters: boolean,
): Row[] {
  // Per TFN for a past range (the API has no per-destination counters for
  // past dates), keyed by E.164 so "18779641530" matches "+18779641530".
  const callsByTfn = new Map<string, number>();
  const revenueByTfn = new Map<string, number>();
  if (!useLiveCounters) {
    for (const c of calls) {
      const k = toE164(c.destinationNumber);
      callsByTfn.set(k, (callsByTfn.get(k) ?? 0) + 1);
      revenueByTfn.set(k, (revenueByTfn.get(k) ?? 0) + c.revenue);
    }
  }
  const buyerById = new Map(buyers.map((b) => [b.id, b] as const));
  const keepBuyer = filter
    ? new Set(destinations.filter((d) => toE164(d.tfn) === toE164(filter)).map((d) => d.buyerId || d.buyerName))
    : null;

  // CH-399 (Sir: "push all active buyers today until bottom"): every buyer
  // that is active now (a TFN switched on, the buyer active) AND every buyer
  // that took calls in the selected day, even if paused since - R48, Q07 and
  // the rest whose lines were switched off after their cap.
  type Acc = { live: number; calls: number; revenue: number; cc: number; allCc: boolean; cap: number; allCapped: boolean; n: number };
  const acc = (): Acc => ({ live: 0, calls: 0, revenue: 0, cc: 0, allCc: true, cap: 0, allCapped: true, n: 0 });
  const rows = new Map<string, { id: string; name: string; buyer: Buyer | undefined; on: Acc; used: Acc }>();
  for (const d of destinations) {
    const buyer = buyerById.get(d.buyerId);
    const tfn = toE164(d.tfn);
    const dayCalls = useLiveCounters ? d.dailyCalls || 0 : callsByTfn.get(tfn) ?? 0;
    const dayRevenue = useLiveCounters ? d.dailyRevenue || 0 : revenueByTfn.get(tfn) ?? 0;
    const live = d.liveCalls || 0;
    const on = d.enabled && (!buyer || buyer.status === "active");
    const used = dayCalls > 0 || dayRevenue > 0 || live > 0;
    if (!on && !used) continue;
    const key = d.buyerId || d.buyerName || d.id;
    if (keepBuyer && !keepBuyer.has(key)) continue;
    let row = rows.get(key);
    if (!row) {
      row = { id: key, name: buyer?.name ?? d.buyerName ?? d.name, buyer, on: acc(), used: acc() };
      rows.set(key, row);
    }
    for (const [a, take] of [[row.on, on], [row.used, on || used]] as const) {
      if (!take) continue;
      a.n += 1;
      a.live += live;
      a.calls += dayCalls;
      a.revenue += dayRevenue;
      if (d.concurrencyCap > 0) a.cc += d.concurrencyCap;
      else a.allCc = false;
      if (d.dailyCap > 0) a.cap += d.dailyCap;
      else a.allCapped = false;
    }
  }
  return [...rows.values()].map(({ id, name, buyer, on, used }) => {
    const activeNow = on.n > 0;
    // Max and cap: of the lines it can take calls on now; for a buyer that
    // is paused now, of the lines it used today.
    const lines = activeNow ? on : used;
    return {
      id, name, buyer, activeNow,
      live: used.live,
      calls: used.calls,
      revenue: used.revenue,
      max: lines.allCc ? lines.cc : 0,
      dailyCap: buyer && buyer.dailyCap > 0 ? buyer.dailyCap : lines.allCapped ? lines.cap : 0,
    };
  });
}

function initials(name: string): string {
  const letters = name.replace(/[^A-Za-z0-9]/g, "");
  // A short code (Q07, R48, 11H) is shown whole; a name by its first two letters.
  if (letters.length > 0 && letters.length <= 3) return letters.toUpperCase();
  return (letters.slice(0, 2) || name.slice(0, 2)).toUpperCase();
}

export function BuyerSummaryCard({
  calls,
  rangeDestinations,
  dateLabel,
  useLiveCounters = false,
  destinationFilter,
}: BuyerSummaryCardProps) {
  const { t } = useTranslation();
  const role = useAuthStore((s) => s.user?.role);
  const { can } = usePermissions();
  const destinations = useDestinationsStore((s) => s.destinations);
  const buyers = useBuyersStore((s) => s.buyers);
  const setStatus = useBuyersStore((s) => s.setStatus);
  const [show, setShow] = useState<Show>("all");
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [pausing, setPausing] = useState<Row | null>(null);

  const isPartner = role === "buyer" || role === "publisher";
  const canEdit = !isPartner && can("buyers", "edit");

  const all = useMemo(
    () => buildRows(rangeDestinations ?? destinations, destinationFilter, calls, buyers,
                    rangeDestinations ? true : useLiveCounters),
    [rangeDestinations, destinations, destinationFilter, calls, buyers, useLiveCounters],
  );

  const liveNow = all.reduce((n, r) => n + r.live, 0);
  const taking = all.filter((r) => r.live > 0);
  const idle = all.filter((r) => r.live === 0);
  // The footer names only buyers that could take a call now and have none -
  // not every buyer paused since this morning.
  const idleNow = idle.filter((r) => r.activeNow);
  const callsTotal = all.reduce((n, r) => n + r.calls, 0);
  const revenueTotal = all.reduce((n, r) => n + r.revenue, 0);
  const topEarner = all.reduce<Row | null>((best, r) => (r.revenue > 0 && (!best || r.revenue > best.revenue) ? r : best), null);

  const rows = useMemo(() => {
    const list = show === "live" ? all.filter((r) => r.live > 0) : show === "idle" ? all.filter((r) => r.live === 0) : all;
    const key = (r: Row) => (sortBy === "calls" ? r.calls : sortBy === "live" ? r.live : r.revenue);
    return [...list].sort((a, b) => key(b) - key(a) || b.revenue - a.revenue || a.name.localeCompare(b.name));
  }, [all, show, sortBy]);

  const day = dateLabel === t("sharedUI.dateRange.today") ? dateLabel.toLowerCase() : dateLabel;
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

  // "A, B and C"
  const list = (names: string[]) =>
    names.length <= 1 ? names.join("") : `${names.slice(0, -1).join(", ")} ${t("x399.and")} ${names[names.length - 1]}`;

  // Who carries most of the live calls: the busiest buyers until they hold
  // more than half of them, at most three.
  const carriers: Row[] = [];
  {
    let held = 0;
    for (const r of [...taking].sort((a, b) => b.live - a.live)) {
      if (carriers.length >= 3 || held * 2 > liveNow) break;
      carriers.push(r);
      held += r.live;
    }
  }
  const carried = carriers.reduce((n, r) => n + r.live, 0);

  const confirmPause = async () => {
    const row = pausing;
    setPausing(null);
    if (!row?.buyer) return;
    try {
      await setStatus(row.buyer.id, "paused");
      toast.success(t("x399.paused").replace("{name}", row.name));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : String(e));
    }
  };

  const segment = (active: boolean) =>
    cn(
      "rounded-md px-3 py-1 text-xs font-medium transition-colors",
      active ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
    );

  return (
    <Card className="overflow-hidden p-0">
      {/* Header: title, the four figures, the filters */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-6 pb-4 pt-5">
        <div>
          <h3 className="text-base font-semibold">{t("x399.title")}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("x399.hint")}</p>
          <div className="mt-3 flex flex-wrap items-stretch gap-x-6 gap-y-2">
            <div>
              <p className="text-[11px] text-muted-foreground">{t("x399.liveNow")}</p>
              <p className="mt-0.5 flex items-center gap-1.5 text-xl font-semibold tabular-nums">
                <span className={cn("h-1.5 w-1.5 rounded-full", liveNow > 0 ? GREEN_BG : "bg-muted-foreground/50")} />
                {formatNumber(liveNow)}
              </p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-muted-foreground">{t("x399.taking")}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">
                {taking.length}
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  {t("x399.of").replace("{n}", String(all.length))}
                </span>
              </p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-muted-foreground">{t("x399.calls")} {day}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatNumber(callsTotal)}</p>
            </div>
            <div className="border-l border-border pl-6">
              <p className="text-[11px] text-muted-foreground">{t("x399.revenue")}</p>
              <p className="mt-0.5 text-xl font-semibold tabular-nums">{formatCurrency(revenueTotal)}</p>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex rounded-lg border border-border p-0.5">
            <button type="button" className={segment(show === "all")} onClick={() => setShow("all")}>
              {t("x399.all")} {all.length}
            </button>
            <button type="button" className={segment(show === "live")} onClick={() => setShow("live")}>
              {t("x399.live")} {taking.length}
            </button>
            <button type="button" className={segment(show === "idle")} onClick={() => setShow("idle")}>
              {t("x399.idle")} {idle.length}
            </button>
          </div>
          <div className="flex rounded-lg border border-border p-0.5">
            <button type="button" className={segment(sortBy === "revenue")} onClick={() => setSortBy("revenue")}>
              {t("x399.revenue")}
            </button>
            <button type="button" className={segment(sortBy === "calls")} onClick={() => setSortBy("calls")}>
              {t("x399.calls")}
            </button>
            <button type="button" className={segment(sortBy === "live")} onClick={() => setSortBy("live")}>
              {t("x399.live")}
            </button>
          </div>
          {!isPartner && (
            <Link href={ROUTES.buyers} className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:opacity-80">
              {t("x399.manage")} <ArrowRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>

      {/* The table */}
      <div className="overflow-x-auto">
        <div className="min-w-[900px]">
          <div className="grid grid-cols-[minmax(13rem,18rem)_minmax(10rem,13rem)_minmax(6.5rem,8rem)_minmax(5rem,6rem)_minmax(13rem,18rem)_11rem] justify-between items-center gap-x-4 border-y border-border px-6 py-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            <span>{t("x399.colBuyer")}</span>
            <span>
              {t("x399.colConcurrency")}
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">{t("x399.liveMax")}</span>
            </span>
            <span>{t("x399.colDailyCap")}</span>
            <span className="text-right">
              {t("x399.calls")}
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">{day}</span>
            </span>
            <span className="text-center">
              {t("x399.revenue")}
              <span className="ml-1 font-normal normal-case tracking-normal text-muted-foreground/70">{day}</span>
            </span>
            <span />
          </div>

          {rows.length === 0 ? (
            <p className="px-6 py-8 text-center text-sm text-muted-foreground">{t("x399.empty")}</p>
          ) : (
            rows.map((r) => {
              const isTop = topEarner?.id === r.id;
              const share = pct(r.revenue, revenueTotal);
              const ccPct = r.max > 0 ? Math.min(100, (r.live / r.max) * 100) : 0;
              const capFull = r.dailyCap > 0 && r.calls >= r.dailyCap;
              return (
                <div
                  key={r.id}
                  className={cn(
                    "group grid grid-cols-[minmax(13rem,18rem)_minmax(10rem,13rem)_minmax(6.5rem,8rem)_minmax(5rem,6rem)_minmax(13rem,18rem)_11rem] justify-between items-center gap-x-4 border-b border-l-2 border-b-border/60 border-l-transparent py-3 pl-[22px] pr-6 transition-colors last:border-b-0 hover:bg-muted/30",
                    isTop && "border-l-accent bg-muted/20",
                  )}
                >
                  {/* Buyer */}
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-[11px] font-semibold">
                      {initials(r.name)}
                      <span
                        className={cn(
                          "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card",
                          r.live > 0 ? GREEN_BG : r.activeNow ? "bg-muted-foreground/50" : "bg-[color:var(--warning)]",
                        )}
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {r.buyer ? (
                          <Link href={`${ROUTES.buyers}/${r.buyer.id}`} className="truncate text-sm font-semibold hover:text-accent">
                            {r.name}
                          </Link>
                        ) : (
                          <span className="truncate text-sm font-semibold">{r.name}</span>
                        )}
                        {isTop && (
                          <span className="shrink-0 rounded bg-accent/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-accent">
                            {t("x399.topEarner")}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {r.live > 0 ? t("x399.takingCalls") : r.activeNow ? t("x399.idle") : t("x399.pausedNow")}
                      </p>
                    </div>
                  </div>

                  {/* Concurrency: live / max */}
                  <div className="pr-4">
                    <p className="text-xs tabular-nums">
                      <span className={cn("text-sm font-semibold", r.live > 0 ? GREEN : "text-muted-foreground")}>
                        {r.live}
                      </span>
                      <span className="text-muted-foreground"> / {r.max > 0 ? `${formatNumber(r.max)} ${t("x399.max")}` : "∞"}</span>
                    </p>
                    <div className="mt-1 h-1 w-full max-w-[10rem] overflow-hidden rounded-full bg-muted/60">
                      <div className={cn("h-full rounded-full", GREEN_BG)} style={{ width: `${r.live > 0 ? Math.max(3, ccPct) : 0}%` }} />
                    </div>
                  </div>

                  {/* Daily cap */}
                  <div>
                    <span
                      className={cn(
                        "inline-flex rounded-md border border-border px-2 py-1 text-[11px] tabular-nums",
                        capFull ? "border-destructive/50 text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {r.dailyCap > 0 ? `${formatNumber(r.calls)} / ${formatNumber(r.dailyCap)}` : t("x399.noCap")}
                    </span>
                  </div>

                  {/* Calls */}
                  <span className="text-right text-sm font-semibold tabular-nums">{formatNumber(r.calls)}</span>

                  {/* Revenue: share bar + amount */}
                  <div className="flex items-center justify-between gap-4 pl-4">
                    <div className="min-w-0 flex-1">
                      <div className="h-1 w-full max-w-[8rem] overflow-hidden rounded-full bg-muted/60">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${share}%` }} />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {t("x399.ofRevenue").replace("{pct}", String(share))}
                      </p>
                    </div>
                    <span className="text-base font-semibold tabular-nums">{formatCurrency(r.revenue)}</span>
                  </div>

                  {/* Actions: shown on hover */}
                  <div className="flex items-center justify-end gap-1.5">
                    {r.buyer && canEdit && r.buyer.status === "active" ? (
                      <>
                        <span className="text-muted-foreground group-hover:hidden">
                          <MoreHorizontal className="h-4 w-4" />
                        </span>
                        <div className="hidden items-center gap-1.5 group-hover:flex">
                          <button
                            type="button"
                            onClick={() => setPausing(r)}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                          >
                            <Pause className="h-3 w-3" /> {t("x399.pause")}
                          </button>
                          <Link
                            href={`${ROUTES.buyers}/${r.buyer.id}?tab=settings`}
                            className="rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                          >
                            {t("x399.edit")}
                          </Link>
                          <Link
                            href={`${ROUTES.buyers}/${r.buyer.id}`}
                            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium hover:bg-muted"
                          >
                            {t("x399.callsLink")} <ArrowRight className="h-3 w-3" />
                          </Link>
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* The two headline facts */}
      {all.length > 0 && (
        <div className="grid gap-3 border-t border-border bg-muted/20 px-6 py-3 text-xs md:grid-cols-2">
          <p className="flex items-center gap-2 text-muted-foreground">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
            {topEarner ? (
              <span>
                <b className="font-semibold text-foreground">
                  {t("x399.mostRevenue")
                    .replace("{name}", topEarner.name)
                    .replace("{amount}", formatCurrency(topEarner.revenue))}
                </b>
                {", "}
                {t("x399.mostRevenueShare").replace("{pct}", String(pct(topEarner.revenue, revenueTotal)))}
              </span>
            ) : (
              <span>—</span>
            )}
          </p>
          <p className="flex items-center gap-2 text-muted-foreground md:justify-end">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
              <Info className="h-3.5 w-3.5" />
            </span>
            <span>
              {liveNow === 0 ? (
                t("x399.noneLive")
              ) : idleNow.length === 0 ? (
                t("x399.allLive")
              ) : (
                <>
                  <b className="font-semibold text-foreground">
                    {(idleNow.length === 1 ? t("x399.idleOne") : t("x399.idleSome")).replace("{names}", list(idleNow.map((r) => r.name)))}
                  </b>{" "}
                  {(carriers.length === 1 ? t("x399.carryingOne") : t("x399.carrying"))
                    .replace("{names}", list(carriers.map((r) => r.name)))
                    .replace("{n}", String(carried))
                    .replace("{total}", String(liveNow))}
                </>
              )}
            </span>
          </p>
        </div>
      )}

      <AlertDialog open={!!pausing} onOpenChange={(o) => !o && setPausing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("x399.pauseTitle").replace("{name}", pausing?.name ?? "")}</AlertDialogTitle>
            <AlertDialogDescription>{t("x399.pauseBody").replaceAll("{name}", pausing?.name ?? "")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmPause()}>{t("x399.pause")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

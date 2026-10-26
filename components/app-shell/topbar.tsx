"use client";

import { useEffect } from "react";
import { Command, Search, Wallet } from "lucide-react";

import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "@/hooks/use-translation";
import { prefetchDashboardSnapshot } from "@/lib/dashboard-snapshot";
import { prefetchNewsPages } from "@/lib/news-snapshots";
import { formatCurrency, formatNumber } from "@/lib/format";
import { startLiveCountSync } from "@/lib/live-count";
import { prefetchReport, todayAndYesterday } from "@/lib/reports-cache";
import { useCallsStore } from "@/lib/store/calls-store";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { useUIStore } from "@/lib/store/ui-store";
import { cn } from "@/lib/utils";

const KPI_POLL_MS = 15_000;

export function Topbar() {
  const { t } = useTranslation();
  // Live counters now come straight from the analytics dashboard endpoint,
  // hydrated on app mount by <StoreHydrator />. Zero values render until the
  // first response lands; that's accurate, not a degraded state.
  const kpis = useCallsStore((s) => s.kpis);
  // liveCount is kept fresh by lib/live-count.ts (every 10 s from the server,
  // and instantly on the Live Monitor). It falls back to kpis.liveCalls only
  // while it is unknown - before the first answer, or if the server stops
  // answering - never because it happens to read 0.
  const liveCount = useCallsStore((s) => s.liveCount);
  const liveCountAt = useCallsStore((s) => s.liveCountAt);

  // <StoreHydrator /> fetches kpis exactly once, on app mount — fine for
  // callsToday, but it left "Live" frozen at whatever it was at login on
  // every page except /live (the only place the socket runs). Poll it here
  // instead, since the topbar is the one thing mounted on every page.
  useEffect(() => {
    const id = window.setInterval(() => {
      // On the Dashboard the header figures come from its snapshot instead,
      // so they match the panels below them exactly.
      if (useCallsStore.getState().snapshotDrivesKpis) return;
      void useCallsStore.getState().fetchKpis();
    }, KPI_POLL_MS);
    return () => window.clearInterval(id);
  }, []);
  // Keep the header's Live figure right on every page.
  useEffect(() => startLiveCountSync(), []);

  // Start loading today's Dashboard figures as soon as the app opens (the
  // topbar is the first thing mounted after sign-in), so the Dashboard is
  // ready - or nearly - when the user gets there instead of starting then.
  const reportTimezone = useUIStore((s) => s.reportTimezone);
  useEffect(() => {
    prefetchDashboardSnapshot(reportTimezone);
    // Today's Reports view too, a moment later so it doesn't compete with the
    // Dashboard's first load - Reports then opens instantly.
    const timer = setTimeout(() => prefetchReport(todayAndYesterday(reportTimezone)[0]), 1500);
    // Daily News and Coin Market too, once the screen has settled, so their
    // first click of the session finds data waiting in the browser.
    const newsTimer = setTimeout(() => prefetchNewsPages(), 3000);
    return () => {
      clearTimeout(timer);
      clearTimeout(newsTimer);
    };
  }, [reportTimezone]);

  // Wallet balance: the dashboard KPI payload polled above carries it
  // (`balance` on /api/analytics/dashboard), so it's the freshest figure and
  // needs no extra request. The onboarding store's copy (from
  // /api/billing/account on mount + after a recharge) is the fallback until
  // the first poll lands. Renders 0 until either response arrives.
  const accountBalance = useOnboardingStore((s) => s.balance);
  const balance = kpis?.balance ?? accountBalance;
  const liveCalls = liveCountAt !== null ? liveCount : (kpis?.liveCalls ?? 0);
  const totalCalls = kpis?.callsToday ?? 0;
  const balanceText = formatCurrency(balance ?? 0);
  const liveText = formatNumber(liveCalls);
  const totalText = formatNumber(totalCalls);

  return (
    // Solid on every screen (CH-271). The glass bar (85% opaque + blur) let
    // whatever was behind it show through the stats text, and the browser
    // smeared the figures into streaks each time they updated: on phones
    // first (Sir, 23 Oct), then on a computer too - "$6,510 Live: 0 Total: 10"
    // with ghost lines after each figure (Sir, 26 Oct: "this blur issue is not
    // going away"). Touch-only and lg-only cut-offs did not end it, so the
    // blur is gone everywhere.
    //
    // The bar is a size container (@container/topbar): what fits is decided by
    // the bar's own width, not the screen's. With the sidebar open a tablet is
    // wide enough to count as a desktop while the bar itself is narrow, and
    // the stats were squeezed - fine again the moment the sidebar closed.
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background">
      <div className="@container/topbar relative flex h-16 items-center gap-4 px-4 sm:px-6">
        {/* LEFT — sidebar trigger only */}
        <div className="flex items-center">
          {/* The whole square is the button (CH-231): on a phone the 32px icon
              inside a 36px box left a ring that was not tappable, and the box
              is 40px on touch screens - the size a thumb hits first time. */}
          <SidebarTrigger className="!h-10 !w-10 rounded-lg border border-border/70 bg-secondary/40 text-muted-foreground transition-transform hover:text-foreground active:scale-95 md:!h-9 md:!w-9" />
        </div>

        {/* CENTER — command search. On wide screens it sits in the exact
            middle of the bar (boss request), whatever is on the left and the
            right; on smaller screens it keeps to the free space between them
            so it never covers the stats. */}
        {/* CH-233: shown only from @6xl, where it fits beside the full stats,
            and min-w-0 so it is the search box that gives way, never the
            figures. At @5xl it took its full width first and the stats were
            cut to "Total: 1" (Sir, 23 Oct, phone zoomed out). */}
        <div className="relative mx-auto hidden w-full min-w-0 max-w-lg @6xl/topbar:block 2xl:absolute 2xl:left-1/2 2xl:top-1/2 2xl:mx-0 2xl:max-w-md 2xl:-translate-x-1/2 2xl:-translate-y-1/2 min-[1700px]:max-w-lg">
          <CommandSearch placeholder={t("topbar.searchPlaceholder")} />
        </div>

        {/* RIGHT — stats + theme + notifications + identity */}
        {/* min-w-0 on this group and on the stats block below is what lets
            the stats actually shrink and scroll on a phone — a flex child's
            default min-width is its content width, so without it the whole
            group overflows the bar and the avatar gets clipped off-screen. */}
        <div className="ml-auto flex min-w-0 items-center gap-1.5 sm:gap-3">
          {/* Live stats — balance, in-flight, total today.
              Sits open on the bar rather than inside a pill: no frame, no
              dividers, no per-stat icon badges. Label and value read inline
              ("Live: 0") at every width — they used to collapse to an icon
              below sm, which read as the labels being broken/missing rather
              than an intentional space-saving swap. Values stay in full form
              ("3,016", never "3K").

              Below sm the three figures stack into two lines (balance above,
              Live + Total below) instead of one row: a five-digit total next
              to a five-figure balance is wider than a phone can give the bar
              once the icon pill and avatar have taken their share, and the
              one-row version answered that by scrolling — which cut "Total:
              11719" off mid-number, the exact "not visible on phone" report.
              The 64px bar has the vertical room; it's width that's scarce.
              `overflow-x-auto scrollbar-hide` stays as a last-resort safety
              net for extreme page zoom — the shell layout clips horizontal
              overflow instead of reflowing it (see app/(app)/layout.tsx). */}
          {/* One row once the bar is wide enough, two lines below that -
              by the bar's width (container query), so an open sidebar counts.
              overflow-hidden, not a scroll box: Safari smeared the figures in
              a scrolling box when it was squeezed. */}
          {/* CH-233: shrink-0 and no clipping - the balance, Live and Total
              always show in full ("Total: 1342", never "Total: 1"). The two-line
              layout below @3xl is what keeps them inside a phone's width. */}
          {/* CH-285: the figures are drawn on a layer of their own, and a new
              one each time a figure changes. Safari (Sir's iPad, 26 Oct, the
              7th report) kept pieces of the old figures on screen as dashed
              lines through and beside "$6,182 Live: 40 Total: 739": the bar
              redrew the new text but not every pixel the old text had used.
              The solid bar (CH-271) did not end it. On its own layer the
              header never paints these figures, and swapping the layer on
              every change leaves no old pixels to keep. */}
          <div
            key={`${balanceText}|${liveText}|${totalText}`}
            className="flex shrink-0 flex-col items-end gap-1 [backface-visibility:hidden] [transform:translateZ(0)] @3xl/topbar:flex-row @3xl/topbar:items-center @3xl/topbar:gap-6"
          >
            {/* Balance. A wallet rather than a "$" glyph — the figure already
                carries its own currency symbol, so a "$" badge read as "$ $0". */}
            <span className="inline-flex shrink-0 items-center gap-1.5 sm:gap-2">
              <span className="hidden h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground sm:inline-flex">
                <Wallet className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  "text-[13px] font-bold leading-none tabular-nums",
                  GREEN_TEXT,
                )}
              >
                {balanceText}
              </span>
            </span>

            {/* Counters sit closer to each other than to the balance — they're
                one category (live call activity), the balance is another.
                Gaps tighten below sm so all three indicators still fit. */}
            <span className="inline-flex shrink-0 items-center gap-1.5 sm:gap-4">
              <TopStat
                label={t("topbar.live")}
                value={liveText}
                tone="green"
              />
              <TopStat
                label={t("topbar.total")}
                value={totalText}
                tone="blue"
              />
            </span>
          </div>

          {/* Language + theme + notifications grouped in a pill */}
          <div className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-border/70 bg-secondary/30 p-1">
            <LanguageToggle />
            <span aria-hidden className="h-5 w-px bg-border/70" />
            <ThemeToggle variant="icon" />
            <span aria-hidden className="h-5 w-px bg-border/70" />
            <NotificationsMenu />
          </div>

          {/* Vertical separator before identity */}
          <span aria-hidden className="hidden h-7 w-px bg-border/70 sm:block" />

          <span className="shrink-0">
            <UserMenu />
          </span>
        </div>
      </div>

      {/* Bottom hairline — full theme gradient fading to border so every
          accent change (solid or multi-stop) lights up the topbar edge. */}
      <div aria-hidden className="relative h-px w-full">
        <div className="absolute inset-x-0 top-0 h-px bg-border/60" />
        <div
          className="absolute left-0 top-0 h-px w-64 bg-accent-gradient"
          style={{
            maskImage: "linear-gradient(to right, black, transparent)",
            WebkitMaskImage: "linear-gradient(to right, black, transparent)",
          }}
        />
      </div>
    </header>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function CommandSearch({ placeholder }: { placeholder: string }) {
  return (
    <label className="group/cmd relative flex h-10 w-full items-center gap-2.5 rounded-lg border border-border/70 bg-secondary/30 px-3 text-sm transition-colors hover:border-accent/40 focus-within:border-accent/55 focus-within:bg-secondary/50">
      <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-accent/10 text-accent">
        <Search className="h-3.5 w-3.5" />
      </span>
      <input
        type="search"
        placeholder={placeholder}
        className="flex-1 bg-transparent text-[13px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
      />
      <kbd className="pointer-events-none hidden h-6 select-none items-center gap-0.5 rounded border border-border bg-card px-1.5 font-mono text-[10px] font-semibold text-muted-foreground sm:inline-flex">
        <Command className="h-3 w-3" />
        K
      </kbd>
    </label>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

/** Bright Won-green ramp, shared by the balance figure and the Live stat. */
const GREEN_TEXT = "text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]";

/**
 * Total follows the workspace colour theme (client request: "it should
 * change according to theme"). Live stays on the fixed green ramp so the
 * pair still reads as two figures under every accent but green.
 */
const BLUE_TEXT = "text-accent";

const TONE_TEXT = {
  green: GREEN_TEXT,
  blue: BLUE_TEXT,
} as const;

interface TopStatProps {
  /** Shown before the value as "Label:" at every width. */
  label: string;
  value: string;
  /** Which fixed ramp the figure renders in. */
  tone: keyof typeof TONE_TEXT;
}

function TopStat({ label, value, tone }: TopStatProps) {
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap sm:gap-1.5">
      <span
        className={cn(
          "text-[12px] font-bold leading-none",
          TONE_TEXT[tone],
        )}
      >
        {label}:
      </span>
      <span
        className={cn(
          "text-[12px] font-bold leading-none tabular-nums",
          TONE_TEXT[tone],
        )}
      >
        {value}
      </span>
    </span>
  );
}
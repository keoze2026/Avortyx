"use client";

import { useEffect } from "react";
import { Command, Search, Wallet } from "lucide-react";

import { NotificationsMenu } from "./notifications-menu";
import { UserMenu } from "./user-menu";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { ThemeToggle } from "@/components/shared/theme-toggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "@/hooks/use-translation";
import { formatCurrency, formatNumber } from "@/lib/format";
import { useCallsStore } from "@/lib/store/calls-store";
import { useOnboardingStore } from "@/lib/store/onboarding-store";
import { cn } from "@/lib/utils";

const KPI_POLL_MS = 15_000;

export function Topbar() {
  const { t } = useTranslation();
  // Live counters now come straight from the analytics dashboard endpoint,
  // hydrated on app mount by <StoreHydrator />. Zero values render until the
  // first response lands; that's accurate, not a degraded state.
  const kpis = useCallsStore((s) => s.kpis);
  // liveCount is written by useLiveSocket on every WebSocket event, so it
  // tracks in-flight calls in real time. Falls back to kpis.liveCalls (the
  // REST snapshot) until the user opens /live and the socket connects.
  const liveCount = useCallsStore((s) => s.liveCount);

  // <StoreHydrator /> fetches kpis exactly once, on app mount — fine for
  // callsToday, but it left "Live" frozen at whatever it was at login on
  // every page except /live (the only place the socket runs). Poll it here
  // instead, since the topbar is the one thing mounted on every page.
  useEffect(() => {
    const id = window.setInterval(() => {
      void useCallsStore.getState().fetchKpis();
    }, KPI_POLL_MS);
    return () => window.clearInterval(id);
  }, []);
  // Wallet balance comes from the billing account fetched by the onboarding
  // store on mount (and refreshed after every recharge). Renders 0 until the
  // first response lands.
  const balance = useOnboardingStore((s) => s.balance);
  const liveCalls = liveCount > 0 ? liveCount : (kpis?.liveCalls ?? 0);
  const totalCalls = kpis?.callsToday ?? 0;

  return (
    // Solid on phones, glassy from sm up. The 85%-opaque + blur treatment
    // lets whatever scrolls under the bar bleed through behind the stats
    // text (which, unlike the icon pill and avatar, has no backing of its
    // own) — on a phone that's dense table rows and chart gridlines, and the
    // blurred row borders read as stripes through "Live: 0 / Total: 169".
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background sm:bg-background/85 sm:backdrop-blur-xl">
      <div className="relative flex h-16 items-center gap-4 px-4 sm:px-6">
        {/* LEFT — sidebar trigger only */}
        <div className="flex items-center">
          <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border/70 bg-secondary/40">
            <SidebarTrigger className="!h-8 !w-8 text-muted-foreground hover:text-foreground" />
          </div>
        </div>

        {/* CENTER — command search */}
        <div className="relative mx-auto hidden w-full max-w-lg lg:block">
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
          <div className="flex min-w-0 flex-col items-end gap-1 overflow-x-auto scrollbar-hide sm:flex-row sm:items-center sm:gap-6">
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
                {formatCurrency(balance ?? 0)}
              </span>
            </span>

            {/* Counters sit closer to each other than to the balance — they're
                one category (live call activity), the balance is another.
                Gaps tighten below sm so all three indicators still fit. */}
            <span className="inline-flex shrink-0 items-center gap-1.5 sm:gap-4">
              <TopStat
                label={t("topbar.live")}
                value={formatNumber(liveCalls)}
                tone="green"
              />
              <TopStat
                label={t("topbar.total")}
                value={formatNumber(totalCalls)}
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
 * Fixed blue for Total. Deliberately not `text-accent`: these two figures sit
 * side by side and the colour is what separates them, so under the green theme
 * an accent-driven Total would go green too and the pair would read as one.
 */
const BLUE_TEXT = "text-[oklch(0.52_0.19_262)] dark:text-[oklch(0.74_0.15_258)]";

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

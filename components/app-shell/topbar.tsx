"use client";

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
  // Wallet balance comes from the billing account fetched by the onboarding
  // store on mount (and refreshed after every recharge). Renders 0 until the
  // first response lands.
  const balance = useOnboardingStore((s) => s.balance);
  const liveCalls = liveCount > 0 ? liveCount : (kpis?.liveCalls ?? 0);
  const totalCalls = kpis?.callsToday ?? 0;

  return (
    <header className="sticky top-0 z-30 border-b border-border/50 bg-background/85 backdrop-blur-xl">
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
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {/* Live stats — balance, in-flight, total today.
              Sits open on the bar rather than inside a pill: no frame, no
              dividers, no per-stat icon badges. Label and value read inline
              ("Live: 0"), with colour carried by the value alone so the row
              scans as figures rather than as chrome. Labels collapse on
              mobile; values stay in full form ("3,016", never "3K"). */}
          {/* Staggered bracket: each cell carries a different edge set, so the
              three read as distinct without a full box around each. Padding
              rather than gaps does the spacing now — the borders separate them.
              items-stretch keeps every cell the same height so the edges line up. */}
          <div className="inline-flex items-stretch">
            {/* Balance. A wallet rather than a "$" glyph — the figure already
                carries its own currency symbol, so a "$" badge read as "$ $0". */}
            <span className="inline-flex items-center gap-2 border-b border-l border-border px-3 py-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border text-muted-foreground">
                <Wallet className="h-3.5 w-3.5" />
              </span>
              <span
                className={cn(
                  "text-[15px] font-semibold leading-none tabular-nums",
                  GREEN_TEXT,
                )}
              >
                {formatCurrency(balance ?? 0)}
              </span>
            </span>

            <TopStat
              label={t("topbar.live")}
              value={formatNumber(liveCalls)}
              live
              className="border-l border-t border-border px-3 py-2"
            />
            <TopStat
              label={t("topbar.total")}
              value={formatNumber(totalCalls)}
              accent
              className="border-b border-l border-r border-border px-3 py-2"
            />
          </div>

          {/* Language + theme + notifications grouped in a pill */}
          <div className="inline-flex items-center gap-1 rounded-lg border border-border/70 bg-secondary/30 p-1">
            <LanguageToggle />
            <span aria-hidden className="h-5 w-px bg-border/70" />
            <ThemeToggle variant="icon" />
            <span aria-hidden className="h-5 w-px bg-border/70" />
            <NotificationsMenu />
          </div>

          {/* Vertical separator before identity */}
          <span aria-hidden className="hidden h-7 w-px bg-border/70 sm:block" />

          <UserMenu />
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

interface TopStatProps {
  /** Shown before the value as "Label:". Collapses on mobile. */
  label: string;
  value: string;
  /** Renders the value in the live-green ramp. */
  live?: boolean;
  /** Renders the value in the portal accent. */
  accent?: boolean;
  /** Border/padding for the stat's cell in the topbar bracket. */
  className?: string;
}

function TopStat({ label, value, live = false, accent = false, className }: TopStatProps) {
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/* Muted so the figure carries the emphasis, not the word.
          Collapses on mobile so the row stays compact. */}
      <span className="hidden text-[12px] leading-none text-muted-foreground sm:inline">
        {label}:
      </span>
      <span
        className={cn(
          "text-[15px] font-semibold leading-none tabular-nums",
          live ? GREEN_TEXT : accent ? "text-accent" : "text-foreground",
        )}
      >
        {value}
      </span>
    </span>
  );
}

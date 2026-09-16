"use client";

import type { ReactNode } from "react";
import { Newspaper, Sparkles, TrendingUp } from "lucide-react";

import { BrandVortex } from "@/components/auth/brand-vortex";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeColorSwitcher } from "@/components/marketing/theme-color-switcher";
import { formatBtcSpot, useBtcSpot } from "@/hooks/use-btc-spot";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

/**
 * Asymmetric split layout. The vortex spans the entire viewport — its centre
 * is biased left, but the outer rings reach into the right column so both
 * zones share the same atmosphere instead of feeling like two stitched-on
 * panels. There's no opaque curtain or hard divider between the columns; the
 * form panel is its own substantial glass card with an accent halo that
 * harmonizes with the orbital colors behind it.
 *
 * Three ambient signal chips sit above the tagline — Markets / Briefings /
 * AI Confidence — to hint at Avortyx's multi-product breadth. We intentionally
 * leave out a "Live calls" chip because a hardcoded call-count value reads as
 * inaccurate on a marketing surface.
 *
 * Colour: the whole surface sits inside `.site-surface` (see globals.css),
 * which maps the app's theme tokens — and the vortex's `--vortyx-*` ramp —
 * onto the landing page's palette, so login and sign-up read as the same
 * product as the site they came from. The landing page has no light mode,
 * so the old light/dark toggle is replaced by its green/blue accent toggle;
 * `dark` is pinned on the wrapper so every `dark:` utility resolves the
 * same way regardless of the visitor's app-side theme preference.
 *
 * `isolate` matters: `.site-surface` paints its own background, and the
 * vortex canvas sits at `-z-10`. Without a stacking context on this
 * wrapper the canvas would drop beneath that background and vanish; with
 * it, the canvas paints between the surface and the content.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const btc = useBtcSpot();

  // Live BTC values when available; fall back to the i18n strings otherwise.
  const marketsValue =
    btc.ready && btc.priceUsd != null
      ? formatBtcSpot(btc.priceUsd)
      : t("authUI.split.signals.marketsValue");
  const marketsDelta = btc.ready ? btc.change24h : null;

  return (
    <main className="dark site-surface relative isolate min-h-screen overflow-hidden">
      {/* Vortex covers the full viewport behind the grid. */}
      <BrandVortex centerX={0.38} />

      {/* Accent toggle pinned to the top-right of the viewport — the same
          green/blue switch as the landing-page header. */}
      <div className="absolute right-6 top-6 z-20">
        <ThemeColorSwitcher />
      </div>

      <div className="relative z-10 grid min-h-screen lg:grid-cols-[3fr_2fr]">
        {/* ─── Left column ───────────────────────────────────────── */}
        <aside className="relative hidden flex-col px-12 py-10 lg:flex xl:px-20 xl:py-14">
          <header>
            {/* Wordmark links to the marketing landing page (ROUTES.home).
                Previously `href={null}` rendered it as a non-interactive logo. */}
            <Wordmark size="lg" uid="auth-mark" />
          </header>

          {/* Middle group fills the remaining height between header + footer
              and centres itself vertically with margin-block:auto. Keeps the
              composition balanced even when the viewport is short. */}
          <div className="my-auto max-w-xl space-y-7">
            <div className="flex flex-wrap items-center gap-2">
              <SignalChip
                icon={TrendingUp}
                label={t("authUI.split.signals.marketsLabel")}
                value={marketsValue}
                delta={marketsDelta}
              />
              <SignalChip
                icon={Newspaper}
                label={t("authUI.split.signals.briefingsLabel")}
                value={t("authUI.split.signals.briefingsValue")}
              />
              <SignalChip
                icon={Sparkles}
                label={t("authUI.split.signals.aiLabel")}
                value={t("authUI.split.signals.aiValue")}
              />
            </div>

            <h2 className="text-4xl font-medium leading-[1.05] tracking-tight text-foreground xl:text-[3.4rem]">
              {t("authUI.split.tagline")}
            </h2>
            <p className="max-w-md text-base text-muted-foreground">
              {t("authUI.split.taglineSub")}
            </p>
          </div>

          <footer className="text-xs text-muted-foreground/80">
            {t("authUI.split.footer")}
          </footer>
        </aside>

        {/* ─── Right column ─────────────────────────────────────── */}
        <section className="relative flex items-center justify-center px-6 py-12 lg:px-10 lg:py-16">
          {/* Ambient halo behind the card — picks up the orbital colors so
              the card feels like it belongs in the vortex's atmosphere. */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,var(--accent)_0%,transparent_60%)] opacity-[0.08] blur-3xl"
          />

          <div className="relative w-full max-w-[26rem]">
            {/* Mobile-only brand mark above the form — also clickable, sends
                the visitor back to the marketing landing page. */}
            <div className="mb-8 flex justify-center lg:hidden">
              <Wordmark size="md" uid="auth-mobile" />
            </div>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

/**
 * Ambient pill chip — icon + tiny uppercase label + bold value. Brand-tinted
 * border + halo, theme-aware backgrounds so it reads cleanly in both modes.
 */
function SignalChip({
  icon: Icon,
  label,
  value,
  delta,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  /** Optional signed percent shown as a tiny tinted arrow + value. null = hide. */
  delta?: number | null;
}) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-accent/25 bg-background/55 px-3 py-1.5 shadow-[0_0_24px_-12px_color-mix(in_oklch,var(--accent)_55%,transparent)] backdrop-blur-md">
      <Icon className="h-3.5 w-3.5 text-accent" />
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <span className="text-xs font-semibold tabular-nums text-foreground">
        {value}
      </span>
      {typeof delta === "number" && (
        <span
          className={cn(
            "text-[10px] font-semibold tabular-nums",
            delta >= 0 ? "text-[color:var(--success)]" : "text-destructive",
          )}
        >
          {delta >= 0 ? "↑" : "↓"}
          {Math.abs(delta).toFixed(2)}%
        </span>
      )}
    </div>
  );
}

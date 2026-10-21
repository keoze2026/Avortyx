"use client";

import { LockKeyhole } from "lucide-react";
import { MotionConfig } from "framer-motion";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { AvortyxLogo } from "@/components/brand/avortyx-logo";
import { Scene } from "@/components/backdrop/scene";
import { Backdrop } from "@/components/backdrop/backdrop";
import { CircuitField } from "@/components/backdrop/circuit-field";
import { HeroPanel } from "@/components/intro/hero-panel";
import { TAP } from "@/components/auth/tap";

// The frame of the sign-in screen (app/(login)/login/page.tsx; the design prototype also puts its
// reset-password and not-found cards in it): a calm backdrop (components/backdrop/backdrop.tsx), the circuit board the
// card sits on as a chip (backdrop/circuit-field.tsx) and, loaded once the page has painted
// (components/backdrop/scene.tsx), the 3D scene with Avortyx AI's portrait between the columns,
// wired to the chip: the intro (live strip, headline, one line), its left edge on the logo's, and
// the card (the page's own: here, sign-in), set in a little from the right so the circuit
// has room to run out past it. From 1280px the two stand wide apart; from 2000px (big screens, or zoomed out) they stand
// in from the window's edges, the card an inch further in than the intro, and Avortyx AI at the
// window's centre between them (use-ai-placement.ts). On phones a compact intro sits above the card. In High Contrast (forced
// colours) the backdrop and its lights are hidden: the system's plain ground, with the screen's
// edges and focus drawn in its colours (globals.css).

// `intro`: the headline column beside the card (off for a screen that centres the card).
// `fontClass`: Inter with its optical sizes (app/(login)/font.ts); `.login-screen` (globals.css) tunes
// the dark surface for these screens and switches to that font.
export function AuthShell({ children, intro = true, fontClass }: { children: React.ReactNode; intro?: boolean; fontClass?: string }) {
  const { t } = useTranslation();
  return (
    // entrances and hovers keep still for people who ask for reduced motion
    <MotionConfig reducedMotion="user">
      <main className={cn("dark site-surface login-screen relative isolate min-h-dvh overflow-hidden", fontClass)}>
        <Backdrop />
        <Scene />
        {intro && <CircuitField />}

        <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[86rem] flex-col xl:max-w-[100rem] 2xl:max-w-[118rem] px-5 sm:px-8 lg:px-12 min-[125rem]:max-w-none min-[125rem]:px-[3vw]">
          <header data-header="" className="flex h-[64px] shrink-0 items-center justify-between short:h-[56px] sm:h-[76px] lg:h-[88px] short:lg:h-[64px]">
            <AvortyxLogo id="auth-mark" size="md" />
          </header>

          {/* the intro and the card: apart, with her stage between; from 2000px (zoomed out), the intro in from the left edge by
              14% of the window less 440px (never closer than the logo's 3%), the card in from the right by as much again and an
              inch more (6% of the window), and she at the window's centre.
              (125rem is 2000px at the browser's default size; in rem, Tailwind places it after lg/xl/2xl,
              which a px breakpoint would not be, and lg/xl/2xl would win) */}
          <div className="flex flex-1 items-center justify-center py-4 short:py-2 lg:py-8">
            {intro ? (
              <div className="grid w-full grid-cols-[minmax(0,1fr)] items-center justify-items-center gap-0 lg:grid-cols-[minmax(0,38rem)_348px] lg:justify-between lg:justify-items-start lg:gap-14 lg:pr-[clamp(24px,3vw,120px)] xl:gap-20 min-[125rem]:max-w-none min-[125rem]:justify-between min-[125rem]:gap-x-0 min-[125rem]:pl-[max(0px,calc(11vw-440px))] min-[125rem]:pr-[calc(max(0px,calc(11vw-440px))+6vw)]">
                <HeroPanel />
                {children}
              </div>
            ) : (
              <div className="flex w-full justify-center">{children}</div>
            )}
          </div>

          <footer className="flex shrink-0 flex-col items-center justify-between gap-3 border-t border-white/[0.05] py-4 text-xs text-muted-foreground short:py-3 sm:flex-row sm:py-5">
            <span className="flex items-center gap-3">
              <span>© {new Date().getFullYear()} Avortyx</span>
              <span aria-hidden="true" className="h-3 w-px bg-white/10" />
              <span className="inline-flex items-center gap-[6px]">
                <LockKeyhole aria-hidden="true" className="h-[12px] w-[12px] text-signal-300/80" />
                {t("loginScreen.encrypted")}
              </span>
            </span>
            <nav aria-label={t("loginScreen.legal")} className="flex items-center gap-5">
              <a href="https://www.avortyx.com/terms_of_service" className={`transition hover:text-foreground ${TAP}`}>{t("login.footer.terms")}</a>
              <a href="https://www.avortyx.com/privacy_policy" className={`transition hover:text-foreground ${TAP}`}>{t("login.footer.privacy")}</a>
            </nav>
          </footer>
        </div>
      </main>
    </MotionConfig>
  );
}

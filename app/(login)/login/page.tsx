"use client";

import Link from "next/link";
import { Suspense } from "react";

import { BtcTicker } from "@/components/auth/btc-ticker";
import { HoloScene } from "@/components/auth/holo-scene";
import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { Wordmark } from "@/components/brand/wordmark";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";

/**
 * The sign-in screen: a ring of light (components/auth/holo-scene.tsx), the
 * intro (the live BTC ticker, the headline, one line) on the left edge and
 * the glass sign-in card on the right edge; on phones a compact intro sits
 * above the card.
 *
 * It lives in its own route group, outside `(auth)`, because it is a full
 * screen of its own: the split layout in `app/(auth)/layout.tsx` stays with
 * sign-up, password reset and the invite pages.
 *
 * `dark site-surface` pins the landing page's dark palette (see
 * globals.css); `login-screen` adds this screen's tuning on top of it.
 * `isolate` keeps the `-z-10` backdrop between the surface and the content.
 */

function LoginFormFallback() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-[56px] animate-pulse rounded-2xl bg-white/[0.035]" />
      <div className="h-[56px] animate-pulse rounded-2xl bg-white/[0.035]" />
      <div className="h-[44px] animate-pulse rounded-2xl bg-white/[0.05]" />
    </div>
  );
}

function Headline({ className }: { className: string }) {
  const { t } = useTranslation();
  return (
    <h2 className={className}>
      <span className="whitespace-nowrap">{t("login.intro.lead")}</span>
      {t("login.intro.middle")}
      <span className="bg-[linear-gradient(100deg,var(--color-keppel-200),var(--color-keppel-400)_45%,var(--color-keppel-600))] bg-clip-text text-transparent">
        {t("login.intro.accent")}
      </span>
    </h2>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();

  return (
    <main className="dark site-surface login-screen relative isolate min-h-dvh overflow-hidden">
      <HoloScene />

      {/* depth: a cool glow top-left, a vignette and the lower edge falling into the page (no grain:
          the backdrop dithers itself, and grain would only blur its fine lines) */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10">
        {/* sized from the window, like the backdrop, so they keep their place at any zoom */}
        <div className="absolute -left-[11vmax] -top-[11vmax] h-[46vmax] w-[46vmax] rounded-full bg-[radial-gradient(circle,rgba(59,130,246,0.13),transparent_65%)]" />
        <div className="absolute -bottom-[13vmax] -right-[11vmax] h-[44vmax] w-[53vmax] rounded-full bg-[radial-gradient(circle,rgba(37,99,235,0.07),transparent_65%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(130%_100%_at_50%_45%,transparent_60%,rgba(5,6,10,0.45))]" />
        <div className="absolute inset-x-0 bottom-0 h-[12%] bg-gradient-to-t from-[var(--site-canvas)]/50 to-transparent" />
      </div>

      {/* one centred column (header, intro and card, footer), so on wide screens both sections sit
          evenly about the middle instead of against the window's edges. Zoomed out, the column widens
          with the window's height (152dvh), so the intro and the card stand outside the ring's outer
          circle, where its wave of light fades (components/auth/holo-scene.tsx) */}
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-[max(164rem,calc(71rem+152dvh))] flex-col">
        <header className="flex items-center px-6 pt-6 short:pt-4 lg:px-10 lg:pt-9 short:lg:pt-5 xl:px-12">
          <Wordmark size="md" uid="auth-mark" />
        </header>

        {/* one row: the intro on the left edge, open space, the card on the right edge */}
        <div className="flex flex-1 items-center justify-center lg:justify-between lg:px-10 xl:px-12">
          <aside data-intro="" className="rise-in relative hidden w-[clamp(22rem,33vw,36rem)] shrink-0 lg:block">
            {/* a soft dark shade behind the intro, so it reads over the backdrop */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute -left-24 top-1/2 h-[34rem] w-[42rem] -translate-y-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(11,12,18,0.5),rgba(11,12,18,0.22)_60%,transparent)]"
            />
            <div className="relative space-y-6 short:space-y-4">
              <BtcTicker />
              <Headline className="text-[42px] font-semibold leading-[44px] tracking-[-0.025em] text-balance text-foreground [text-shadow:0_1px_24px_rgba(0,0,0,0.35)] short:text-[36px] short:leading-[38px] xl:text-[50px] xl:leading-[52px] short:xl:text-[40px] short:xl:leading-[42px]" />
              <p className="max-w-md text-[15px] leading-[24px] text-[#c9cbd6]">{t("login.intro.sub")}</p>
            </div>
          </aside>

          {/* the open space between the intro and the card, where the ring sits */}
          <div aria-hidden="true" data-scene-anchor="" className="hidden min-w-[4rem] flex-1 self-stretch lg:block" />

          {/* on windows 1700px and wider (and zoomed out) the card sits in from the right edge by a
              tenth of the window, about 2 inches on a 1920px screen, the same distance at any zoom;
              narrower windows keep it at the edge so the ring keeps its size */}
          <section className="flex w-full flex-col items-center justify-center px-5 pb-6 pt-4 short:pb-4 short:pt-2 min-[1700px]:mr-[10vw] lg:w-auto lg:flex-none lg:px-0 lg:py-12 short:lg:py-3">
            {/* phones: a compact intro above the card */}
            <div className="rise-in mb-6 w-full max-w-[25rem] space-y-3 short:mb-4 lg:hidden">
              <BtcTicker compact />
              {/* on short phones only the live price shows, so the card and footer still fit */}
              <Headline className="text-[24px] font-semibold leading-[28px] tracking-[-0.02em] text-balance text-foreground [text-shadow:0_1px_20px_rgba(0,0,0,0.4)] short:hidden" />
            </div>
            <div data-scene-card="" className="rise-in relative w-full max-w-[25rem] [animation-delay:140ms]">
              {/* the glow under the card */}
              <div aria-hidden="true" className="absolute -inset-10 -z-10 rounded-[3rem] bg-[radial-gradient(closest-side,rgba(59,130,246,0.11),transparent)] blur-2xl" />
              {/* a fine gradient edge around the glass */}
              <div className="relative rounded-[1.6rem] bg-[linear-gradient(150deg,rgba(147,197,253,0.3),rgba(59,130,246,0.06)_32%,rgba(255,255,255,0.05)_62%,rgba(96,165,250,0.2))] p-px shadow-[0_40px_120px_-40px_rgba(0,0,0,0.85),0_0_60px_-28px_rgba(59,130,246,0.3)]">
                {/* a light travelling slowly round the edge (globals.css) */}
                <span aria-hidden="true" className="edge-light" />
                <div className="relative overflow-hidden rounded-[calc(1.6rem-1px)] bg-[#0d0e15]/80 px-7 py-7 backdrop-blur-2xl short:py-6 sm:px-9 sm:py-9">
                  <span aria-hidden="true" className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[var(--color-keppel-300)]/50 to-transparent" />
                  <span aria-hidden="true" className="pointer-events-none absolute -top-24 left-1/2 h-48 w-72 -translate-x-1/2 rounded-full bg-[var(--color-keppel-500)]/[0.08] blur-3xl" />

                  <div className="relative mb-8 flex flex-col items-center gap-5 text-center short:mb-5 short:gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl border border-white/10 bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_24px_-12px_rgba(59,130,246,0.35)] short:h-11 short:w-11 max-lg:short:hidden">
                      <Logo uid="auth" className="h-8 w-8" />
                    </span>
                    <div>
                      <h1 className="text-[26px] font-semibold leading-[32px] tracking-[-0.02em] text-foreground short:text-[22px] short:leading-[28px]">
                        {t("login.welcomeBack")}
                      </h1>
                      <p className="mt-[6px] text-sm text-muted-foreground">{t("login.description")}</p>
                    </div>
                  </div>

                  <div className="relative">
                    {/* useSearchParams() inside LoginForm requires a Suspense boundary. */}
                    <Suspense fallback={<LoginFormFallback />}>
                      <LoginForm />
                    </Suspense>
                  </div>

                  <div className="relative mt-7 border-t border-white/[0.06] pt-6 text-center text-sm text-muted-foreground short:mt-5 short:pt-4">
                    {t("login.newHere")}{" "}
                    <Link
                      href={ROUTES.signup}
                      className="font-medium text-[var(--color-keppel-300)] transition hover:text-[var(--color-keppel-200)]"
                    >
                      {t("login.createAccount")}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="flex flex-col items-center justify-between gap-2 px-6 pb-6 text-xs text-muted-foreground short:pb-3 sm:flex-row lg:px-10 xl:px-12">
          <span>
            © {new Date().getFullYear()} Avortyx · {t("login.footer.tagline")}
          </span>
          <span className="flex gap-4">
            <a href="https://www.avortyx.com/terms_of_service" className="transition hover:text-foreground">
              {t("login.footer.terms")}
            </a>
            <a href="https://www.avortyx.com/privacy_policy" className="transition hover:text-foreground">
              {t("login.footer.privacy")}
            </a>
          </span>
        </footer>
      </div>
    </main>
  );
}

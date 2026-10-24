"use client";

import { useSignInTranslation } from "@/hooks/use-sign-in-translation";
import { LiveTicker } from "./live-ticker";

// The intro beside the card: the live strip, the headline and one line. Its parts rise in one after
// another (CSS, globals.css: .rise-in, so they show without waiting for JavaScript). On phones only
// the strip (compact) and a smaller headline show, above the card, with a stage beside the headline
// where the AI's portrait stands (use-ai-placement.ts; on short screens there's no room, and she
// stands small in the header's corner).

// each part's turn to rise in
const turn = (i: number) => ({ animationDelay: `${0.03 + i * 0.07}s` });

// in the app's languages: <lead, kept on one line><middle><accent, in the gradient> (lib/i18n, login.intro)
function Headline({ className }: { className: string }) {
  const { t } = useSignInTranslation();
  return (
    <h2 className={className}>
      <span className="whitespace-nowrap">{t("login.intro.lead")}</span>
      {t("login.intro.middle")}
      <span className="text-sheen">
        {t("login.intro.accent")}
      </span>
    </h2>
  );
}

export function HeroPanel() {
  const { t } = useSignInTranslation();
  return (
    <aside data-intro="" className="relative w-full max-w-[27rem] lg:max-w-[38rem]">
      {/* a dark shade behind the words, so the backdrop's lines never cross the text at full strength */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-x-10 -inset-y-10 -z-10 forced-colors:hidden bg-[radial-gradient(closest-side,rgba(5,8,18,0.88),rgba(5,8,18,0.62)_60%,transparent)] lg:-inset-x-28 lg:-inset-y-24"
      />

      {/* phones and tablets: compact */}
      <div className="mb-6 space-y-3 short:mb-4 lg:hidden">
        <div className="rise-in" style={turn(0)}>
          <LiveTicker compact />
        </div>
        <div className="flex items-center gap-3 short:hidden">
          <div className="rise-in min-w-0 flex-1" style={turn(1)}>
            <Headline className="font-display text-[26px] font-semibold leading-[30px] tracking-[-0.03em] text-balance text-foreground" />
          </div>
          <div data-ai-stage="" aria-hidden="true" className="h-[136px] w-[116px] shrink-0" />
        </div>
      </div>

      {/* wide screens */}
      <div className="hidden lg:block">
        <div className="rise-in" style={turn(0)}>
          <LiveTicker />
        </div>
        <div className="rise-in mt-7 short:mt-5" style={turn(1)}>
          <Headline className="font-display text-[44px] font-semibold leading-[48px] tracking-[-0.035em] text-balance text-foreground short:text-[38px] short:leading-[42px] xl:text-[56px] xl:leading-[60px] short:xl:text-[44px] short:xl:leading-[48px]" />
        </div>
        <p className="rise-in mt-5 max-w-[30rem] text-[16px] leading-[26px] text-[#a9b8d6] short:mt-3 short:text-[15px] short:leading-[24px]" style={turn(2)}>
          {t("login.intro.sub")}
        </p>
      </div>
    </aside>
  );
}

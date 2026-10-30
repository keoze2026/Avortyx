"use client";

import { Suspense } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { GlassCard } from "./glass-card";
import { SetPasswordForm } from "./set-password-form";
import { TAP } from "./tap";

// the Set Your Password card (app/(login)/set-password/page.tsx): the page publisher and buyer
// invites and approved access requests open, in the sign-in screen's glass card
export function SetPasswordCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      fixed
      title={t("x5.auth.setYourPassword")}
      subtitle={t("x5.auth.setDescription")}
      foot={
        <>
          <span className="mt-[1px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-signal-400/10 text-signal-300 ring-1 ring-inset ring-signal-400/20">
            <KeyRound aria-hidden="true" className="h-[13px] w-[13px]" />
          </span>
          <p className="text-[12px] leading-[18px] text-muted-foreground">
            {t("x5.auth.alreadySetUp")}{" "}
            <Link href={ROUTES.login} className={`font-medium text-signal-300 hover:underline ${TAP}`}>
              {t("common.signIn")}
            </Link>
          </p>
        </>
      }
    >
      {/* useSearchParams() inside the form requires a Suspense boundary. */}
      <Suspense fallback={<div className="h-[260px]" />}>
        <SetPasswordForm />
      </Suspense>
    </GlassCard>
  );
}

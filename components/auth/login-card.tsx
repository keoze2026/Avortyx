"use client";

import Link from "next/link";
import { Link2 } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { GlassCard } from "./glass-card";
import { LoginForm } from "./login-form";
import { TAP } from "./tap";

// the sign-in card; under it, the way to sign up
export function LoginCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      fixed
      title={t("login.welcomeBack")}
      subtitle={t("signIn.subtitle")}
      foot={
        <>
          <span className="mt-[1px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-signal-400/10 text-signal-300 ring-1 ring-inset ring-signal-400/20">
            <Link2 aria-hidden="true" className="h-[13px] w-[13px]" />
          </span>
          <p className="text-[12px] leading-[18px] text-muted-foreground">
            <span className="font-medium text-foreground/90">{t("signIn.inviteLead")}</span> {t("signIn.inviteBody")}
          </p>
        </>
      }
      below={
        <p className="mt-5 text-center text-[13px] text-muted-foreground">
          {t("login.newHere")}{" "}
          <Link href={ROUTES.signup} className={`font-medium text-[var(--color-keppel-300)] transition hover:text-signal-200 ${TAP}`}>
            {t("login.createAccount")}
          </Link>
        </p>
      }
    >
      <LoginForm />
    </GlassCard>
  );
}

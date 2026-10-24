"use client";

import { Link2 } from "lucide-react";
import { useSignInTranslation } from "@/hooks/use-sign-in-translation";
import { GlassCard } from "./glass-card";
import { LoginForm } from "./login-form";

// the sign-in card
export function LoginCard() {
  const { t } = useSignInTranslation();
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
    >
      <LoginForm />
    </GlassCard>
  );
}

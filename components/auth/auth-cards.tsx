"use client";

import { Suspense } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, type LucideIcon } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { ForgotPasswordForm } from "./forgot-password-form";
import { GlassCard } from "./glass-card";
import { InviteForm } from "./invite-form";
import { ResetPasswordForm } from "./reset-password-form";
import { SetPasswordForm } from "./set-password-form";
import { SignupForm } from "./signup-form";
import { TAP } from "./tap";

// The cards of the screens beside sign-in, each in the sign-in screen's glass card and frame
// (components/auth/auth-shell.tsx; the pages are in app/(login)): Set Your Password (publisher and
// buyer invites, approved access requests), Forgot password, Reset password, Request access and the
// role invite. Sir, 31 Oct: these still showed the old page with the rings.

// the card's foot: an icon in its tile, a line and a link back to sign in
function Foot({ icon: Icon, lead, link }: { icon: LucideIcon; lead?: string; link: string }) {
  return (
    <>
      <span className="mt-[1px] grid h-[26px] w-[26px] shrink-0 place-items-center rounded-lg bg-signal-400/10 text-signal-300 ring-1 ring-inset ring-signal-400/20">
        <Icon aria-hidden="true" className="h-[13px] w-[13px]" />
      </span>
      <p className="text-[12px] leading-[18px] text-muted-foreground">
        {lead && <>{lead} </>}
        <Link href={ROUTES.login} className={`font-medium text-signal-300 hover:underline ${TAP}`}>
          {link}
        </Link>
      </p>
    </>
  );
}

// useSearchParams() inside a form requires a Suspense boundary
const FormFallback = () => <div className="h-[200px]" />;

export function SetPasswordCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      fixed
      title={t("x5.auth.setYourPassword")}
      subtitle={t("x5.auth.setDescription")}
      foot={<Foot icon={KeyRound} lead={t("x5.auth.alreadySetUp")} link={t("common.signIn")} />}
    >
      <Suspense fallback={<FormFallback />}>
        <SetPasswordForm />
      </Suspense>
    </GlassCard>
  );
}

export function ForgotPasswordCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      fixed
      title={t("authUI.forgot.pageTitle")}
      subtitle={t("authUI.forgot.pageDescription")}
      foot={<Foot icon={ArrowLeft} link={t("authUI.forgot.backToSignIn")} />}
    >
      <Suspense fallback={<FormFallback />}>
        <ForgotPasswordForm />
      </Suspense>
    </GlassCard>
  );
}

export function ResetPasswordCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      fixed
      title={t("x5.auth.setYourPassword")}
      subtitle={t("x5.auth.resetDescription")}
      foot={<Foot icon={KeyRound} lead={t("x5.auth.alreadyHavePassword")} link={t("common.signIn")} />}
    >
      <Suspense fallback={<FormFallback />}>
        <ResetPasswordForm />
      </Suspense>
    </GlassCard>
  );
}

// the request-access form is longer, so this card is as tall as its content
export function SignupCard() {
  const { t } = useTranslation();
  return (
    <GlassCard
      title={t("y.signup.requestAccess")}
      subtitle={t("y.signup.pageDescription")}
      foot={<Foot icon={KeyRound} lead={t("y.signup.haveAccount")} link={t("y.signup.signIn")} />}
    >
      <SignupForm />
    </GlassCard>
  );
}

export function InviteCard({ role, token }: { role: "buyer" | "publisher"; token: string }) {
  const { t } = useTranslation();
  const roleLabel = role === "buyer" ? t("authUI.invite.roleBuyer") : t("authUI.invite.rolePublisher");
  const roleLower = role === "buyer" ? t("authUI.invite.roleBuyerLower") : t("authUI.invite.rolePublisherLower");
  return (
    <GlassCard
      title={t("authUI.invite.pageTitleTemplate").replace("{role}", roleLabel)}
      subtitle={t("authUI.invite.pageDescriptionTemplate").replace("{role}", roleLabel).replace("{roleLower}", roleLower)}
      foot={<Foot icon={KeyRound} lead={t("authUI.invite.footerHasAccount")} link={t("authUI.invite.footerSignIn")} />}
    >
      <InviteForm role={role} token={token} />
    </GlassCard>
  );
}

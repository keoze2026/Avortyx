"use client";

/**
 * /reset-password — where two backend emails send people:
 *   • a Workspace member invite ("Set your password to activate your account")
 *   • Forgot password ("Reset your password")
 * Both carry `?token=…` (a password-reset token). This page did not exist,
 * so both links landed on the 404 page.
 *
 * (Partner invites and approved access requests use /set-password, which is
 * a different token and endpoint.)
 */

import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";

function ResetPasswordFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <AuthCard
        title={t("x5.auth.setYourPassword")}
        description={t("x5.auth.resetDescription")}
        footer={
          <>
            {t("x5.auth.alreadyHavePassword")}{" "}
            <Link href={ROUTES.login} className="text-accent hover:underline">
              {t("common.signIn")}
            </Link>
          </>
        }
      >
        {/* useSearchParams() inside the form requires a Suspense boundary. */}
        <Suspense fallback={<ResetPasswordFallback />}>
          <ResetPasswordForm />
        </Suspense>
      </AuthCard>
    </div>
  );
}

"use client";

/**
 * /set-password — landing page for the one-time link the backend emails
 * after an admin approves an access request. The token comes in as a query
 * param; the form component reads it via useSearchParams().
 */

import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { SetPasswordForm } from "@/components/auth/set-password-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";

function SetPasswordFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-14 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function SetPasswordPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <AuthCard
        title={t("x5.auth.setYourPassword")}
        description={t("x5.auth.setDescription")}
        footer={
          <>
            {t("x5.auth.alreadySetUp")}{" "}
            <Link href={ROUTES.login} className="text-accent hover:underline">
              {t("common.signIn")}
            </Link>
          </>
        }
      >
        {/* useSearchParams() inside the form requires a Suspense boundary. */}
        <Suspense fallback={<SetPasswordFallback />}>
          <SetPasswordForm />
        </Suspense>
      </AuthCard>
    </div>
  );
}

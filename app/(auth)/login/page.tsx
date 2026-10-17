"use client";

import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/components/auth/auth-card";
import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";

function LoginFormFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  );
}

export default function LoginPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <AuthCard
        title={t("login.welcomeBack")}
        description={t("login.description")}
        footer={
          <>
            {t("login.newHere")}{" "}
            <Link href={ROUTES.signup} className="text-accent hover:underline">
              {t("login.createAccount")}
            </Link>
          </>
        }
      >
        {/* useSearchParams() inside LoginForm requires a Suspense boundary. */}
        <Suspense fallback={<LoginFormFallback />}>
          <LoginForm />
        </Suspense>
      </AuthCard>
    </div>
  );
}

"use client";

/**
 * Request access page — Avortyx is invite-only, so the public "sign up"
 * route is actually a contact form. Existing accounts use /login.
 */

import Link from "next/link";

import { AuthCard } from "@/components/auth/auth-card";
import { SignupForm } from "@/components/auth/signup-form";
import { ROUTES } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

export default function SignupPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center">
      <AuthCard
        title={t("y.signup.requestAccess")}
        description={t("y.signup.pageDescription")}
        footer={
          <>
            {t("y.signup.haveAccount")}{" "}
            <Link href={ROUTES.login} className="text-accent hover:underline">
              {t("y.signup.signIn")}
            </Link>
          </>
        }
      >
        <SignupForm />
      </AuthCard>
    </div>
  );
}

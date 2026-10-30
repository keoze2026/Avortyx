import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordCard } from "@/components/auth/auth-cards";
import { loginFont } from "../font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/** /forgot-password — "Forgot password?" on /login, in the sign-in screen's frame. */
export default function ForgotPasswordPage() {
  return (
    <AuthShell fontClass={loginFont.variable}>
      <ForgotPasswordCard />
    </AuthShell>
  );
}

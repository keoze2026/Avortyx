import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordCard } from "@/components/auth/auth-cards";
import { loginFont } from "../font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /reset-password — where two backend emails send people:
 *   • a Workspace member invite ("Set your password to activate your account")
 *   • Forgot password ("Reset your password")
 * Both carry `?token=…` (a password-reset token).
 *
 * (Partner invites and approved access requests use /set-password, which is
 * a different token and endpoint.)
 */
export default function ResetPasswordPage() {
  return (
    <AuthShell fontClass={loginFont.variable}>
      <ResetPasswordCard />
    </AuthShell>
  );
}

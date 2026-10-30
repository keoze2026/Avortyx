import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { SetPasswordCard } from "@/components/auth/auth-cards";
import { loginFont } from "../font";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

/**
 * /set-password — the page publisher and buyer invites (and approved access
 * requests) link to, with a one-time `?token=`. It sits in the sign-in
 * screen's frame (components/auth/auth-shell.tsx), so the invited partner
 * sees the same page as /login (Sir, 31 Oct: "Still old font coming on
 * publisher and buyer invite").
 */
export default function SetPasswordPage() {
  return (
    <AuthShell fontClass={loginFont.variable}>
      <SetPasswordCard />
    </AuthShell>
  );
}

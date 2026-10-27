import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { LoginCard } from "@/components/auth/login-card";
import { loginFont } from "../font";

/** CH-319: the page Google lists for Avortyx (app.avortyx.io/login). */
export const metadata: Metadata = {
  alternates: { canonical: "/login" },
  robots: { index: true, follow: false },
};

/**
 * The sign-in screen: Avortyx AI's 3D portrait between the intro and the
 * glass sign-in card (components/auth/auth-shell.tsx, login-card.tsx).
 *
 * It lives in its own route group, outside `(auth)`, because it is a full
 * screen of its own: the split layout in `app/(auth)/layout.tsx` stays with
 * sign-up, password reset and the invite pages.
 */
export default function LoginPage() {
  return (
    <AuthShell fontClass={loginFont.variable}>
      <LoginCard />
    </AuthShell>
  );
}

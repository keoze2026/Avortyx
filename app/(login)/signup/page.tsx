import { AuthShell } from "@/components/auth/auth-shell";
import { SignupCard } from "@/components/auth/auth-cards";
import { loginFont } from "../font";

/**
 * Request access page — Avortyx is invite-only, so the public "sign up"
 * route is actually a contact form. Existing accounts use /login.
 */
export default function SignupPage() {
  return (
    <AuthShell fontClass={loginFont.variable}>
      <SignupCard />
    </AuthShell>
  );
}

"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSecurityStore } from "@/lib/store/security-store";
import { ROUTES } from "@/lib/constants";

/**
 * Two-step login (admin-only):
 *   1. Credentials  → email/password (always)
 *   2. MFA challenge → 6-digit Authenticator code (only when backend says
 *      mfa_required after step 1)
 *
 * MFA verification is now backend-driven: `useAuthStore.login` returns
 * `null` when the backend signals MFA-required (with a temp_token persisted
 * in the store). The form then collects the 6-digit code and calls
 * `completeMfa(code)`, which hits POST /api/accounts/verify-mfa to get the
 * real session tokens.
 *
 * Buyers and publishers do NOT sign in here — they get a role-scoped invite
 * link emailed to them and accept at /invite/[role]/[token]. Keeping the
 * primary login admin-only makes the surface honest and removes the role
 * picker that used to confuse demos.
 */
export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { t } = useTranslation();
  const login = useAuthStore((s) => s.login);
  const completeMfa = useAuthStore((s) => s.completeMfa);
  const cancelMfa = useAuthStore((s) => s.cancelMfa);
  const pendingMfa = useAuthStore((s) => s.pendingMfa);
  const resetSecurity = useSecurityStore((s) => s.reset);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);

  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  const finishLogin = () => {
    // A new login always starts locked: drop any previous PIN state; the
    // server is asked again once the session is up.
    resetSecurity();
    router.push(params.get("from") || ROUTES.dashboard);
  };

  const onCredentialsSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    try {
      const user = await login(email, password, "admin");
      if (!user) {
        // MFA challenge — wait for the user to enter the 6-digit code. The
        // store's `pendingMfa` is now set; the JSX below re-renders the
        // challenge step.
        toast.success("Password accepted — enter your authenticator code");
        setCode("");
        return;
      }
      toast.success("Welcome back to Avortyx");
      finishLogin();
    } catch (e) {
      toast.error(friendlyErrorMessage(e, "Sign in failed"));
    } finally {
      setPending(false);
    }
  };

  const onTwoFactorSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== 6 || verifying) return;
    setVerifying(true);
    try {
      await completeMfa(code, "admin");
      toast.success("Welcome back to Avortyx");
      finishLogin();
    } catch (e) {
      toast.error(
        friendlyErrorMessage(e, "Invalid code — check Google Authenticator and try again"),
      );
    } finally {
      setVerifying(false);
    }
  };

  if (pendingMfa) {
    return (
      <form onSubmit={onTwoFactorSubmit} className="space-y-5">
        <div className="flex items-center gap-3 rounded-lg border border-accent/30 bg-accent/8 p-3">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-accent/15 text-accent">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="text-xs">
            <div className="font-semibold text-foreground">
              {t("login.twoFactor.title")}
            </div>
            <p className="text-muted-foreground">
              {t("login.twoFactor.description")}{" "}
              <span className="font-mono text-foreground">{email}</span>.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="totp-login">{t("login.twoFactor.label")}</Label>
          <Input
            id="totp-login"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) =>
              setCode(e.target.value.replace(/\D/g, "").slice(0, 6))
            }
            maxLength={6}
            placeholder="123 456"
            className="text-center font-mono text-lg tracking-[0.5em]"
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            {t("login.twoFactor.hint")}
          </p>
        </div>

        <Button type="submit" className="w-full" disabled={code.length !== 6 || verifying}>
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : (
            <>
              {t("login.twoFactor.verify")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <button
          type="button"
          onClick={() => {
            cancelMfa();
            setCode("");
          }}
          className="block w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {t("login.twoFactor.back")}
        </button>
      </form>
    );
  }

  return (
    <form
      onSubmit={onCredentialsSubmit}
      className="space-y-4"
      autoComplete="off"
      // Chrome ignores autoComplete="off" on forms unless the page also
      // signals it as a non-credential form. The off-spec `aria-autocomplete`
      // is harmless and most extensions/managers respect the input-level
      // hints set below ("off" + new-password).
    >
      <div className="space-y-2">
        <Label htmlFor="email">{t("login.email")}</Label>
        <Input
          id="email"
          name="avortyx-email"
          type="email"
          autoComplete="off"
          // Chromium responds to data-* and arbitrary autocomplete values by
          // not surfacing saved-password offers for this field. Used alongside
          // a non-standard field name (`name="avortyx-email"`) so the password
          // manager doesn't match a generic `email` field.
          data-lpignore="true"
          data-1p-ignore="true"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">{t("login.password")}</Label>
          <a
            href={ROUTES.forgotPassword}
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            {t("login.forgot")}
          </a>
        </div>
        <div className="relative">
          <Input
            id="password"
            name="avortyx-password"
            type={showPassword ? "text" : "password"}
            // `new-password` is the standard hint that tells browsers
            // "this isn't the field you saved a credential for" — they
            // skip the autofill prompt.
            autoComplete="new-password"
            data-lpignore="true"
            data-1p-ignore="true"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="pr-10"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground">
        {t("login.inviteHint")}
      </p>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("login.signingIn")}
          </>
        ) : (
          <>
            {t("login.signIn")} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

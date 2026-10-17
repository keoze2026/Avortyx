"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowRight,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSecurityStore } from "@/lib/store/security-store";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";

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
 *
 * Styled for the dark glass card of the sign-in screen
 * (app/(login)/login/page.tsx); expects to render inside `.login-screen`.
 */

/**
 * A field whose label sits inside it like a placeholder, then floats to the
 * top edge when the field has focus or a value. Icon and label come after the
 * input in the markup so they can follow its state (peer-focus,
 * peer-placeholder-shown) — which is why `placeholder` is always " ".
 */
function FloatingField({
  id,
  label,
  icon: Icon,
  trailing,
  className,
  ...input
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  trailing?: ReactNode;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "placeholder">) {
  return (
    <div className="relative">
      <input
        id={id}
        placeholder=" "
        className={cn(
          "peer h-[56px] w-full rounded-2xl border border-white/10 bg-white/[0.035] pb-[4px] pl-[44px] pt-[20px] text-[14px] leading-[20px] text-foreground outline-none",
          "shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition-[border-color,background-color,box-shadow] duration-200",
          "hover:border-white/20 focus:border-[var(--color-keppel-400)]/70 focus:bg-white/[0.055]",
          "focus:shadow-[0_0_0_4px_rgba(59,130,246,0.12),0_8px_30px_-14px_rgba(59,130,246,0.3),inset_0_1px_0_rgba(255,255,255,0.05)]",
          trailing ? "pr-12" : "pr-4",
          className,
        )}
        {...input}
      />
      <Icon
        aria-hidden="true"
        className="pointer-events-none absolute left-[16px] top-[20px] h-[16px] w-[16px] text-muted-foreground transition-colors duration-200 peer-focus:text-[var(--color-keppel-300)] peer-[:not(:placeholder-shown)]:text-foreground/70"
      />
      <label
        htmlFor={id}
        className={cn(
          // placed in whole pixels, never shifted by half its height, so the text stays sharp
          "pointer-events-none absolute left-[44px] top-[21px] origin-left text-[14px] leading-[14px] text-muted-foreground transition-all duration-200",
          // floated: small, near the top edge
          "peer-focus:top-[10px] peer-focus:text-[12px] peer-focus:font-medium peer-focus:tracking-[0.03em] peer-focus:text-[var(--color-keppel-300)]",
          "peer-[:not(:placeholder-shown)]:top-[10px] peer-[:not(:placeholder-shown)]:text-[12px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:tracking-[0.03em]",
        )}
      >
        {label}
      </label>
      {trailing}
    </div>
  );
}

/** The card's primary action: the brand gradient, with a light sweep on hover. */
function SubmitButton({ disabled, children }: { disabled?: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={disabled}
      className="group relative flex h-[44px] w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,var(--color-keppel-500),var(--color-keppel-600)_55%,var(--color-keppel-700))] text-[14px] font-semibold text-white shadow-[0_10px_28px_-12px_rgba(59,130,246,0.45),inset_0_1px_0_rgba(255,255,255,0.18)] outline-none transition hover:brightness-110 focus-visible:ring-4 focus-visible:ring-[var(--color-keppel-400)]/30 active:scale-[0.99] disabled:pointer-events-none disabled:opacity-60"
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-0 -left-1/2 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/15 to-transparent opacity-0 transition-all duration-700 group-hover:left-full group-hover:opacity-100"
      />
      {children}
    </button>
  );
}

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
      <form onSubmit={onTwoFactorSubmit} className="space-y-4 short:space-y-3">
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-keppel-400)]/25 bg-[var(--color-keppel-500)]/[0.08] px-[12px] py-[10px]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[var(--color-keppel-500)]/15 text-[var(--color-keppel-300)]">
            <ShieldCheck className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-xs leading-[18px]">
            <div className="font-semibold text-foreground">{t("login.twoFactor.title")}</div>
            <p className="text-muted-foreground">
              {t("login.twoFactor.description")}{" "}
              <span className="font-mono text-foreground [overflow-wrap:anywhere]">{email}</span>.
            </p>
          </div>
        </div>

        <div className="space-y-[10px]">
          <FloatingField
            id="totp-login"
            name="totp-login"
            label={t("login.twoFactor.label")}
            icon={KeyRound}
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            maxLength={6}
            autoFocus
            required
            className="font-mono tracking-[0.5em]"
          />
          <p className="text-[11px] leading-[16px] text-muted-foreground">
            {t("login.twoFactor.hint")}
          </p>
        </div>

        <SubmitButton disabled={code.length !== 6 || verifying}>
          {verifying ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying…
            </>
          ) : (
            <>
              {t("login.twoFactor.verify")}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </SubmitButton>

        <button
          type="button"
          onClick={() => {
            cancelMfa();
            setCode("");
          }}
          className="block w-full text-center text-xs text-muted-foreground transition-colors hover:text-[var(--color-keppel-300)]"
        >
          {t("login.twoFactor.back")}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={onCredentialsSubmit} className="space-y-4 short:space-y-3" autoComplete="off">
      <FloatingField
        id="email"
        // A non-standard field name (`avortyx-email`) plus the data-* hints
        // keep password managers from matching a generic `email` field and
        // surfacing saved-credential offers.
        name="avortyx-email"
        type="email"
        label={t("login.email")}
        icon={Mail}
        autoComplete="off"
        data-lpignore="true"
        data-1p-ignore="true"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />

      <div className="space-y-[10px]">
        <FloatingField
          id="password"
          name="avortyx-password"
          type={showPassword ? "text" : "password"}
          label={t("login.password")}
          icon={LockKeyhole}
          // `new-password` tells browsers "this isn't the field you saved a
          // credential for" — they skip the autofill prompt.
          autoComplete="new-password"
          data-lpignore="true"
          data-1p-ignore="true"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-[10px] top-[10px] grid h-[36px] w-[36px] place-items-center rounded-xl text-muted-foreground transition hover:bg-white/5 hover:text-foreground"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
        />
        <div className="flex justify-end">
          <a
            href={ROUTES.forgotPassword}
            className="text-xs text-muted-foreground transition-colors hover:text-[var(--color-keppel-300)]"
          >
            {t("login.forgot")}
          </a>
        </div>
      </div>

      <SubmitButton disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("login.signingIn")}
          </>
        ) : (
          <>
            {t("login.signIn")}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </>
        )}
      </SubmitButton>

      <p className="flex gap-[10px] rounded-xl border border-white/[0.06] bg-white/[0.02] px-[12px] py-[10px] text-xs leading-[18px] text-muted-foreground">
        <Info className="mt-[2px] h-[14px] w-[14px] shrink-0 text-[var(--color-keppel-300)]" />
        {t("login.inviteHint")}
      </p>
    </form>
  );
}

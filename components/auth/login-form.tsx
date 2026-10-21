"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowBigUp, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { signalBackdrop } from "@/components/backdrop/backdrop-signal";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useSecurityStore } from "@/lib/store/security-store";
import { EmailCheck, FloatingField, FormNote, PrimaryButton, emailProblem } from "./form-parts";

// The sign-in form (admin-only; buyers and publishers use their invite links), in two steps, as the
// app's form signs in:
//  1. email and password, sent with the auth store's `login` (POST /api/accounts/login);
//  2. when the backend answers that a code is needed (`pendingMfa`), the 6-digit authenticator code,
//     sent with `completeMfa` (POST /api/accounts/verify-mfa).
// Signed in, it drops any earlier PIN state and goes on to ?from= or the dashboard; if not, what the
// server said shows in the note under the form. Success and the code step are also toasted.
// It checks its own fields first (no browser bubbles): an empty or malformed field gets a soft red rim and a
// line under it, read out, and takes the focus. It tells the backdrop when a field has focus, when
// a valid sign-in is sent and how it went (backdrop-signal.ts), and warns when Caps Lock is on in the password.
// "Forgot password?" carries the email typed so far over to the reset screen.

// what's wrong with the fields, if anything (translation keys)
function check(email: string, password: string) {
  return { email: emailProblem(email), password: password ? undefined : "signIn.passwordRequired" };
}

export function LoginForm() {
  const router = useRouter();
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
  const [note, setNote] = useState("");
  const [capsLock, setCapsLock] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [code, setCode] = useState("");
  const readCaps = (e: React.KeyboardEvent) => setCapsLock(e.getModifierState("CapsLock"));

  // signed in: a new login always starts locked (any previous PIN state goes; the server is asked
  // again once the session is up), then on to where the user was headed
  function finishLogin() {
    signalBackdrop({ kind: "result", ok: true });
    resetSecurity();
    router.push(new URLSearchParams(window.location.search).get("from") || ROUTES.dashboard);
  }

  function failed(e: unknown, fallback: string) {
    setNote(friendlyErrorMessage(e, fallback));
    signalBackdrop({ kind: "result", ok: false });
  }

  async function signIn() {
    signalBackdrop({ kind: "submit" });
    setPending(true);
    setNote("");
    try {
      // null: the backend wants the authenticator code (`pendingMfa` is now set)
      if (await login(email.trim(), password, "admin")) {
        toast.success(t("y.login.welcomeBack"));
        finishLogin();
      } else {
        toast.success(t("y.login.passwordAccepted"));
        signalBackdrop({ kind: "blur" });
      }
    } catch (e) {
      failed(e, t("y.login.signInFailed"));
    } finally {
      setPending(false);
    }
  }

  async function verify() {
    signalBackdrop({ kind: "submit" });
    setPending(true);
    setNote("");
    try {
      await completeMfa(code, "admin");
      toast.success(t("y.login.welcomeBack"));
      finishLogin();
    } catch (e) {
      failed(e, t("y.login.invalidCode"));
    } finally {
      setPending(false);
    }
  }

  // tells the backdrop while one of the form's fields has focus
  const focusProps = {
    onFocus: () => signalBackdrop({ kind: "focus" }),
    onBlur: (e: React.FocusEvent<HTMLFormElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) signalBackdrop({ kind: "blur" });
    },
  };

  if (pendingMfa) {
    return (
      <form
        className="space-y-4 short:space-y-3"
        noValidate
        {...focusProps}
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6 && !pending) verify();
        }}
      >
        <div className="flex items-center gap-3 rounded-xl border border-[var(--color-keppel-400)]/25 bg-[var(--color-keppel-500)]/[0.08] px-[12px] py-[10px]">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-signal-400/10 text-signal-300 ring-1 ring-inset ring-signal-400/25">
            <ShieldCheck aria-hidden="true" className="h-4 w-4" />
          </span>
          <div className="min-w-0 text-xs leading-[18px]">
            <div className="font-semibold text-foreground">{t("login.twoFactor.title")}</div>
            <p className="text-muted-foreground">
              {t("login.twoFactor.description")} <span className="font-mono text-foreground [overflow-wrap:anywhere]">{email.trim()}</span>.
            </p>
          </div>
        </div>

        <div className="space-y-[10px]">
          <FloatingField
            id="totp-login"
            name="totp-login"
            type="text"
            label={t("login.twoFactor.label")}
            icon={KeyRound}
            autoComplete="one-time-code"
            inputProps={{
              inputMode: "numeric",
              maxLength: 6,
              autoFocus: true,
              value: code,
              onChange: (e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6)),
              className: "font-mono tracking-[0.5em]",
            }}
          />
          <p className="pl-[4px] text-[11px] leading-[16px] text-muted-foreground">{t("login.twoFactor.hint")}</p>
        </div>

        <PrimaryButton pending={pending} disabled={code.length !== 6} idle={t("login.twoFactor.verify")} busy={t("login.signingIn")} />

        <button
          type="button"
          onClick={() => {
            cancelMfa();
            setCode("");
            setNote("");
          }}
          className="block w-full rounded text-center text-xs text-muted-foreground transition-colors hover:text-signal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400/60"
        >
          {t("login.twoFactor.back")}
        </button>

        <FormNote note={note} />
      </form>
    );
  }

  return (
    <form
      className="space-y-4 short:space-y-3"
      noValidate
      autoComplete="off"
      {...focusProps}
      onSubmit={(e) => {
        e.preventDefault();
        if (pending) return;
        const found = check(email, password);
        setErrors(found);
        if (found.email || found.password) {
          document.getElementById(found.email ? "email" : "password")?.focus();
          return;
        }
        signIn();
      }}
    >
      <FloatingField
        id="email"
        // A non-standard field name (`avortyx-email`) plus the data-* hints
        // keep password managers from matching a generic `email` field and
        // surfacing saved-credential offers.
        name="avortyx-email"
        type="email"
        label={t("signIn.workEmail")}
        icon={Mail}
        autoComplete="off"
        error={errors.email && t(errors.email)}
        inputProps={{
          value: email,
          onChange: (e) => {
            setEmail(e.target.value);
            // a field's message clears as soon as it is edited
            if (errors.email) setErrors((x) => ({ ...x, email: undefined }));
          },
        }}
        trailing={<EmailCheck ok={!emailProblem(email)} />}
      />

      <div className="space-y-[10px]">
        <FloatingField
          id="password"
          name="avortyx-password"
          type={showPassword ? "text" : "password"}
          label={t("login.password")}
          error={errors.password && t(errors.password)}
          icon={LockKeyhole}
          // `new-password` tells browsers "this isn't the field you saved a
          // credential for" — they skip the autofill prompt.
          autoComplete="new-password"
          inputProps={{
            value: password,
            onChange: (e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            },
            onKeyDown: readCaps,
            onKeyUp: readCaps,
            onBlur: () => setCapsLock(false),
            "aria-describedby": capsLock ? "caps-lock" : undefined,
          }}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-[9px] top-[9px] grid h-[36px] w-[36px] place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-signal-400/40"
              aria-label={t(showPassword ? "signIn.hidePassword" : "signIn.showPassword")}
              aria-pressed={showPassword}
            >
              {/* the eye turns over as it swaps */}
              <AnimatePresence mode="wait" initial={false}>
                <motion.span
                  key={showPassword ? "hide" : "show"}
                  initial={{ opacity: 0, rotate: -70, scale: 0.6 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={{ opacity: 0, rotate: 70, scale: 0.6 }}
                  transition={{ duration: 0.16, ease: "easeOut" }}
                  className="grid place-items-center"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </motion.span>
              </AnimatePresence>
            </button>
          }
        />
        {/* Caps Lock warning, read out when it appears */}
        <div aria-live="polite">
          <AnimatePresence initial={false}>
            {capsLock && (
              <motion.p
                id="caps-lock"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.18 }}
                className="overflow-hidden"
              >
                <span className="flex items-center gap-[6px] pb-[2px] pl-[4px] text-xs text-[#f5cf8a]">
                  <ArrowBigUp aria-hidden="true" className="h-[14px] w-[14px]" />
                  {t("signIn.capsLock")}
                </span>
              </motion.p>
            )}
          </AnimatePresence>
        </div>
        <div className="flex justify-end">
          <Link
            href={ROUTES.forgotPassword}
            onClick={(e) => {
              const typed = email.trim();
              if (!typed) return;
              e.preventDefault();
              router.push(`${ROUTES.forgotPassword}?email=${encodeURIComponent(typed)}`);
            }}
            className="rounded text-xs text-muted-foreground transition-colors hover:text-signal-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal-400/60"
          >
            {t("signIn.forgotPassword")}
          </Link>
        </div>
      </div>

      <PrimaryButton pending={pending} idle={t("login.signIn")} busy={t("login.signingIn")} />

      <FormNote note={note} />
    </form>
  );
}

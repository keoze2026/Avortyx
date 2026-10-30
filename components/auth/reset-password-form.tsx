"use client";

/**
 * Reset / first-time password form for /reset-password?token=…
 *
 * Sends POST /api/accounts/password-reset/confirm { token, new_password }.
 * The same link serves a new Workspace member (first password) and anyone
 * who used Forgot password. On success the person is sent to sign in with
 * their email address and the new password.
 *
 * Built from the sign-in form's parts (form-parts.tsx) so it sits in the
 * sign-in screen's glass card.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, LockKeyhole } from "lucide-react";

import { authService } from "@/lib/api/services/auth.service";
import { ROUTES } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";
import { FloatingField, FormNote, PrimaryButton } from "./form-parts";

const MIN_PASSWORD_LENGTH = 8;

function friendlyError(err: unknown, t: (key: string) => string): string {
  const msg = err instanceof Error ? err.message : "";
  if (/invalid or expired/i.test(msg)) {
    return t("y.auth.resetLinkExpired");
  }
  if (/too many/i.test(msg)) return t("y.auth.tooManyAttempts");
  return msg || t("y.auth.setPasswordFailed");
}

export function ResetPasswordForm() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useSearchParams();
  const token = useMemo(() => params.get("token") ?? "", [params]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-base font-semibold text-foreground">{t("y.auth.linkIncomplete")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("y.auth.noTokenHint").split("{link}")[0]}
          <a href={ROUTES.forgotPassword} className="text-signal-300 hover:underline">
            {t("y.auth.forgotPassword")}
          </a>
          {t("y.auth.noTokenHint").split("{link}")[1]}
        </p>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const found = {
      password:
        password.length < MIN_PASSWORD_LENGTH
          ? t("y.auth.passwordMin").replace("{min}", String(MIN_PASSWORD_LENGTH))
          : undefined,
      confirm: password !== confirm ? t("y.auth.passwordsMismatch") : undefined,
    };
    if (found.password || found.confirm) {
      setErrors(found);
      document.getElementById(found.password ? "rp-password" : "rp-confirm")?.focus();
      return;
    }
    setPending(true);
    setNote("");
    try {
      await authService.confirmPasswordReset(token, password);
      toast.success(t("y.auth.passwordSet"));
      router.push(ROUTES.login);
    } catch (err) {
      const message = friendlyError(err, t);
      setNote(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-[14px]" autoComplete="off">
      <div className="space-y-[6px]">
        <FloatingField
          id="rp-password"
          name="avortyx-new-password"
          type={showPassword ? "text" : "password"}
          label={t("y.auth.newPassword")}
          icon={LockKeyhole}
          autoComplete="new-password"
          error={errors.password}
          inputProps={{
            value: password,
            autoFocus: true,
            onChange: (e) => {
              setPassword(e.target.value);
              if (errors.password) setErrors((x) => ({ ...x, password: undefined }));
            },
          }}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-[9px] top-[9px] grid h-[36px] w-[36px] place-items-center rounded-xl text-muted-foreground outline-none transition-colors hover:bg-white/5 hover:text-foreground focus-visible:ring-2 focus-visible:ring-signal-400/40"
              aria-label={showPassword ? t("y.auth.hidePassword") : t("y.auth.showPassword")}
              aria-pressed={showPassword}
            >
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
        {!errors.password && (
          <p className="pl-[4px] text-[11px] leading-[16px] text-muted-foreground">
            {t("y.auth.passwordHint").replace("{min}", String(MIN_PASSWORD_LENGTH))}
          </p>
        )}
      </div>

      <FloatingField
        id="rp-confirm"
        name="avortyx-confirm-password"
        type={showPassword ? "text" : "password"}
        label={t("y.auth.confirmPassword")}
        icon={LockKeyhole}
        autoComplete="new-password"
        error={errors.confirm}
        inputProps={{
          value: confirm,
          onChange: (e) => {
            setConfirm(e.target.value);
            if (errors.confirm) setErrors((x) => ({ ...x, confirm: undefined }));
          },
        }}
      />

      <PrimaryButton pending={pending} idle={t("y.auth.setPassword")} busy={t("y.auth.saving")} />

      <FormNote note={note} />
    </form>
  );
}

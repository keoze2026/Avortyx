"use client";

/**
 * Set-password form — lands here from the one-time link the backend emails
 * after an admin approves an access request, or with a publisher or buyer
 * invite. Consumes the `?token=…` query param, asks the user for a password,
 * and POSTs to /api/accounts/access-requests/set-password/.
 *
 * On success the endpoint returns login-shape tokens; we persist them, kick
 * the auth store to re-bootstrap (so /me hydrates the full profile), and
 * redirect into the app.
 *
 * Built from the sign-in form's parts (form-parts.tsx) so it sits in the
 * sign-in screen's glass card (set-password-card.tsx) and looks the same.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Eye, EyeOff, LockKeyhole } from "lucide-react";

import { ApiError } from "@/lib/api/http";
import { accessRequestsService } from "@/lib/api/services/access-requests.service";
import { setTokens } from "@/lib/api/tokens";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useTranslation } from "@/hooks/use-translation";
import { FloatingField, FormNote, PrimaryButton } from "./form-parts";

const MIN_PASSWORD_LENGTH = 8;

/** Translate the backend's documented error codes into a friendlier message
 *  the user can act on. Falls back to the raw message for anything else. */
function friendlyError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    const code = (err.message ?? "").toLowerCase();
    if (code.includes("token_expired"))
      return t("y.auth.setupExpired");
    if (code.includes("token_already_used"))
      return t("y.auth.setupUsed");
    if (code.includes("token_invalid"))
      return t("y.auth.setupInvalid");
    if (code.includes("password_too_weak"))
      return t("y.auth.passwordWeak");
  }
  if (err instanceof Error) return err.message;
  return t("y.auth.setPasswordFailed");
}

export function SetPasswordForm() {
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

  // If the email link was broken / pasted without the token, render a clear
  // error instead of letting the user submit an empty token.
  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-base font-semibold text-foreground">{t("y.auth.setupMissing")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("y.auth.setupMissingHint")}{" "}
          <a href="mailto:hello@avortyx.io" className="text-signal-300 hover:underline">
            hello@avortyx.io
          </a>
          .
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
      document.getElementById(found.password ? "password" : "confirm")?.focus();
      return;
    }

    setPending(true);
    setNote("");
    try {
      const res = await accessRequestsService.setPassword({ token, password });
      // Persist the tokens so the HTTP client picks them up on the next call.
      setTokens({ access: res.access, refresh: res.refresh });
      // Hydrate the auth store from /me so the rest of the app sees the user.
      await useAuthStore.getState().bootstrap();
      toast.success(t("y.auth.welcomeSignedIn"));
      router.push(ROUTES.dashboard);
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
      <div className="flex items-start gap-[10px] rounded-xl border border-signal-400/20 bg-signal-400/[0.06] px-[12px] py-[10px]">
        <CheckCircle2 aria-hidden="true" className="mt-[1px] h-[15px] w-[15px] shrink-0 text-signal-300" />
        <p className="text-[12px] leading-[18px] text-muted-foreground">{t("y.auth.approvedSetPassword")}</p>
      </div>

      <div className="space-y-[6px]">
        <FloatingField
          id="password"
          name="avortyx-new-password"
          type={showPassword ? "text" : "password"}
          label={t("y.auth.password")}
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
        id="confirm"
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

      <PrimaryButton pending={pending} idle={t("y.auth.setPasswordSignIn")} busy={t("y.auth.settingPassword")} />

      <FormNote note={note} />
    </form>
  );
}

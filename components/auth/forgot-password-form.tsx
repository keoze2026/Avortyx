"use client";

/**
 * Forgot-password form (/forgot-password): asks for the email and sends the
 * reset link. Built from the sign-in form's parts (form-parts.tsx) so it sits
 * in the sign-in screen's glass card. The email typed on /login comes over in
 * `?email=` ("Forgot password?" there passes it on).
 */

import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Mail, MailCheck } from "lucide-react";

import { useSignInTranslation } from "@/hooks/use-sign-in-translation";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { authService } from "@/lib/api/services/auth.service";
import { EmailCheck, FloatingField, FormNote, PrimaryButton, emailProblem } from "./form-parts";

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const { t: tSignIn } = useSignInTranslation();
  const params = useSearchParams();
  const [email, setEmail] = useState(() => params.get("email") ?? "");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string>();

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    const problem = emailProblem(trimmed);
    if (problem) {
      setError(tSignIn(problem));
      document.getElementById("forgot-email")?.focus();
      return;
    }
    setPending(true);
    setNote("");
    try {
      // Real backend call — POST /api/accounts/password-reset/request.
      // We always show "sent" on a 2xx (and even on most 4xx) because
      // confirming whether an email exists is itself a security leak.
      // Backend should also respond uniformly to avoid user enumeration.
      await authService.requestPasswordReset(trimmed);
      setSent(true);
      toast.success(t("authUI.forgot.toastSent"));
    } catch (e) {
      const message = friendlyErrorMessage(e, t("x5.profile.resetFailed"));
      setNote(message);
      toast.error(message);
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="flex items-start gap-[10px] rounded-xl border border-signal-400/20 bg-signal-400/[0.06] px-[14px] py-[12px]">
        <MailCheck aria-hidden="true" className="mt-[1px] h-[16px] w-[16px] shrink-0 text-signal-300" />
        <p className="text-[13px] leading-[20px] text-muted-foreground">
          {t("authUI.forgot.sentBefore")}{" "}
          <span className="font-medium text-foreground">{email.trim()}</span>{" "}
          {t("authUI.forgot.sentAfter")}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-[14px]">
      <FloatingField
        id="forgot-email"
        name="avortyx-email"
        type="email"
        label={t("authUI.forgot.labelEmail")}
        icon={Mail}
        autoComplete="off"
        error={error}
        inputProps={{
          value: email,
          autoFocus: true,
          onChange: (e) => {
            setEmail(e.target.value);
            if (error) setError(undefined);
          },
        }}
        trailing={<EmailCheck ok={!emailProblem(email)} />}
      />

      <PrimaryButton pending={pending} idle={t("authUI.forgot.submit")} busy={t("authUI.forgot.submitting")} />

      <FormNote note={note} />
    </form>
  );
}

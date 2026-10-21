"use client";

/**
 * Reset / first-time password form for /reset-password?token=…
 *
 * Sends POST /api/accounts/password-reset/confirm { token, new_password }.
 * The same link serves a new Workspace member (first password) and anyone
 * who used Forgot password. On success the person is sent to sign in with
 * their email address and the new password.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authService } from "@/lib/api/services/auth.service";
import { ROUTES } from "@/lib/constants";
import { useTranslation } from "@/hooks/use-translation";

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

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-base font-semibold">{t("y.auth.linkIncomplete")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("y.auth.noTokenHint").split("{link}")[0]}
          <a href={ROUTES.forgotPassword} className="text-accent hover:underline">
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
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(t("y.auth.passwordMin").replace("{min}", String(MIN_PASSWORD_LENGTH)));
      return;
    }
    if (password !== confirm) {
      toast.error(t("y.auth.passwordsMismatch"));
      return;
    }
    setPending(true);
    try {
      await authService.confirmPasswordReset(token, password);
      toast.success(t("y.auth.passwordSet"));
      router.push(ROUTES.login);
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="rp-password">{t("y.auth.newPassword")}</Label>
        <div className="relative">
          <Input
            id="rp-password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            required
            className="pr-10"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label={showPassword ? t("y.auth.hidePassword") : t("y.auth.showPassword")}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {t("y.auth.passwordHint").replace("{min}", String(MIN_PASSWORD_LENGTH))}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rp-confirm">{t("y.auth.confirmPassword")}</Label>
        <Input
          id="rp-confirm"
          type={showPassword ? "text" : "password"}
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          minLength={MIN_PASSWORD_LENGTH}
          required
        />
      </div>

      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("y.auth.saving")}
          </>
        ) : (
          <>
            {t("y.auth.setPassword")} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

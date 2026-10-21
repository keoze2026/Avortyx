"use client";

/**
 * Set-password form — lands here from the one-time link the backend emails
 * after an admin approves an access request. Consumes the `?token=…` query
 * param, asks the user for a password, and POSTs to
 * /api/accounts/access-requests/set-password/.
 *
 * On success the endpoint returns login-shape tokens; we persist them, kick
 * the auth store to re-bootstrap (so /me hydrates the full profile), and
 * redirect into the app.
 */

import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, CheckCircle2, Eye, EyeOff, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError } from "@/lib/api/http";
import { accessRequestsService } from "@/lib/api/services/access-requests.service";
import { setTokens } from "@/lib/api/tokens";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";
import { useTranslation } from "@/hooks/use-translation";

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

  // If the email link was broken / pasted without the token, render a clear
  // error instead of letting the user submit an empty token.
  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <h2 className="text-base font-semibold">{t("y.auth.setupMissing")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("y.auth.setupMissingHint")}{" "}
          <a href="mailto:hello@avortyx.io" className="text-accent hover:underline">
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
      const res = await accessRequestsService.setPassword({ token, password });
      // Persist the tokens so the HTTP client picks them up on the next call.
      setTokens({ access: res.access, refresh: res.refresh });
      // Hydrate the auth store from /me so the rest of the app sees the user.
      await useAuthStore.getState().bootstrap();
      toast.success(t("y.auth.welcomeSignedIn"));
      router.push(ROUTES.dashboard);
    } catch (err) {
      toast.error(friendlyError(err, t));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <div className="flex items-start gap-3 rounded-lg border border-accent/30 bg-accent/5 p-3">
        <span className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <p className="text-xs text-muted-foreground">
          {t("y.auth.approvedSetPassword")}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="password">{t("y.auth.password")}</Label>
        <div className="relative">
          <Input
            id="password"
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
        <Label htmlFor="confirm">{t("y.auth.confirmPassword")}</Label>
        <Input
          id="confirm"
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
            <Loader2 className="h-4 w-4 animate-spin" /> {t("y.auth.settingPassword")}
          </>
        ) : (
          <>
            {t("y.auth.setPasswordSignIn")} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

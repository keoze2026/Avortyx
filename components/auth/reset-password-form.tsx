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

const MIN_PASSWORD_LENGTH = 8;

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : "";
  if (/invalid or expired/i.test(msg)) {
    return "This link has expired or was already used. Use Forgot password on the sign-in page to get a new one.";
  }
  if (/too many/i.test(msg)) return "Too many attempts. Please wait a minute and try again.";
  return msg || "Couldn't set your password. Please try again.";
}

export function ResetPasswordForm() {
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
        <h2 className="text-base font-semibold">Link incomplete</h2>
        <p className="text-sm text-muted-foreground">
          This link has no token. Open it directly from the email, or use{" "}
          <a href={ROUTES.forgotPassword} className="text-accent hover:underline">
            Forgot password
          </a>{" "}
          to get a new one.
        </p>
      </div>
    );
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    if (password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match.");
      return;
    }
    setPending(true);
    try {
      await authService.confirmPasswordReset(token, password);
      toast.success("Password set. Sign in with your email address and your new password.");
      router.push(ROUTES.login);
    } catch (err) {
      toast.error(friendlyError(err));
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4" autoComplete="off">
      <div className="space-y-2">
        <Label htmlFor="rp-password">New password</Label>
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
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          At least {MIN_PASSWORD_LENGTH} characters. Use a mix of letters, numbers and symbols.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rp-confirm">Confirm password</Label>
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
            <Loader2 className="h-4 w-4 animate-spin" /> Saving…
          </>
        ) : (
          <>
            Set password <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

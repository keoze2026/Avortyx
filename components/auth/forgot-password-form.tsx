"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ArrowRight, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { authService } from "@/lib/api/services/auth.service";

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [sent, setSent] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (pending) return;
    const trimmed = email.trim();
    if (!trimmed) return;
    setPending(true);
    try {
      // Real backend call — POST /api/accounts/password-reset/request.
      // We always show "sent" on a 2xx (and even on most 4xx) because
      // confirming whether an email exists is itself a security leak.
      // Backend should also respond uniformly to avoid user enumeration.
      await authService.requestPasswordReset(trimmed);
      setSent(true);
      toast.success(t("authUI.forgot.toastSent"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("x5.profile.resetFailed")));
    } finally {
      setPending(false);
    }
  };

  if (sent) {
    return (
      <div className="rounded-lg border border-border/60 bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
        {t("authUI.forgot.sentBefore")}{" "}
        <span className="font-mono text-foreground">{email}</span>{" "}
        {t("authUI.forgot.sentAfter")}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">{t("authUI.forgot.labelEmail")}</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> {t("authUI.forgot.submitting")}
          </>
        ) : (
          <>
            {t("authUI.forgot.submit")} <ArrowRight className="h-4 w-4" />
          </>
        )}
      </Button>
    </form>
  );
}

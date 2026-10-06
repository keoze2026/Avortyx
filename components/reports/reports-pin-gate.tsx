"use client";

import * as React from "react";
import { Lock, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ROUTES } from "@/lib/constants";
import { useSecurityStore } from "@/lib/store/security-store";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

interface Props {
  /** What the report would look like if the gate weren't here. */
  children: React.ReactNode;
  /** Does the range being viewed include anything before today? When it
   *  doesn't, the gate steps aside. */
  needsPin: boolean;
  /** Called when the user wants to back out. */
  onCancel?: () => void;
  /** Label for the back-out button. */
  cancelLabel?: string;
}

/** 90 -> "1:30" */
function clock(totalSeconds: number): string {
  const s = Math.max(0, Math.ceil(totalSeconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/**
 * Reports PIN gate.
 *
 * The PIN is held and checked by the SERVER (see lib/store/security-store.ts):
 * one PIN for the whole workspace, applying to every login. Shows the unlock
 * screen when
 *   1. the workspace has a PIN,
 *   2. the range being viewed includes anything before today, and
 *   3. this login hasn't entered the PIN (or its unlock has run out).
 *
 * If the server doesn't offer PIN protection at all, the gate steps aside.
 * The screen never loads report data while this is showing the unlock form -
 * the page waits for `useReportsAccess(...).canFetch`.
 */
export function ReportsPinGate({ children, needsPin, onCancel, cancelLabel }: Props) {
  const { t } = useTranslation();
  const load = useSecurityStore((s) => s.load);
  const configured = useSecurityStore((s) => s.configured);
  const unlocked = useSecurityStore((s) => s.unlocked);
  const canManage = useSecurityStore((s) => s.canManage);
  const lockedOutUntil = useSecurityStore((s) => s.lockedOutUntil);
  const fetchStatus = useSecurityStore((s) => s.fetchStatus);
  const verify = useSecurityStore((s) => s.verify);
  const lock = useSecurityStore((s) => s.lock);

  const [entered, setEntered] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (load === "idle") void fetchStatus();
  }, [load, fetchStatus]);

  // Count down a lock-out (too many wrong tries) once a second.
  React.useEffect(() => {
    if (!lockedOutUntil || lockedOutUntil <= Date.now()) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [lockedOutUntil]);
  const waitSeconds = lockedOutUntil ? Math.max(0, (lockedOutUntil - now) / 1000) : 0;
  const lockedOut = waitSeconds > 0;

  // Still finding out whether a PIN is set.
  if (needsPin && (load === "idle" || load === "loading")) {
    return (
      <Card className="mx-auto max-w-md p-6 text-sm text-muted-foreground">
        Checking report access…
      </Card>
    );
  }

  // No PIN, a range that doesn't need one, already unlocked, or the server
  // doesn't offer PIN protection: show the report, with a "Lock now" strip
  // when it is unlocked.
  if (!configured || !needsPin || unlocked || load === "unavailable") {
    return (
      <div className="space-y-3">
        {configured && unlocked && needsPin && (
          <div className="flex items-center justify-between rounded-lg border border-[oklch(0.78_0.18_155)]/30 bg-[oklch(0.78_0.18_155)]/8 px-3 py-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[oklch(0.78_0.18_155)]" />
              {t("toolsUI.reports.pinGate.unlockedNotice")}
            </span>
            <button
              type="button"
              onClick={() => {
                void lock();
                toast.success(t("toolsUI.reports.pinGate.toastLocked"));
              }}
              className="text-[oklch(0.78_0.18_155)] underline-offset-2 hover:underline"
            >
              {t("toolsUI.reports.pinGate.lockNow")}
            </button>
          </div>
        )}
        {children}
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (entered.length !== 4 || busy || lockedOut) return;
    setBusy(true);
    setMessage(null);
    const result = await verify(entered);
    setBusy(false);
    setEntered("");
    if (result.ok) {
      toast.success(t("toolsUI.reports.pinGate.toastUnlocked"));
    } else if (result.reason === "incorrect") {
      toast.error(t("toolsUI.reports.pinGate.toastIncorrect"));
      setMessage(
        result.attemptsLeft === null
          ? "Incorrect PIN."
          : `Incorrect PIN. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? "attempt" : "attempts"} left.`,
      );
    } else if (result.reason === "lockedOut") {
      setMessage("Too many wrong attempts.");
    } else {
      setMessage(result.message);
    }
  };

  return (
    <Card className="mx-auto max-w-md p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground">
          <Lock className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{t("toolsUI.reports.pinGate.title")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Yesterday and earlier reports need the 4-digit reports PIN.{" "}
            {canManage ? (
              <>
                You can set or change it in{" "}
                <Link href={ROUTES.settings} className="text-accent underline-offset-2 hover:underline">
                  Security settings
                </Link>
                .
              </>
            ) : (
              "If you don't have it, ask your account administrator."
            )}
          </p>
        </div>
      </div>

      <form onSubmit={submit} className="mt-5 space-y-3">
        <div className="grid gap-1.5">
          <Label htmlFor="reports-pin" className="text-xs">
            {t("toolsUI.reports.pinGate.enterPin")}
          </Label>
          <Input
            id="reports-pin"
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            value={entered}
            disabled={busy || lockedOut}
            onChange={(e) => setEntered(e.target.value.replace(/\D/g, "").slice(0, 4))}
            placeholder="••••"
            className={cn(
              "text-center font-mono text-xl tracking-[0.6em]",
              entered.length === 4 && "border-accent/50",
            )}
            autoFocus
          />
          {lockedOut ? (
            <p className="text-[11px] text-destructive">
              Too many wrong attempts. Try again in {clock(waitSeconds)}.
            </p>
          ) : (
            message && <p className="text-[11px] text-destructive">{message}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button type="submit" disabled={entered.length !== 4 || busy || lockedOut}>
            {busy ? "Checking…" : t("toolsUI.reports.pinGate.unlock")}
          </Button>
          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              {cancelLabel ?? t("toolsUI.reports.pinGate.viewTodayOnly")}
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/use-translation";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useTranslation();
  useEffect(() => {
    // Surface to monitoring once we wire one — for now the digest helps support.
    if (process.env.NODE_ENV !== "production") {
      // eslint-disable-next-line no-console
      console.error(error);
    }
  }, [error]);

  return (
    <div className="relative isolate flex min-h-[60vh] items-center justify-center px-4">
      {/* Ambient glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl opacity-40"
        style={{
          background:
            "radial-gradient(circle at center, var(--vortyx-glow), transparent 70%)",
        }}
      />

      <div className="relative w-full max-w-xl">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card/80 p-8 backdrop-blur-md sm:p-10">
          <div aria-hidden className="absolute inset-x-8 top-0 h-px edge-rule-top" />
          <Crosshair className="left-3 top-3" />
          <Crosshair className="right-3 top-3" />
          <Crosshair className="left-3 bottom-3" />
          <Crosshair className="right-3 bottom-3" />

          <div className="relative text-center">
            <div className="inline-flex items-center gap-1.5 rounded-full border border-destructive/40 bg-destructive/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.22em] text-destructive">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-destructive animate-pulse" />
              {t("x1.appError.badge")}
            </div>

            <div className="mt-5 inline-flex h-12 w-12 items-center justify-center rounded-full border border-destructive/30 bg-destructive/5">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>

            <h1 className="mt-4 text-lg font-semibold tracking-tight sm:text-xl">
              {t("x1.appError.title")}
            </h1>
            <p className="mt-1 max-w-md mx-auto text-sm text-muted-foreground">
              {t("x1.appError.description")}
            </p>

            {error?.digest ? (
              <div className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                <span className="text-muted-foreground/60">{t("x1.appError.trace")}</span>
                <span className="text-foreground/85">{error.digest}</span>
              </div>
            ) : null}

            <div className="mt-7 flex flex-col items-center justify-center gap-2 sm:flex-row">
              <Button size="sm" onClick={reset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" /> {t("workspaceUI.apiKeys.retry")}
              </Button>
              <Link href={ROUTES.dashboard}>
                <Button size="sm" variant="outline" className="gap-1.5">
                  <Home className="h-3.5 w-3.5" /> {t("nav.dashboard")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Crosshair({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-2.5 w-2.5",
        "before:absolute before:left-1/2 before:top-0 before:h-full before:w-px before:-translate-x-1/2 before:bg-accent/55",
        "after:absolute after:left-0 after:top-1/2 after:h-px after:w-full after:-translate-y-1/2 after:bg-accent/55",
        className,
      )}
    />
  );
}

"use client";

/**
 * Public TFN Check (CH-214): whoever holds the private link can paste numbers
 * and see whether each one is working, without logging in - our version of
 * XOLO's number lookup. The link's token is the only key; a cancelled link
 * stops working at once. This page never places calls.
 */
import * as React from "react";
import { useParams } from "next/navigation";
import { Link2Off, Loader2, ShieldCheck } from "lucide-react";

import { Wordmark } from "@/components/brand/wordmark";
import { LanguageToggle } from "@/components/shared/language-toggle";
import { TfnCheckPanel } from "@/components/tfn-check/tfn-check-panel";
import { useTranslation } from "@/hooks/use-translation";
import { tfnCheckService } from "@/lib/api/services/tfn-check.service";

export default function PublicTfnCheckPage() {
  const { t } = useTranslation();
  const params = useParams<{ token: string }>();
  const token = String(params?.token ?? "");
  const [state, setState] = React.useState<"loading" | "ready" | "invalid">("loading");
  const [name, setName] = React.useState("");

  // The browser tab in the chosen language too (CH-302).
  React.useEffect(() => {
    document.title = t("tfnCheck.title");
  }, [t]);

  React.useEffect(() => {
    let cancelled = false;
    tfnCheckService
      .publicInfo(token)
      .then((info) => {
        if (cancelled) return;
        setName(info.name);
        setState("ready");
      })
      .catch(() => {
        if (!cancelled) setState("invalid");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  const onCheck = React.useCallback(
    (numbers: string) => tfnCheckService.publicCheck(token, numbers),
    [token],
  );

  return (
    <main className="dark min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:py-12">
        <header className="mb-8 flex items-center justify-between gap-4">
          <Wordmark size="md" uid="tfn-check-mark" href={null} />
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5" /> {t("tfnCheck.public.private")}
            </span>
            {/* Partners open this without a login: let them pick their language (CH-302). */}
            <LanguageToggle />
          </div>
        </header>

        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">{t("tfnCheck.title")}</h1>
          <p className="mt-1 max-w-2xl text-[13px] text-muted-foreground">
            {state === "ready" && name ? `${name} · ` : ""}
            {t("tfnCheck.description")}
          </p>
        </div>

        {state === "loading" && (
          <div className="flex items-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("tfnCheck.public.loading")}
          </div>
        )}

        {state === "invalid" && (
          <div className="rounded-lg border border-border bg-muted/30 px-6 py-12 text-center">
            <Link2Off className="mx-auto mb-3 h-6 w-6 text-muted-foreground" />
            <div className="text-sm font-medium">{t("tfnCheck.public.invalidTitle")}</div>
            <p className="mt-1 text-xs text-muted-foreground">{t("tfnCheck.public.invalidBody")}</p>
          </div>
        )}

        {state === "ready" && <TfnCheckPanel onCheck={onCheck} />}

        {state === "ready" && <StatusLegend />}
      </div>
    </main>
  );
}

function StatusLegend() {
  const { t } = useTranslation();
  const codes = ["working", "active", "not_working", "not_in_service", "paused", "expired", "not_found"] as const;
  return (
    <div className="mt-6 rounded-lg border border-border px-4 py-3 text-[11px] text-muted-foreground sm:px-5">
      <div className="mb-2 font-medium text-foreground">{t("tfnCheck.legend.title")}</div>
      <dl className="grid gap-1.5 sm:grid-cols-2">
        {codes.map((c) => (
          <div key={c} className="flex gap-1.5">
            <dt className="shrink-0 font-medium text-foreground">{t(`tfnCheck.status.${c}`)}:</dt>
            <dd>{t(`tfnCheck.legend.${c}`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

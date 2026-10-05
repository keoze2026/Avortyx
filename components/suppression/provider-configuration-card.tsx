"use client";

import * as React from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { spamService } from "@/lib/api/services/spam.service";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { TcpaProviderConfig } from "@/lib/mock/suppression";
import { useTranslation } from "@/hooks/use-translation";

interface Props {
  config: TcpaProviderConfig;
  onChange: (patch: Partial<TcpaProviderConfig>) => void;
}

/** Provider Configuration card on the TCPA Shield detail page. */
export function ProviderConfigurationCard({ config, onChange }: Props) {
  const { t } = useTranslation();
  const [showPassword, setShowPassword] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [response, setResponse] = React.useState<string | null>(null);

  const onTest = async () => {
    if (!config.apiLogin.trim() || !config.apiPassword.trim()) {
      toast.error(t("toolsUI.suppression.providerConfig.errorCredentialsRequired"));
      return;
    }
    setTesting(true);
    setResponse(null);
    // This used to sleep, then print status "ok" with a latency of
    // 80 + Math.random() * 220 and a sample result saying litigator: false,
    // dnc: false, confidence 0.97. It never contacted anything, so wrong
    // credentials still reported success - the one button whose entire job is
    // telling you whether the provider answers.
    const sample = "+14155550100";
    const startedAt = performance.now();
    try {
      const result = await spamService.checkNumber(sample);
      setResponse(
        JSON.stringify(
          {
            status: "ok",
            latencyMs: Math.round(performance.now() - startedAt),
            checked: sample,
            result,
          },
          null,
          2,
        ),
      );
      toast.success(t("toolsUI.suppression.providerConfig.toastTestSuccess"));
    } catch (e) {
      const message = e instanceof Error ? e.message : "The provider did not answer";
      setResponse(
        JSON.stringify(
          {
            status: "failed",
            latencyMs: Math.round(performance.now() - startedAt),
            checked: sample,
            error: message,
          },
          null,
          2,
        ),
      );
      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <Card className="p-5">
      <div className="mb-1">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">
          {t("toolsUI.suppression.providerConfig.title")}
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          {t("toolsUI.suppression.providerConfig.description")}
        </p>
      </div>

      <div className="my-4 h-px w-full bg-border" />

      {/* API Login */}
      <div className="grid grid-cols-1 items-center gap-3 py-2 sm:grid-cols-[1fr_minmax(0,1fr)]">
        <div>
          <Label htmlFor="prov-login" className="text-sm">
            {t("toolsUI.suppression.providerConfig.apiLogin")} <span className="text-destructive">*</span>
          </Label>
          <p className="text-[11px] text-muted-foreground">{t("toolsUI.suppression.providerConfig.apiLoginHint")}</p>
        </div>
        <Input
          id="prov-login"
          value={config.apiLogin}
          onChange={(e) => onChange({ apiLogin: e.target.value })}
          placeholder={t("toolsUI.suppression.providerConfig.apiLoginPlaceholder")}
        />
      </div>

      <div className="my-2 h-px w-full bg-border" />

      {/* API Password */}
      <div className="grid grid-cols-1 items-center gap-3 py-2 sm:grid-cols-[1fr_minmax(0,1fr)]">
        <div>
          <Label htmlFor="prov-pass" className="text-sm">
            {t("toolsUI.suppression.providerConfig.apiPassword")} <span className="text-destructive">*</span>
          </Label>
          <p className="text-[11px] text-muted-foreground">{t("toolsUI.suppression.providerConfig.apiPasswordHint")}</p>
        </div>
        <div className="relative">
          <Input
            id="prov-pass"
            type={showPassword ? "text" : "password"}
            value={config.apiPassword}
            onChange={(e) => onChange({ apiPassword: e.target.value })}
            placeholder={t("toolsUI.suppression.providerConfig.apiPasswordPlaceholder")}
            className="pr-8"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? t("toolsUI.suppression.providerConfig.hidePassword") : t("toolsUI.suppression.providerConfig.showPassword")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            {showPassword ? (
              <EyeOff className="h-3.5 w-3.5" />
            ) : (
              <Eye className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="my-2 h-px w-full bg-border" />

      {/* Timeout */}
      <div className="grid grid-cols-1 items-center gap-3 py-2 sm:grid-cols-[1fr_minmax(0,1fr)]">
        <div>
          <Label htmlFor="prov-timeout" className="text-sm">
            {t("toolsUI.suppression.providerConfig.timeout")}
          </Label>
          <p className="text-[11px] text-muted-foreground">{t("toolsUI.suppression.providerConfig.timeoutHint")}</p>
        </div>
        <div className="relative">
          <Input
            id="prov-timeout"
            type="number"
            min={100}
            step={100}
            value={config.timeoutMs}
            onChange={(e) =>
              onChange({ timeoutMs: Number.isFinite(+e.target.value) ? +e.target.value : 1500 })
            }
            className="pr-10 tabular-nums"
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[11px] uppercase tracking-wider text-muted-foreground">
            ms
          </span>
        </div>
      </div>

      <div className="my-2 h-px w-full bg-border" />

      {/* Response */}
      <div className="grid grid-cols-1 items-start gap-3 py-2 sm:grid-cols-[1fr_minmax(0,1fr)]">
        <div>
          <Label className="text-sm">{t("toolsUI.suppression.providerConfig.response")}</Label>
          <p className="text-[11px] text-muted-foreground">
            {t("toolsUI.suppression.providerConfig.responseHintBefore")}<span className="font-semibold text-foreground">{t("toolsUI.suppression.providerConfig.responseHintJson")}</span>{t("toolsUI.suppression.providerConfig.responseHintAnd")}
            <span className="font-semibold text-foreground">{t("toolsUI.suppression.providerConfig.responseHintXml")}</span>{t("toolsUI.suppression.providerConfig.responseHintAfter")}
          </p>
        </div>
        <div className="flex justify-end">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing}>
            {testing ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("toolsUI.suppression.providerConfig.testing")}
              </>
            ) : (
              t("toolsUI.suppression.providerConfig.testConnection")
            )}
          </Button>
        </div>
      </div>

      <pre
        className={
          "mt-2 h-40 w-full overflow-auto rounded-md border border-border bg-secondary/30 p-3 font-mono text-[11px] text-foreground/90 " +
          (response ? "" : "flex items-center justify-center text-center text-muted-foreground")
        }
      >
        {response ?? t("toolsUI.suppression.providerConfig.responsePlaceholder")}
      </pre>
    </Card>
  );
}

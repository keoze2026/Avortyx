"use client";

/* CH-461: pieces shared by the pool list, the New pool wizard and the pool
 * page (Sir's number pool design). */

import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/use-translation";
import { API_BASE_URL } from "@/lib/api/env";
import type { PoolNumberState, PoolProtection } from "@/lib/types";

/** The tag the advertiser pastes before </body>. The server serves the
 * script (dni/script.py) and the script finds the server from its own src. */
export function poolSnippet(publicKey: string): string {
  return `<script src="${API_BASE_URL}/api/dni/avx-dni.js"\n  data-pool="${publicKey}" async></script>`;
}

/** pk_7f3a…c21e */
export function shortKey(key: string): string {
  return key.length > 14 ? `${key.slice(0, 7)}…${key.slice(-4)}` : key;
}

/** 1-844-555-0101 */
export function displayNumber(n: string): string {
  const d = (n || "").replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
  return ten.length === 10 ? `1-${ten.slice(0, 3)}-${ten.slice(3, 6)}-${ten.slice(6)}` : n;
}

export function useSeconds() {
  const { t } = useTranslation();
  return (s: number): string => {
    if (s < 60) return t("x461.unit.sec").replace("{n}", String(s));
    const m = Math.floor(s / 60);
    const rest = s % 60;
    return rest === 0
      ? t("x461.unit.min").replace("{n}", String(m))
      : t("x461.unit.minSec").replace("{m}", String(m)).replace("{s}", String(rest));
  };
}

/** "2 min ago" */
export function useAgo() {
  const { t } = useTranslation();
  return (iso: string | null | undefined): string => {
    if (!iso) return "";
    const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (s < 60) return t("x461.ago.justNow");
    if (s < 3600) return t("x461.ago.min").replace("{n}", String(Math.round(s / 60)));
    if (s < 86400) return t("x461.ago.hours").replace("{n}", String(Math.round(s / 3600)));
    return t("x461.ago.days").replace("{n}", String(Math.round(s / 86400)));
  };
}

/** m:ss */
export function clock(sec: number | null | undefined): string {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500",
  attention: "bg-amber-500",
  paused: "bg-muted-foreground",
};

export function PoolStatusPill({ status }: { status: "active" | "attention" | "paused" }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-0.5 text-[11px]">
      <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status] ?? STATUS_DOT.paused}`} />
      {t(`x461.status.${status}`)}
    </span>
  );
}

const STATE_DOT: Record<PoolNumberState, string> = {
  in_use: "bg-foreground",
  available: "bg-emerald-500",
  cooling: "bg-muted-foreground",
  quarantined: "bg-amber-500",
};

export function NumberStatePill({ state }: { state: PoolNumberState }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`h-1.5 w-1.5 rounded-full ${STATE_DOT[state]}`} />
      {t(`x461.state.${state}`)}
    </span>
  );
}

/** The URL parameters the wizard offers to capture (Sir's design). */
export const CAPTURE_OPTIONS = ["gclid", "msclkid", "fbclid", "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "sub_id"];

/** Spam attack rules: the same fields on the wizard and the pool page. */
export function ProtectionFields({
  value,
  onChange,
  disabled,
}: {
  value: PoolProtection;
  onChange: (next: PoolProtection) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const num = (key: keyof PoolProtection, label: string, hint: string, max = 100000) => (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <div className="text-sm">{label}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>
      </div>
      <Input
        type="number"
        min={0}
        max={max}
        disabled={disabled}
        className="h-8 w-24 text-right font-mono tabular-nums"
        value={String(value[key] as number)}
        onChange={(e) => {
          const n = Math.max(0, Math.min(max, Number(e.target.value) || 0));
          onChange({ ...value, [key]: n });
        }}
      />
    </div>
  );
  return (
    <div className="divide-y divide-border">
      {num("maxCallsPerCaller10m", t("x461.rule.repeat"), t("x461.rule.repeatHint"))}
      {num("shortCallsPerCaller30m", t("x461.rule.silent"), t("x461.rule.silentHint"))}
      {num("shortCallSec", t("x461.rule.shortSec"), t("x461.rule.shortSecHint"), 60)}
      {num("numberFloodPerMin", t("x461.rule.flood"), t("x461.rule.floodHint"))}
      {num("blockHours", t("x461.rule.blockHours"), t("x461.rule.blockHoursHint"), 720)}
      {num("assignPerIp10m", t("x461.rule.perIp"), t("x461.rule.perIpHint"))}
      <div className="flex items-start justify-between gap-4 py-3">
        <div>
          <div className="text-sm">{t("x461.rule.anonymous")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{t("x461.rule.anonymousHint")}</div>
        </div>
        <Switch
          checked={value.blockAnonymous}
          disabled={disabled}
          onCheckedChange={(v) => onChange({ ...value, blockAnonymous: Boolean(v) })}
          aria-label={t("x461.rule.anonymous")}
        />
      </div>
    </div>
  );
}

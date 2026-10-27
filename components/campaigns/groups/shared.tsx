"use client";

/** CH-328: small pieces shared by the Campaign Groups page and its dialogs. */

import { useTranslation } from "@/hooks/use-translation";

/** "{n} campaigns" + {n: 5} -> "5 campaigns". */
export function fill(text: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((s, [k, v]) => s.split(`{${k}}`).join(String(v)), text);
}

export function StatusDot({ status }: { status: string }) {
  const { t } = useTranslation();
  const tone =
    status === "active" ? "bg-emerald-500" : status === "paused" ? "bg-amber-500" : "bg-muted-foreground/50";
  const label = t(`cg.status.${status === "active" || status === "paused" ? status : "archived"}`);
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${tone}`} title={label} aria-label={label} />;
}

/** The server's per-campaign notes ("already there", "priority 2→1"), in the reader's language. */
export function useResultDetail() {
  const { t } = useTranslation();
  return (detail: string) =>
    detail
      .replace("also in an advanced routing plan (left as is)", t("cg.detail.advanced"))
      .replace("already there", t("cg.detail.alreadyThere"))
      .replace("not in this campaign", t("cg.detail.notIn"))
      .replace("already set", t("cg.detail.alreadySet"))
      .replace(/\bconvert seconds\b/g, t("cg.detail.convertSeconds"))
      .replace(/\bconvert on\b/g, t("cg.detail.convertOn"))
      .replace(/\brevenue\b/g, t("cg.detail.revenue"))
      .replace(/\bpriority\b/g, t("cg.col.priority").toLowerCase())
      .replace(/\bweight\b/g, t("cg.col.weight").toLowerCase());
}

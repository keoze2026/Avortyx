"use client";

/**
 * CH-675: small pieces the Organizations list and the account page share -
 * the initials tile, the Health and Status marks, Runway and money.
 */

import { cn } from "@/lib/utils";

export type Health = "ok" | "low_balance" | "no_balance" | "billing_not_set" | "suspended";

/** A list row as it arrives (the http client camelCases every key). */
export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  users: number;
  balance: string | null;
  perMinuteRate: string | null;
  markupPercent: string | null;
  billingStatus: string | null;
  callsToday: number;
  revenueToday: string;
  /** CH-665: High / Low Risk - which stock numbers the account buys ("" = not set). */
  tfnRisk?: string;
  isMainAccount?: boolean;
  runwayMinutes?: number | null;
  health?: Health;
  liveNow?: number;
}

const TILE_COLORS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300",
];

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function OrgTile({ name, className }: { name: string; className?: string }) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-semibold",
        TILE_COLORS[h % TILE_COLORS.length],
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

/** 66666 -> "66k min", 40 -> "40 min", 0 -> "< 1 min"; null -> "—". */
export function runwayText(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  if (minutes < 1) return "< 1 min";
  if (minutes < 1000) return `${minutes} min`;
  if (minutes < 10000) return `${(minutes / 1000).toFixed(1).replace(/\.0$/, "")}k min`;
  return `${Math.floor(minutes / 1000)}k min`;
}

export function runwayIsShort(row: { runwayMinutes?: number | null; health?: Health }): boolean {
  return (
    row.health === "low_balance" ||
    row.health === "no_balance" ||
    (row.runwayMinutes != null && row.runwayMinutes < 60)
  );
}

export const money = (v: string | number | null | undefined, digits = 2) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return `$${v}`;
  return `${n < 0 ? "-" : ""}$${Math.abs(n).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
};

const HEALTH_STYLE: Record<Health, string> = {
  ok: "text-emerald-600 dark:text-emerald-400",
  low_balance: "text-amber-600 dark:text-amber-400",
  no_balance: "text-red-600 dark:text-red-400",
  billing_not_set: "text-muted-foreground",
  suspended: "text-red-600 dark:text-red-400",
};

export const HEALTH_KEY: Record<Health, string> = {
  ok: "x675.health.ok",
  low_balance: "x675.health.lowBalance",
  no_balance: "x675.health.noBalance",
  billing_not_set: "x675.health.billingNotSet",
  suspended: "x675.health.suspended",
};

export function HealthMark({ health, t }: { health: Health | undefined; t: (k: string) => string }) {
  const h: Health = health ?? "ok";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-medium", HEALTH_STYLE[h])}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {t(HEALTH_KEY[h])}
    </span>
  );
}

export function StatusMark({ active, t }: { active: boolean; t: (k: string) => string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium",
        active
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
          : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
      )}
    >
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {active ? t("owner.orgs.active") : t("owner.orgs.suspended")}
    </span>
  );
}

export function MainBadge({ t }: { t: (k: string) => string }) {
  return (
    <span className="rounded-md border border-accent/40 bg-accent/10 px-1.5 py-0 text-[10px] font-semibold uppercase tracking-wide text-accent">
      {t("x675.main")}
    </span>
  );
}

/** A summary tile: label, big figure, small line under it. */
export function StatTile({
  label,
  value,
  sub,
  tone,
  onClick,
  active,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "warn";
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-0 rounded-xl border bg-card p-4 text-left shadow-sm",
        onClick && "transition-colors hover:border-accent/50",
        active && "border-accent/60 ring-1 ring-accent/30",
        tone === "warn" && "border-amber-500/40 bg-amber-500/5",
      )}
    >
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div className={cn("mt-1 truncate text-2xl font-semibold tabular-nums", tone === "warn" && "text-amber-600 dark:text-amber-400")}>
        {value}
      </div>
      {sub != null && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </Tag>
  );
}

/** A per-minute rate: "0.0450" -> "$0.045", "0.0425" -> "$0.0425". */
export const rateText = (v: string | null | undefined) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return `$${v}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;
};

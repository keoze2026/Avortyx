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

export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function OrgTile({ name, className }: { name: string; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-muted text-xs font-semibold text-muted-foreground",
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

/** OK is quiet (grey); anything that needs the owner is red. */
export const HEALTH_STYLE: Record<Health, string> = {
  ok: "text-muted-foreground",
  low_balance: "text-red-600 dark:text-red-400",
  no_balance: "text-red-600 dark:text-red-400",
  billing_not_set: "text-red-600 dark:text-red-400",
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
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-sm">
      <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-red-500")} />
      {active ? t("owner.orgs.active") : t("owner.orgs.suspended")}
    </span>
  );
}

export function MainBadge({ t }: { t: (k: string) => string }) {
  return (
    <span className="rounded-md border border-blue-500/40 bg-blue-500/10 px-1.5 py-px text-[10px] font-medium text-blue-600 dark:text-blue-300">
      {t("x675.main")}
    </span>
  );
}

export type Tone = "green" | "blue" | "red";

const TONE_STYLE: Record<Tone, string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
  red: "text-red-600 dark:text-red-400",
};

/** The row of summary figures: one bordered strip, split into cells. */
export function StatStrip({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm md:grid-cols-3 xl:grid-cols-5 [&>*]:border-b [&>*]:border-r xl:[&>*]:border-b-0 xl:[&>*:last-child]:border-r-0">
      {children}
    </div>
  );
}

/** One cell of a StatStrip: label, big figure, small line under it. */
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
  tone?: Tone;
  onClick?: () => void;
  active?: boolean;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "min-w-0 px-5 py-4 text-left",
        onClick && "transition-colors hover:bg-muted/40",
        active && "bg-muted/50",
      )}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1.5 truncate font-mono text-2xl font-semibold tabular-nums", tone && TONE_STYLE[tone])}>
        {value}
      </div>
      {sub != null && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </Tag>
  );
}

/** A card header for the account page: title, a grey line, a rule under it. */
export function SectionHead({
  title,
  sub,
  right,
}: {
  title: React.ReactNode;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
      </div>
      {right}
    </div>
  );
}

/** A small rounded tag: green, red or grey. */
export function Pill({ tone, children }: { tone?: "green" | "red"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-medium",
        tone === "green" && "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
        tone === "red" && "bg-red-500/15 text-red-700 dark:text-red-300",
        !tone && "bg-muted text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

/** "Oct 21" (this year) or "Oct 21, 2025". */
export function shortDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", ...(sameYear ? {} : { year: "numeric" }) });
}

/** "Oct 02, 2026". */
export function fullDate(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "2-digit", year: "numeric" });
}

/** "Nov 12, 2026 · 4:51 PM". */
export function dateTime(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "—";
  return `${fullDate(v)} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** A per-minute rate: "0.0450" -> "$0.045", "0.0425" -> "$0.0425". */
export const rateText = (v: string | null | undefined) => {
  if (v == null || v === "") return "—";
  const n = Number(v);
  if (Number.isNaN(n)) return `$${v}`;
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 4 })}`;
};

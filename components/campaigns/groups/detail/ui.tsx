"use client";

/** CH-415: small pieces of Sir's Campaign Group design, shared by the page and its drawers. */

import { useTranslation } from "@/hooks/use-translation";
import { useLocalName } from "@/lib/i18n/local-name";
import { cn } from "@/lib/utils";
import { fill } from "../shared";
import { formatUs, type GroupRow } from "./model";

/** The buyer's short name in a small box, then the number. */
export function LineLabel({ buyer, number, className }: { buyer: string; number: string; className?: string }) {
  const localName = useLocalName();
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      {buyer && (
        <span className="shrink-0 rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-foreground/90">
          {localName(buyer)}
        </span>
      )}
      <span className="truncate font-mono text-[13px] tabular-nums">{formatUs(number)}</span>
    </span>
  );
}

export function Pill({ tone, children }: { tone: "amber" | "red" | "green" | "blue"; children: React.ReactNode }) {
  const tones = {
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    red: "border-red-500/30 bg-red-500/10 text-red-400",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    blue: "border-accent/30 bg-accent/10 text-accent",
  } as const;
  return (
    <span className={cn("inline-flex items-center rounded border px-1.5 py-px text-[10px] font-medium", tones[tone])}>
      {children}
    </span>
  );
}

/** "1-10 Mixed Check" - the range the line has across the group's campaigns. */
export function PriorityCell({ row }: { row: GroupRow }) {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono text-[13px] tabular-nums">
        {row.mixed ? `${row.minPriority}–${row.maxPriority}` : row.minPriority}
      </span>
      {row.mixed && <Pill tone="amber">{t("x415.mixed")}</Pill>}
      {row.check && <Pill tone="red">{t("x415.check")}</Pill>}
    </span>
  );
}

/** A short bar: how many of the group's campaigns the line is in. */
export function CampaignsBar({ inCount, ofCount }: { inCount: number; ofCount: number }) {
  const { t } = useTranslation();
  const all = ofCount > 0 && inCount >= ofCount;
  const pct = ofCount > 0 ? Math.max(4, Math.round((inCount / ofCount) * 100)) : 0;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1 w-9 overflow-hidden rounded-full bg-muted/60">
        <span
          className={cn("block h-full rounded-full", all ? "bg-emerald-500" : "bg-amber-400")}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn("text-xs tabular-nums", all ? "text-foreground" : "text-amber-400")}>
        {all ? fill(t("x415.allN"), { n: ofCount }) : fill(t("x415.nOfM"), { n: inCount, m: ofCount })}
      </span>
    </span>
  );
}

/** A numbered step heading in the drawers. */
export function Step({ n, title, aside, children }: { n: number; title: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex gap-3">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold">{title}</h3>
          {aside && <span className="text-[11px] text-muted-foreground">{aside}</span>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** "" -> undefined, else a whole number >= 0. */
export function toInt(v: string): number | undefined {
  if (v.trim() === "") return undefined;
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n >= 0 ? n : undefined;
}

/**
 * SessionMeter — current-session conversion bar + radial dial.
 * Replaces the legacy LiveStatsPanel for the redesigned page.
 */

"use client";

import { motion } from "framer-motion";

import { BracketCard } from "@/components/shared/bracket-card";
import { SectionLabel } from "@/components/shared/section-label";
import { useTranslation } from "@/hooks/use-translation";

interface SessionMeterProps {
  totals: { started: number; completed: number; missed: number; revenue: number };
  inFlightCount: number;
}

export function SessionMeter({ totals, inFlightCount }: SessionMeterProps) {
  const { t } = useTranslation();
  const conversion =
    totals.started > 0 ? (totals.completed / totals.started) * 100 : 0;
  const reject = totals.started > 0 ? (totals.missed / totals.started) * 100 : 0;

  return (
    <BracketCard>
      <SectionLabel index={4} title={t("liveUI.session.title")} meta={t("liveUI.session.meta")} />

      {/* Radial dial */}
      <div className="flex items-center gap-4">
        <Dial value={conversion} label={t("liveUI.session.conversionLabel")} />
        <div className="min-w-0 flex-1 space-y-1">
          <RailRow label={t("liveUI.session.conversion")} value={conversion} tone="accent" />
          <RailRow label={t("liveUI.session.reject")} value={reject} tone="amber" />
          <RailRow
            label={t("liveUI.session.active")}
            value={Math.min(100, inFlightCount * 8)}
            display={t("liveUI.session.activeSuffix").replace("{n}", String(inFlightCount))}
            tone="emerald"
          />
        </div>
      </div>

      {/* Session totals */}
      <div className="mt-4 grid grid-cols-4 gap-2 border-t border-border/40 pt-3 text-center">
        <Cell label={t("liveUI.session.totals.start")} value={totals.started} />
        <Cell label={t("liveUI.session.totals.done")} value={totals.completed} />
        <Cell label={t("liveUI.session.totals.miss")} value={totals.missed} />
        <Cell label={t("liveUI.session.totals.money")} value={`$${Math.round(totals.revenue).toLocaleString()}`} />
      </div>
    </BracketCard>
  );
}

function Dial({ value, label }: { value: number; label: string }) {
  const pct = Math.min(100, Math.max(0, value));
  const angle = (pct / 100) * 360;
  return (
    <div className="relative h-24 w-24 shrink-0">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${angle}deg, color-mix(in oklab, var(--border) 80%, transparent) ${angle}deg)`,
        }}
      />
      <div className="absolute inset-1.5 rounded-full bg-card" />
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold tabular-nums tracking-tight">{pct.toFixed(0)}%</span>
        <span className="text-[10px] text-muted-foreground">{label}</span>
      </div>
    </div>
  );
}

function RailRow({
  label,
  value,
  display,
  tone,
}: {
  label: string;
  value: number;
  display?: string;
  tone: "accent" | "amber" | "emerald";
}) {
  const tones: Record<"accent" | "amber" | "emerald", string> = {
    accent: "bg-accent",
    amber: "bg-[color:var(--warning)]",
    emerald: "bg-[color:var(--success)]",
  };
  return (
    <div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        <span className="font-medium text-foreground tabular-nums">{display ?? `${value.toFixed(1)}%`}</span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary/60">
        <motion.div
          animate={{ width: `${Math.min(100, value)}%` }}
          transition={{ duration: 0.45 }}
          className={`h-full rounded-full ${tones[tone]}`}
        />
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 py-2">
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * TopologyOverview — full-width network atlas hero for the Routing page.
 *
 *   ┌────────────────────────────────────────────────────────────────┐
 *   │ TOPOLOGY · 3 plans      │  graph density gauge  │  agg KPIs    │
 *   │  ░░░ big numeral        │  ◐ radial dial        │  nodes/edges │
 *   └────────────────────────────────────────────────────────────────┘
 */

"use client";

import { motion } from "framer-motion";
import { Building2, Cable, CircleSlash2, GitFork, Layers } from "lucide-react";

import { useCountUp } from "@/hooks/use-count-up";
import { useTranslation } from "@/hooks/use-translation";
import type { RoutingPlan } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TopologyOverviewProps {
  plans: RoutingPlan[];
}

export function TopologyOverview({ plans }: TopologyOverviewProps) {
  const { t } = useTranslation();
  const published = plans.filter((p) => p.status === "published").length;
  const draft = plans.filter((p) => p.status === "draft").length;
  const archived = plans.filter((p) => p.status === "archived").length;

  const totalNodes = plans.reduce((s, p) => s + p.nodes.length, 0);
  const totalEdges = plans.reduce((s, p) => s + p.edges.length, 0);
  const totalBuyers = plans.reduce(
    (s, p) => s + p.nodes.filter((n) => n.type === "buyer").length,
    0,
  );
  const totalDeadEnds = plans.reduce(
    (s, p) => s + p.nodes.filter((n) => n.type === "deadEnd").length,
    0,
  );

  // Connectivity (edges per node, clamped 0..1 then ×100 for the dial)
  const connectivity = totalNodes > 0 ? Math.min(1, totalEdges / Math.max(totalNodes, 1)) : 0;
  const connectivityPct = connectivity * 100;

  const animatedPlans = useCountUp(plans.length, { duration: 400 });
  const animatedNodes = useCountUp(totalNodes, { duration: 600 });

  return (
    <motion.section
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="relative overflow-hidden rounded-2xl border border-border bg-card"
    >
      {/* Ambient + texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 -top-32 h-72 w-72 rounded-full blur-3xl sm:h-96 sm:w-96 lg:h-[420px] lg:w-[420px]"
        style={{ background: "var(--vortyx-glow)" }}
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-24 h-72 w-72 rounded-full blur-3xl opacity-60"
        style={{ background: "radial-gradient(circle, var(--vortyx-glow), transparent 70%)" }}
      />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-hex-dot opacity-40" />
      <div aria-hidden className="absolute inset-x-8 top-0 h-px edge-rule-top" />

      {/* Corner crosshairs */}
      <Crosshair className="left-3 top-3" />
      <Crosshair className="right-3 top-3" />
      <Crosshair className="left-3 bottom-3" />
      <Crosshair className="right-3 bottom-3" />

      <div className="relative grid grid-cols-1 lg:grid-cols-12">
        {/* LEFT — Big plan count */}
        <div className="relative p-7 lg:col-span-4 lg:border-r lg:border-border/60">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] font-semibold tracking-[0.22em] text-accent">
              00 / {t("trafficUI.routing.topology.topology")}
            </span>
            <span aria-hidden className="h-3 w-px bg-border" />
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              {t("trafficUI.routing.topology.routingPlans")}
            </span>
          </div>

          <div className="mt-4 flex items-baseline gap-3">
            <span className="font-mono text-[64px] font-bold leading-none tracking-tight tabular-nums">
              {Math.round(animatedPlans).toString().padStart(2, "0")}
            </span>
            <div className="ml-1 flex flex-col gap-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
              <span>
                <span className="text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
                  {published}
                </span>{" "}
                {t("trafficUI.routing.topology.live")}
              </span>
              <span>
                <span className="text-foreground/85">{draft}</span> {t("trafficUI.routing.topology.draft")}
              </span>
              <span>
                <span className="text-muted-foreground/70">{archived}</span> {t("trafficUI.routing.topology.archived")}
              </span>
            </div>
          </div>

          {/* Mix bar */}
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <div className="flex h-full">
              <Slice
                width={(published / Math.max(plans.length, 1)) * 100}
                className="bg-[oklch(0.6_0.18_155)]"
              />
              <Slice
                width={(draft / Math.max(plans.length, 1)) * 100}
                className="bg-foreground/40"
              />
              <Slice
                width={(archived / Math.max(plans.length, 1)) * 100}
                className="bg-muted-foreground/30"
              />
            </div>
          </div>
          <div className="mt-2 flex justify-between font-mono text-[9px] uppercase tracking-wider text-muted-foreground/70">
            <span>{t("trafficUI.routing.topology.portfolioMix")}</span>
            <span>
              {t("trafficUI.routing.topology.percentLive").replace("{pct}", ((published / Math.max(plans.length, 1)) * 100).toFixed(0))}
            </span>
          </div>
        </div>

        {/* CENTER — connectivity dial */}
        <div className="relative flex items-center justify-center border-t border-border/60 py-6 lg:col-span-3 lg:border-l-0 lg:border-r lg:border-t-0">
          <ConnectivityDial value={connectivityPct} totalEdges={totalEdges} />
        </div>

        {/* RIGHT — aggregate KPIs */}
        <div className="grid grid-cols-2 divide-x divide-y divide-border/60 lg:col-span-5 lg:grid-cols-2">
          <Aggregate
            icon={Layers}
            index="01"
            label={t("trafficUI.routing.topology.nodes")}
            display={Math.round(animatedNodes).toString()}
            highlight
          />
          <Aggregate icon={Cable} index="02" label={t("trafficUI.routing.topology.edgesLabel")} display={totalEdges.toString()} />
          <Aggregate icon={Building2} index="03" label={t("trafficUI.routing.topology.buyerTerminals")} display={totalBuyers.toString()} />
          <Aggregate
            icon={CircleSlash2}
            index="04"
            label={t("trafficUI.routing.topology.deadEnds")}
            display={totalDeadEnds.toString()}
          />
        </div>
      </div>

      {/* Footer — plan summary chips */}
      <div className="relative flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border/50 px-6 py-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          <GitFork className="h-3 w-3 text-accent" />
          {t("trafficUI.routing.topology.campaignsWired")}
        </div>
        {plans.map((p) => (
          <span
            key={p.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary/40 px-2 py-1 font-mono text-[10px]",
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                p.status === "published"
                  ? "bg-[oklch(0.6_0.18_155)]"
                  : p.status === "draft"
                    ? "bg-foreground/40"
                    : "bg-muted-foreground/40",
              )}
            />
            <span className="text-foreground/80">{p.campaignName ?? p.name}</span>
            <span className="text-muted-foreground">·</span>
            <span className="tabular-nums">
              {p.nodes.length}n / {p.edges.length}e
            </span>
          </span>
        ))}
      </div>
    </motion.section>
  );
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Connectivity dial — radial gauge                                    */
/* ─────────────────────────────────────────────────────────────────── */

function ConnectivityDial({ value, totalEdges }: { value: number; totalEdges: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const angle = (pct / 100) * 360;

  return (
    <div className="relative h-36 w-36">
      {/* Outer ring */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(var(--accent) ${angle}deg, color-mix(in oklab, var(--border) 70%, transparent) ${angle}deg)`,
        }}
      />
      <div className="absolute inset-[6px] rounded-full bg-card" />

      {/* Tick marks */}
      {Array.from({ length: 12 }).map((_, i) => {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const r1 = 56;
        const r2 = 62;
        const x1 = Math.cos(a) * r1;
        const y1 = Math.sin(a) * r1;
        const x2 = Math.cos(a) * r2;
        const y2 = Math.sin(a) * r2;
        return (
          <svg
            key={i}
            className="pointer-events-none absolute inset-0"
            viewBox="-72 -72 144 144"
            fill="none"
          >
            <line
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="var(--accent)"
              strokeOpacity={i % 3 === 0 ? 0.5 : 0.2}
              strokeWidth={i % 3 === 0 ? 1.2 : 0.7}
            />
          </svg>
        );
      })}

      {/* Center text */}
      <DialInner pct={pct} totalEdges={totalEdges} />
    </div>
  );
}

function DialInner({ pct, totalEdges }: { pct: number; totalEdges: number }) {
  const { t } = useTranslation();
  return (
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-accent">
          {t("trafficUI.routing.topology.density")}
        </span>
        <span className="mt-0.5 font-mono text-3xl font-bold tabular-nums leading-none">
          {pct.toFixed(0)}
          <span className="text-base text-muted-foreground">%</span>
        </span>
        <span className="mt-1 font-mono text-[9px] uppercase tracking-wider text-muted-foreground">
          {totalEdges} {t("trafficUI.routing.topology.edges")}
        </span>
      </div>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function Slice({ width, className }: { width: number; className?: string }) {
  return <div style={{ width: `${width}%` }} className={cn("h-full", className)} />;
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

interface AggregateProps {
  icon: typeof Layers;
  index: string;
  label: string;
  display: string;
  highlight?: boolean;
}

function Aggregate({ icon: Icon, index, label, display, highlight }: AggregateProps) {
  return (
    <div className="flex flex-col justify-center px-5 py-4 transition-colors hover:bg-secondary/30">
      <div className="flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-secondary/40 text-accent">
          <Icon className="h-3 w-3" />
        </span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.18em] text-accent">{index}</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {label}
          </span>
        </div>
      </div>
      <div
        className={cn(
          "mt-2 font-mono text-2xl font-bold tabular-nums",
          highlight && "text-accent",
        )}
      >
        {display}
      </div>
    </div>
  );
}

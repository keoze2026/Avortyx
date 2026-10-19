"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Building2,
  Cable,
  CircleSlash2,
  Layers,
  MoreVertical,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { TopologyMap } from "./topology-map";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { formatRelativeTime } from "@/lib/format";
import { useRoutingStore } from "@/lib/store/routing-store";
import type { RoutingPlan, RoutingPlanStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/my-permissions";

const STATUS_TONE: Record<
  RoutingPlanStatus,
  { chip: string; rail: string; dot: string; labelKey: string }
> = {
  published: {
    chip:
      "border-[oklch(0.6_0.18_155)]/45 bg-[oklch(0.6_0.18_155)]/10 text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
    rail: "bg-[oklch(0.6_0.18_155)]",
    dot: "bg-[oklch(0.6_0.18_155)]",
    labelKey: "trafficUI.routing.planCard.labels.live",
  },
  draft: {
    chip: "border-accent/45 bg-accent/10 text-accent",
    rail: "bg-accent",
    dot: "bg-accent",
    labelKey: "trafficUI.routing.planCard.labels.draft",
  },
  archived: {
    chip: "border-border bg-secondary/50 text-muted-foreground",
    rail: "bg-muted-foreground/40",
    dot: "bg-muted-foreground/50",
    labelKey: "trafficUI.routing.planCard.labels.archived",
  },
};

export function RoutingPlanCard({ plan }: { plan: RoutingPlan }) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const setStatus = useRoutingStore((s) => s.setStatus);
  const remove = useRoutingStore((s) => s.remove);
  const published = plan.status === "published";
  const meta = STATUS_TONE[plan.status];

  const nodeCount = plan.nodes.length;
  const edgeCount = plan.edges.length;
  const buyerCount = plan.nodes.filter((n) => n.type === "buyer").length;
  const deadCount = plan.nodes.filter((n) => n.type === "deadEnd").length;

  return (
    <motion.article
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card"
    >
      {/* Ambient hover glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-16 h-44 w-44 rounded-full blur-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "var(--vortyx-glow)" }}
      />

      {/* Corner brackets */}
      <CornerBracket position="tl" />
      <CornerBracket position="tr" />
      <CornerBracket position="bl" />
      <CornerBracket position="br" />

      {/* Top accent rule */}
      <div className="relative h-px w-full">
        <span
          aria-hidden
          className="absolute left-6 right-6 top-0 h-px bg-gradient-to-r from-transparent via-accent/60 to-transparent"
        />
      </div>

      <div className="relative p-5">
        {/* ─── Header row ─── */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            {/* Plan ID + status chip */}
            <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <span className={cn("inline-block h-1.5 w-1.5 rounded-full", meta.dot)} />
              {t("trafficUI.routing.planCard.labels.plan")} · {plan.id.slice(-6)}
              {plan.campaignName && (
                <>
                  <span aria-hidden>·</span>
                  <span className="truncate opacity-80">{plan.campaignName}</span>
                </>
              )}
            </div>

            {/* Title */}
            <Link
              href={`${ROUTES.routing}/${plan.id}`}
              className="mt-1.5 flex items-center gap-1 truncate text-base font-semibold leading-snug transition-colors hover:text-accent"
            >
              <span className="truncate">{plan.name}</span>
              <ArrowUpRight className="h-3.5 w-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
            </Link>
          </div>

          <div className="flex items-center gap-1">
            {/* Status chip */}
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em]",
                meta.chip,
              )}
            >
              {published && (
                <span className="relative inline-flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-70" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                </span>
              )}
              {t(meta.labelKey)}
            </span>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 h-7 w-7 opacity-60 hover:opacity-100"
                  aria-label={t("trafficUI.routing.planCard.actions")}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {can("call-flows", "edit") && (<><DropdownMenuItem
                  onSelect={() => {
                    const next = published ? "draft" : "published";
                    setStatus(plan.id, next);
                    toast.success(
                      next === "published"
                        ? t("trafficUI.routing.planCard.published").replace("{name}", plan.name)
                        : t("trafficUI.routing.planCard.unpublished").replace("{name}", plan.name),
                    );
                  }}
                >
                  {published ? t("trafficUI.routing.toolbar.unpublish") : t("trafficUI.routing.toolbar.publish")}
                </DropdownMenuItem>
                <DropdownMenuSeparator /></>)}
                {can("call-flows", "delete") && (<DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onSelect={() => {
                    remove(plan.id);
                    toast.success(t("trafficUI.routing.planCard.deleted").replace("{name}", plan.name));
                  }}
                >
                  <Trash2 className="h-4 w-4" /> {t("trafficUI.routing.planCard.deletePlan")}
                </DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {plan.description && (
          <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{plan.description}</p>
        )}

        {/* ─── Topology miniature ─── */}
        <div className="mt-4">
          <TopologyMap plan={plan} />
        </div>

        {/* ─── Instrument readouts ─── */}
        <div className="mt-3 grid grid-cols-4 gap-2">
          <Readout icon={Layers} label={t("trafficUI.routing.planCard.labels.nodes")} value={nodeCount} />
          <Readout icon={Cable} label={t("trafficUI.routing.planCard.labels.edges")} value={edgeCount} />
          <Readout icon={Building2} label={t("trafficUI.routing.planCard.labels.buyers")} value={buyerCount} highlight />
          <Readout icon={CircleSlash2} label={t("trafficUI.routing.planCard.labels.dead")} value={deadCount} muted />
        </div>

        {/* ─── Footer ─── */}
        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>{t("trafficUI.routing.planCard.updated").replace("{time}", formatRelativeTime(plan.updatedAt))}</span>
          <Link
            href={`${ROUTES.routing}/${plan.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-accent/45 bg-accent/10 px-2.5 text-accent transition-colors hover:bg-accent/20"
          >
            {t("trafficUI.routing.planCard.openEditor")}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </div>
    </motion.article>
  );
}

/* ─────────────────────────────────────────────────────────────────── */

function Readout({
  icon: Icon,
  label,
  value,
  highlight,
  muted,
}: {
  icon: typeof Layers;
  label: string;
  value: number;
  highlight?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-md border border-border/60 bg-secondary/25 px-2 py-1.5">
      <div className="flex items-center gap-1">
        <Icon
          className={cn(
            "h-2.5 w-2.5",
            highlight
              ? "text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]"
              : muted
                ? "text-muted-foreground/60"
                : "text-accent",
          )}
        />
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "font-mono text-base font-semibold tabular-nums leading-tight",
          highlight && "text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
          muted && "text-muted-foreground/80",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function CornerBracket({ position }: { position: "tl" | "tr" | "bl" | "br" }) {
  const map: Record<typeof position, string> = {
    tl: "top-0 left-0 border-t-[1.5px] border-l-[1.5px] rounded-tl-xl",
    tr: "top-0 right-0 border-t-[1.5px] border-r-[1.5px] rounded-tr-xl",
    bl: "bottom-0 left-0 border-b-[1.5px] border-l-[1.5px] rounded-bl-xl",
    br: "bottom-0 right-0 border-b-[1.5px] border-r-[1.5px] rounded-br-xl",
  };
  return (
    <span
      aria-hidden
      className={cn(
        "pointer-events-none absolute h-3 w-3 border-accent/40 transition-colors group-hover:border-accent/70",
        map[position],
      )}
    />
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Hash, MoreVertical, Shuffle, Target } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";
import { ROUTES } from "@/lib/constants";
import { formatCompact } from "@/lib/format";
import type { NumberPool } from "@/lib/types";

const STRATEGY_META = {
  "round-robin": { icon: Shuffle, labelKey: "trafficUI.numbers.poolCard.roundRobin" },
  weighted: { icon: Target, labelKey: "trafficUI.numbers.poolCard.weighted" },
  priority: { icon: Target, labelKey: "trafficUI.numbers.poolCard.priority" },
} as const;

export function NumberPoolCard({ pool }: { pool: NumberPool }) {
  const { t } = useTranslation();
  const meta = STRATEGY_META[pool.rotationStrategy];
  const Icon = meta.icon;

  return (
    <motion.div
      whileHover={{ y: -2 }}
      transition={{ duration: 0.18 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card p-4"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "rgba(59, 182, 255, 0.18)" }}
      />

      <div className="relative flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold"><LocalName name={pool.name} /></h3>
          <Link
            href={`${ROUTES.campaigns}/${pool.campaignId}`}
            className="truncate text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <LocalName name={pool.campaignName} />
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <Badge variant={pool.active ? "success" : "outline"}>{pool.active ? t("trafficUI.common.active") : t("trafficUI.common.paused")}</Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("trafficUI.numbers.poolCard.actions")}>
                <MoreVertical className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>{t("trafficUI.numbers.poolCard.editRotation")}</DropdownMenuItem>
              <DropdownMenuItem>{t("trafficUI.numbers.poolCard.attach")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="relative mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
        <Icon className="h-3 w-3 text-accent" />
        <span className="font-mono">{t("trafficUI.numbers.poolCard.rotation").replace("{label}", t(meta.labelKey))}</span>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-2 border-t border-border/40 pt-3">
        <div>
          <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-muted-foreground">
            <Hash className="h-2.5 w-2.5" /> {t("trafficUI.numbers.poolCard.numbers")}
          </div>
          <div className="font-mono text-lg font-semibold">{pool.numberCount}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("trafficUI.numbers.poolCard.callsToday")}</div>
          <div className="font-mono text-lg font-semibold">{formatCompact(pool.callsToday)}</div>
        </div>
      </div>
    </motion.div>
  );
}

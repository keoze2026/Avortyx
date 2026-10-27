"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Building2, DollarSign, MoreVertical, Pause, PhoneCall, Play, TrendingUp } from "lucide-react";

import { PartnerStatusBadge } from "@/components/network/partner-status-badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";
import { ROUTES } from "@/lib/constants";
import { formatCompact, formatCurrency, formatPercent } from "@/lib/format";
import type { Buyer } from "@/lib/types";
import { usePermissions } from "@/lib/my-permissions";

interface BuyerCardProps {
  buyer: Buyer;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
}

export function BuyerCard({ buyer, onToggle, onArchive }: BuyerCardProps) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const isActive = buyer.status === "active";
  const dailyUsage = buyer.dailyCap > 0 ? Math.min(1, buyer.callsToday / buyer.dailyCap) : 0;

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "var(--vortyx-glow)" }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.74_0.18_155)]/10 text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)]">
              <Building2 className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`${ROUTES.buyers}/${buyer.id}`}
                className="block truncate font-semibold leading-snug transition-colors hover:text-accent"
              >
                <LocalName name={buyer.name} />
              </Link>
              <p className="truncate text-[11px] text-muted-foreground"><LocalName name={buyer.organization} /></p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PartnerStatusBadge status={buyer.status} />
            {can("buyers", "edit") && (<DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 h-7 w-7 opacity-60 hover:opacity-100"
                  aria-label={t("networkUI.buyers.card.actionsAria")}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onToggle(buyer.id)}>
                  {isActive ? (
                    <>
                      <Pause className="h-4 w-4" /> {t("networkUI.common.pause")}
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" /> {t("networkUI.common.activate")}
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={() => onArchive(buyer.id)}
                  className="text-destructive focus:text-destructive"
                >
                  {t("networkUI.common.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>)}
          </div>
        </div>

        {buyer.description && (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{buyer.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-base font-semibold">
              <DollarSign className="h-3.5 w-3.5 text-accent" />
              {buyer.bidAmount.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.buyers.card.bidCall")}</div>
          </div>
          <div>
            <div className="font-mono text-base font-semibold">{formatCompact(buyer.callsToday)}</div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.buyers.card.callsToday")}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-base font-semibold">
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
              {formatPercent(buyer.conversionRate * 100, 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.buyers.card.conv")}</div>
          </div>
        </div>

        {/* Daily cap usage */}
        <div className="mt-4 space-y-1">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{t("networkUI.buyers.card.dailyCap")}</span>
            <span className="font-mono">
              {formatCompact(buyer.callsToday)} / {buyer.dailyCap === 0 ? "∞" : formatCompact(buyer.dailyCap)}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-secondary/60">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${dailyUsage * 100}%` }}
              transition={{ duration: 0.5 }}
              className={`h-full rounded-full ${
                dailyUsage > 0.85
                  ? "bg-gradient-to-r from-[color:var(--warning)] to-[color:var(--destructive)]"
                  : "bg-gradient-to-r from-[color:var(--accent)] to-[color:var(--vortyx-cyan)]"
              }`}
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <PhoneCall className="h-3 w-3" /> {formatCompact(buyer.callsMonth)} {t("networkUI.buyers.card.thisMonth")}
          </span>
          <span className="font-mono">{formatCurrency(buyer.spendToday)}</span>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { DollarSign, Hash, MoreVertical, Pause, PhoneCall, Play, TrendingUp, Users } from "lucide-react";

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
import type { Publisher } from "@/lib/types";
import { usePermissions } from "@/lib/my-permissions";

export function PublisherCard({
  publisher,
  onToggle,
  onArchive,
}: {
  publisher: Publisher;
  onToggle: (id: string) => void;
  onArchive: (id: string) => void;
}) {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const isActive = publisher.status === "active";

  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.18 }}
      className="group relative overflow-hidden rounded-xl border border-border bg-card"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full blur-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ background: "rgba(150, 95, 220, 0.18)" }}
      />

      <div className="relative p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-1 items-start gap-3">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.65_0.18_290)]/10 text-[oklch(0.55_0.2_290)] dark:text-[oklch(0.72_0.2_290)]">
              <Users className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <Link
                href={`${ROUTES.publishers}/${publisher.id}`}
                className="block truncate font-semibold leading-snug transition-colors hover:text-accent"
              >
                <LocalName name={publisher.name} />
              </Link>
              <p className="truncate text-[11px] text-muted-foreground"><LocalName name={publisher.organization} /></p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <PartnerStatusBadge status={publisher.status} />
            {can("traffic-sources", "edit") && (<DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 h-7 w-7 opacity-60 hover:opacity-100"
                  aria-label={t("networkUI.publishers.card.actionsAria")}
                >
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => onToggle(publisher.id)}>
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
                  onSelect={() => onArchive(publisher.id)}
                  className="text-destructive focus:text-destructive"
                >
                  {t("networkUI.common.remove")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>)}
          </div>
        </div>

        {publisher.description && (
          <p className="mt-3 line-clamp-2 text-xs text-muted-foreground">{publisher.description}</p>
        )}

        <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border/40 pt-4 text-center">
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-base font-semibold">
              <PhoneCall className="h-3.5 w-3.5 text-accent" />
              {formatCompact(publisher.callsToday)}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.publishers.card.callsToday")}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-base font-semibold">
              <DollarSign className="h-3.5 w-3.5 text-accent" />
              {formatCompact(publisher.revenueToday)}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.publishers.card.revenue")}</div>
          </div>
          <div>
            <div className="flex items-center justify-center gap-1 font-mono text-base font-semibold">
              <TrendingUp className="h-3.5 w-3.5 text-accent" />
              {formatPercent(publisher.conversionRate * 100, 0)}
            </div>
            <div className="text-[10px] text-muted-foreground">{t("networkUI.publishers.card.conv")}</div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Hash className="h-3 w-3" /> {t("networkUI.publishers.card.numbers").replace("{count}", String(publisher.numbersAssigned))}
          </span>
          <span className="font-mono">
            {t("networkUI.publishers.card.payout").replace("{pct}", formatPercent(publisher.payoutRate * 100, 0))}
          </span>
          <span className="font-mono">{t("networkUI.publishers.card.pending").replace("{amount}", formatCurrency(publisher.pendingPayout))}</span>
        </div>
      </div>
    </motion.div>
  );
}

"use client";

import { MoreVertical, Pause, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { NumberStatusBadge } from "./number-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName } from "@/lib/i18n/local-name";
import { ROUTES } from "@/lib/constants";
import { formatCompact, formatPercent, formatRelativeTime, toE164 } from "@/lib/format";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { TrackingNumber } from "@/lib/types";

export function NumbersTable({ numbers }: { numbers: TrackingNumber[] }) {
  const { t } = useTranslation();
  const setStatus = useNumbersStore((s) => s.setNumberStatus);
  const remove = useNumbersStore((s) => s.removeNumber);

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <Table>
        <TableHeader>
          <TableRow className="bg-secondary/40">
            <TableHead>{t("trafficUI.numbers.track.headers.number")}</TableHead>
            <TableHead>{t("trafficUI.numbers.track.headers.type")}</TableHead>
            <TableHead>{t("trafficUI.numbers.track.headers.campaign")}</TableHead>
            <TableHead>{t("x318.network.numbers.geo")}</TableHead>
            <TableHead>{t("trafficUI.numbers.track.headers.status")}</TableHead>
            <TableHead>{t("trafficUI.numbers.poolCard.callsToday")}</TableHead>
            <TableHead>{t("x318.network.numbers.conv")}</TableHead>
            <TableHead>{t("x318.network.numbers.lastCall")}</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {numbers.map((n) => {
            const isActive = n.status === "active";
            return (
              <TableRow key={n.id} className="hover:bg-secondary/30">
                <TableCell className="font-mono text-xs">{toE164(n.number)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {n.type === "tollfree" ? t("trafficUI.numbers.typeOptions.tollfree") : n.type === "local" ? t("trafficUI.numbers.typeOptions.local") : t("trafficUI.numbers.typeOptions.international")}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs">
                  {n.campaignId && n.campaignName ? (
                    <Link
                      href={`${ROUTES.campaigns}/${n.campaignId}`}
                      className="truncate text-foreground transition-colors hover:text-accent"
                    >
                      <LocalName name={n.campaignName} />
                    </Link>
                  ) : (
                    <span className="text-muted-foreground italic">{t("trafficUI.numbers.track.unassigned")}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs font-mono">
                  {n.state ? `${n.city}, ${n.state}` : "—"}
                </TableCell>
                <TableCell>
                  <NumberStatusBadge status={n.status} />
                </TableCell>
                <TableCell className="font-mono">{formatCompact(n.callsToday)}</TableCell>
                <TableCell className="font-mono text-xs">
                  {formatPercent(n.conversionRate * 100, 0)}
                </TableCell>
                <TableCell className="text-xs font-mono text-muted-foreground">
                  {n.lastCallAt ? formatRelativeTime(n.lastCallAt) : "—"}
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("trafficUI.common.actions")}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onSelect={() => {
                          setStatus(n.id, isActive ? "paused" : "active");
                          toast.success(
                            isActive
                              ? t("trafficUI.campaigns.settings.trackingNumbers.toast.paused").replace("{number}", toE164(n.number))
                              : t("trafficUI.campaigns.settings.trackingNumbers.toast.activated").replace("{number}", toE164(n.number)),
                          );
                        }}
                      >
                        {isActive ? (
                          <>
                            <Pause className="h-4 w-4" /> {t("trafficUI.campaigns.detail.pause")}
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" /> {t("trafficUI.campaigns.detail.activate")}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onSelect={() => {
                          remove(n.id);
                          toast.success(t("trafficUI.numbers.track.releaseSuccess").replace("{number}", toE164(n.number)));
                        }}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" /> {t("trafficUI.numbers.track.release").replace("{number}", toE164(n.number))}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}

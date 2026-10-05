"use client";

import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { ROUTES } from "@/lib/constants";
import { formatCompact, formatNumber } from "@/lib/format";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { NumberPool } from "@/lib/types";

/* ===========================================================
   Derived column values
   =========================================================== */

/* hash() and the three lists it picked from are gone. They turned a pool's id
 * into a country, a closed-browser delay, an idle limit, an impression count
 * and a missed-call count - five columns of a table that reads as measurement.
 *
 * The backend sends none of these yet, so each shows a dash. A blank column is
 * honest; a populated one that nobody measured is not. */

export const POOL_DASH = "\u2014";

export function derivePoolCountry(p: NumberPool): string | undefined {
  return p.country?.trim() || undefined;
}

export function deriveClosedBrowserDelay(p: NumberPool): number | undefined {
  return typeof p.closedBrowserDelaySec === "number" ? p.closedBrowserDelaySec : undefined;
}

export function deriveIdleLimit(p: NumberPool): number | undefined {
  return typeof p.idleTimeSec === "number" ? p.idleTimeSec : undefined;
}

/* Impressions and missed calls have no field on NumberPool and nothing in the
 * backend counts them. They were callsToday * 30 plus a hash, and
 * callsToday * 0.04 plus a hash - arithmetic on an unrelated number dressed as
 * a measurement. Until something counts them, they are blank. */
export function deriveImpressions(_p: NumberPool): number | undefined {
  return undefined;
}

export function deriveMisses(_p: NumberPool): number | undefined {
  return undefined;
}

function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0 ? `${m}m` : `${m}m ${rest}s`;
}

/* ===========================================================
   Visible-columns set
   =========================================================== */

export const POOL_COLUMNS = [
  { id: "name", label: "Name", labelKey: "trafficUI.numbers.pools.headers.name" },
  { id: "country", label: "Country", labelKey: "trafficUI.numbers.pools.headers.country" },
  { id: "poolSize", label: "Pool size", labelKey: "trafficUI.numbers.pools.headers.poolSize" },
  { id: "campaign", label: "Campaign", labelKey: "trafficUI.numbers.pools.headers.campaign" },
  { id: "closedBrowserDelay", label: "Closed browser delay", labelKey: "trafficUI.numbers.pools.headers.closedBrowserDelay" },
  { id: "idleLimit", label: "Idle limit", labelKey: "trafficUI.numbers.pools.headers.idleLimit" },
  { id: "impressions", label: "Impressions", labelKey: "trafficUI.numbers.pools.headers.impressions" },
  { id: "misses", label: "Misses", labelKey: "trafficUI.numbers.pools.headers.misses" },
  { id: "status", label: "Status", labelKey: "trafficUI.numbers.pools.headers.status" },
  { id: "actions", label: "Actions", labelKey: "trafficUI.numbers.pools.headers.actions", required: true as const },
];

interface Props {
  pools: NumberPool[];
  visibleColumns: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

export function PoolsTable({
  pools,
  visibleColumns,
  selected,
  onToggle,
  onToggleAll,
}: Props) {
  const { t } = useTranslation();
  const router = useRouter();
  const setActive = useNumbersStore((s) => s.setPoolActive);
  const remove = useNumbersStore((s) => s.removePool);

  const allChecked = pools.length > 0 && pools.every((p) => selected.has(p.id));
  const colSpan = 1 + visibleColumns.size;

  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[1100px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 w-10 text-left">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={onToggleAll}
                  aria-label={t("trafficUI.common.selectAll")}
                />
              </TableHead>
              {visibleColumns.has("name") && (
                <TableHead className="text-left">{t("trafficUI.numbers.pools.headers.name")}</TableHead>
              )}
              {visibleColumns.has("country") && <TableHead>{t("trafficUI.numbers.pools.headers.country")}</TableHead>}
              {visibleColumns.has("poolSize") && <TableHead>{t("trafficUI.numbers.pools.headers.poolSize")}</TableHead>}
              {visibleColumns.has("campaign") && (
                <TableHead className="text-left">{t("trafficUI.numbers.pools.headers.campaign")}</TableHead>
              )}
              {visibleColumns.has("closedBrowserDelay") && (
                <TableHead>{t("trafficUI.numbers.pools.headers.closedBrowserDelay")}</TableHead>
              )}
              {visibleColumns.has("idleLimit") && <TableHead>{t("trafficUI.numbers.pools.headers.idleLimit")}</TableHead>}
              {visibleColumns.has("impressions") && <TableHead>{t("trafficUI.numbers.pools.headers.impressions")}</TableHead>}
              {visibleColumns.has("misses") && <TableHead>{t("trafficUI.numbers.pools.headers.misses")}</TableHead>}
              {visibleColumns.has("status") && <TableHead>{t("trafficUI.numbers.pools.headers.status")}</TableHead>}
              <TableHead className="pr-4">{t("trafficUI.numbers.pools.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pools.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-10 text-center text-xs text-muted-foreground">
                  {t("trafficUI.common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              pools.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="pl-4 text-left">
                    <Checkbox
                      checked={selected.has(p.id)}
                      onCheckedChange={() => onToggle(p.id)}
                      aria-label={t("trafficUI.campaigns.table.selectRow").replace("{name}", p.name)}
                    />
                  </TableCell>
                  {visibleColumns.has("name") && (
                    <TableCell className="text-left font-medium">{p.name}</TableCell>
                  )}
                  {visibleColumns.has("country") && (
                    <TableCell className="text-muted-foreground">
                      {derivePoolCountry(p) ?? POOL_DASH}
                    </TableCell>
                  )}
                  {visibleColumns.has("poolSize") && (
                    <TableCell className="tabular-nums">
                      {formatNumber(p.numberCount)}
                    </TableCell>
                  )}
                  {visibleColumns.has("campaign") && (
                    <TableCell className="text-left text-xs text-muted-foreground">
                      {p.campaignName}
                    </TableCell>
                  )}
                  {visibleColumns.has("closedBrowserDelay") && (
                    <TableCell className="font-mono text-xs tabular-nums">
                      {deriveClosedBrowserDelay(p) === undefined ? POOL_DASH : formatSeconds(deriveClosedBrowserDelay(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("idleLimit") && (
                    <TableCell className="font-mono text-xs tabular-nums">
                      {deriveIdleLimit(p) === undefined ? POOL_DASH : formatSeconds(deriveIdleLimit(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("impressions") && (
                    <TableCell className="tabular-nums">
                      {deriveImpressions(p) === undefined ? POOL_DASH : formatCompact(deriveImpressions(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("misses") && (
                    <TableCell className="tabular-nums">
                      {deriveMisses(p) === undefined ? POOL_DASH : formatNumber(deriveMisses(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("status") && (
                    <TableCell>
                      <Switch
                        checked={p.active}
                        onCheckedChange={(v) => {
                          setActive(p.id, Boolean(v));
                          toast.success(
                            (v
                              ? t("trafficUI.numbers.pools.toast.activated")
                              : t("trafficUI.numbers.pools.toast.paused")
                            ).replace("{name}", p.name),
                          );
                        }}
                        aria-label={t("trafficUI.numbers.pools.toggle").replace("{name}", p.name)}
                      />
                    </TableCell>
                  )}
                  <TableCell className="pr-4">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("trafficUI.numbers.pools.edit").replace("{name}", p.name)}
                        onClick={() => router.push(`${ROUTES.numbers}/pools/${p.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        aria-label={t("trafficUI.numbers.pools.remove").replace("{name}", p.name)}
                        onClick={() => {
                          remove(p.id);
                          toast.success(t("trafficUI.numbers.pools.removed").replace("{name}", p.name));
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

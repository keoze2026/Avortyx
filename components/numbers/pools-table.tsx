"use client";

import { useRouter } from "next/navigation";
import { Code2, MoreHorizontal, Pause, Pencil, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { poolSnippet, PoolStatusPill, shortKey } from "@/components/numbers/pool-design";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { LocalName, useLocalName } from "@/lib/i18n/local-name";
import { countryLabel } from "@/components/numbers/country-label";
import { ROUTES } from "@/lib/constants";
import { formatNumber } from "@/lib/format";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { NumberPool } from "@/lib/types";
import { Can } from "@/components/shared/can";

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

/* CH-461: impressions (numbers asked for by the website script today) and
 * misses (visitors shown the fallback because every number was busy) are
 * counted by the server since CH-460. A pool from an older server shows a dash. */
export function deriveImpressions(p: NumberPool): number | undefined {
  return p.design?.impressionsToday;
}

export function deriveMisses(p: NumberPool): number | undefined {
  return p.design?.missesToday;
}

function formatSeconds(s: number, t: (key: string) => string): string {
  if (s < 60) return t("x318.network.unit.seconds").replace("{n}", String(s));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  return rest === 0
    ? t("x318.network.unit.minutes").replace("{n}", String(m))
    : t("x318.network.unit.minSec").replace("{m}", String(m)).replace("{s}", String(rest));
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
  const localName = useLocalName();
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
                    <TableCell className="text-left">
                      <div className="font-medium"><LocalName name={p.name} /></div>
                      {p.design?.publicKey && (
                        <div className="font-mono text-[11px] text-muted-foreground">{shortKey(p.design.publicKey)}</div>
                      )}
                    </TableCell>
                  )}
                  {visibleColumns.has("country") && (
                    <TableCell className="text-muted-foreground">
                      {countryLabel(derivePoolCountry(p)) || POOL_DASH}
                    </TableCell>
                  )}
                  {visibleColumns.has("poolSize") && (
                    <TableCell>
                      <PoolSizeBar inUse={p.stats?.inUse ?? 0} total={p.numberCount} />
                    </TableCell>
                  )}
                  {visibleColumns.has("campaign") && (
                    <TableCell className="text-left text-xs text-muted-foreground">
                      <LocalName name={p.campaignName} />
                    </TableCell>
                  )}
                  {visibleColumns.has("closedBrowserDelay") && (
                    <TableCell className="font-mono text-xs tabular-nums">
                      {deriveClosedBrowserDelay(p) === undefined ? POOL_DASH : formatSeconds(deriveClosedBrowserDelay(p)!, t)}
                    </TableCell>
                  )}
                  {visibleColumns.has("idleLimit") && (
                    <TableCell className="font-mono text-xs tabular-nums">
                      {deriveIdleLimit(p) === undefined ? POOL_DASH : formatSeconds(deriveIdleLimit(p)!, t)}
                    </TableCell>
                  )}
                  {visibleColumns.has("impressions") && (
                    <TableCell className="tabular-nums">
                      {deriveImpressions(p) === undefined ? POOL_DASH : formatNumber(deriveImpressions(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("misses") && (
                    <TableCell className={`tabular-nums ${(deriveMisses(p) ?? 0) > 0 ? "text-amber-500" : ""}`}>
                      {deriveMisses(p) === undefined ? POOL_DASH : formatNumber(deriveMisses(p)!)}
                    </TableCell>
                  )}
                  {visibleColumns.has("status") && (
                    <TableCell>
                      <PoolStatusPill status={p.design?.statusLabel ?? (p.active ? "active" : "paused")} />
                    </TableCell>
                  )}
                  <TableCell className="pr-4">
                    <div className="inline-flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("x461.copySnippet")}
                        title={t("x461.copySnippet")}
                        disabled={!p.design?.publicKey}
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(poolSnippet(p.design?.publicKey ?? ""));
                            toast.success(t("x461.snippetCopied"));
                          } catch {
                            toast.error(t("trafficUI.common.copyFailed"));
                          }
                        }}
                      >
                        <Code2 className="h-3.5 w-3.5" />
                      </Button>
                      <Can area="number-pools" action="edit"><Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        aria-label={t("trafficUI.numbers.pools.edit").replace("{name}", p.name)}
                        onClick={() => router.push(`${ROUTES.numbers}/pools/${p.id}`)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button></Can>
                      <Can area="number-pools" action="edit">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("x461.more")}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                const v = !p.active;
                                setActive(p.id, v);
                                toast.success(
                                  (v
                                    ? t("trafficUI.numbers.pools.toast.activated")
                                    : t("trafficUI.numbers.pools.toast.paused")
                                  ).replace("{name}", localName(p.name)),
                                );
                              }}
                            >
                              {p.active ? <Pause className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
                              {p.active ? t("x461.pausePool") : t("x461.activatePool")}
                            </DropdownMenuItem>
                            <Can area="number-pools" action="delete">
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => {
                                  if (!window.confirm(t("x461.deleteConfirm").replace("{name}", localName(p.name)))) return;
                                  remove(p.id);
                                  toast.success(t("trafficUI.numbers.pools.removed").replace("{name}", localName(p.name)));
                                }}
                              >
                                <Trash2 className="mr-2 h-3.5 w-3.5" />
                                {t("x461.deletePool")}
                              </DropdownMenuItem>
                            </Can>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </Can>
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

/** "38/50 in use" with a bar; amber when every number is busy (Sir's list). */
function PoolSizeBar({ inUse, total }: { inUse: number; total: number }) {
  const { t } = useTranslation();
  const pct = total > 0 ? Math.min(100, Math.round((inUse / total) * 100)) : 0;
  const full = total > 0 && inUse >= total;
  return (
    <div className="w-[88px]">
      <div className="text-xs">
        <span className="font-mono tabular-nums">{formatNumber(inUse)}/{formatNumber(total)}</span>{" "}
        <span className="text-muted-foreground">{t("x461.inUse")}</span>
      </div>
      <div className="mt-1 h-1 w-full rounded-full bg-muted">
        <div className={`h-1 rounded-full ${full ? "bg-amber-500" : "bg-foreground"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

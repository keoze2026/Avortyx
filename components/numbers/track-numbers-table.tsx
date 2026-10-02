"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { EditNumberDialog } from "./edit-number-dialog";
import { NumberStatusBadge } from "./number-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { ROUTES } from "@/lib/constants";
import { formatCompact, formatNumber, toE164 } from "@/lib/format";
import { useNumbersStore } from "@/lib/store/numbers-store";
import type { TrackingNumber } from "@/lib/types";
import { cn } from "@/lib/utils";

/* ===========================================================
   Derived column values
   ----------------------------------------------------------
   The new column set adds fields we don't store on
   `TrackingNumber` (vendor, lifetime, allocated cap, etc.).
   Rather than backfill the whole mock seed, we derive these
   deterministically from each record's id so values stay
   stable across renders.
   =========================================================== */

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Every text cell in a number row shares one font, size, weight and colour —
 *  the same style as the Reporting tables (Inter Medium, 9.5px). */
const CELL = "text-[9.5px] font-medium tabular-nums text-foreground";

const VENDORS = ["Bandwidth", "Twilio", "Inteliquent", "Telnyx", "Voxbone"];
const ALLOCATED_OPTIONS = [100, 250, 500, 1_000, 2_500];
const COUNTRIES_LOCAL = ["United States", "Canada"];
const COUNTRIES_INTL = ["United Kingdom", "Australia", "Germany", "France"];

export function deriveName(n: TrackingNumber): string {
  const last4 = n.number.replace(/\D/g, "").slice(-4);
  if (n.city) return `${n.city} ${last4}`;
  return `DID-${last4}`;
}

export function deriveCountry(n: TrackingNumber): string {
  // Prefer the real value from the backend; fall back to a deterministic
  // hash-derived placeholder so existing demos keep rendering. When the
  // backend ships the `country` field this branch silently goes away.
  if (n.country) return n.country;
  const h = hash(n.id);
  if (n.type === "international") return COUNTRIES_INTL[h % COUNTRIES_INTL.length];
  return COUNTRIES_LOCAL[h % COUNTRIES_LOCAL.length];
}

export function derivePurchaseStatus(n: TrackingNumber): {
  label: string;
  labelKey: string;
  tone: "success" | "warning" | "outline" | "destructive";
} {
  if (n.status === "pending") return { label: "Pending", labelKey: "trafficUI.numbers.track.purchase.pending", tone: "warning" };
  if (n.status === "expired") return { label: "Expired", labelKey: "trafficUI.numbers.track.purchase.expired", tone: "destructive" };
  return { label: "Purchased", labelKey: "trafficUI.numbers.track.purchase.purchased", tone: "success" };
}

export function deriveAllocated(n: TrackingNumber): number {
  // Prefer the real value from the backend; fall back to a deterministic
  // placeholder so unpopulated demos stay readable.
  if (typeof n.allocatedCapacity === "number") return n.allocatedCapacity;
  return ALLOCATED_OPTIONS[hash(n.id) % ALLOCATED_OPTIONS.length];
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveRenewDate(n: TrackingNumber): string {
  // Prefer the real value from the backend; fall back to a deterministic
  // 5..34-day offset so the column never blanks out during demos.
  const ts = n.renewsAt ?? Date.now() + (5 + (hash(n.id) % 30)) * DAY_MS;
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function deriveLifetimeDays(n: TrackingNumber): number {
  return Math.max(1, Math.floor((Date.now() - n.provisionedAt) / DAY_MS));
}

/**
 * Resolve the carrier shown in the "Publisher" column (the underlying
 * field is still named `vendor` in our domain types — that's the telecom
 * industry term — but the UI labels it as "Publisher" per product
 * preference). Prefer the backend value; fall back to a deterministic
 * placeholder so empty demos stay readable.
 */
export function deriveVendor(n: TrackingNumber): string {
  if (n.vendor && n.vendor.trim()) return n.vendor;
  return VENDORS[hash(n.id) % VENDORS.length];
}

export function deriveLive(n: TrackingNumber): number {
  if (n.status !== "active") return 0;
  return hash(n.id + "live") % 4; // 0..3 concurrent
}

export function deriveHourly(n: TrackingNumber): number {
  // ~ callsToday / 24 ± jitter
  const base = Math.max(0, Math.round(n.callsToday / 24));
  return base + (hash(n.id + "hr") % 3);
}

export function deriveGlobal(n: TrackingNumber): number {
  // All-time across this number's lifetime — scale with monthly volume.
  const months = Math.max(1, Math.round(deriveLifetimeDays(n) / 30));
  return n.callsMonthly * months + (hash(n.id + "g") % 500);
}

/* ===========================================================
   Visible-columns set
   =========================================================== */

export const TRACK_NUMBERS_COLUMNS = [
  { id: "number", label: "Number", labelKey: "trafficUI.numbers.track.headers.number" },
  { id: "name", label: "Name", labelKey: "trafficUI.numbers.track.headers.name" },
  { id: "country", label: "Country", labelKey: "trafficUI.numbers.track.headers.country" },
  { id: "purchaseStatus", label: "Purchase status", labelKey: "trafficUI.numbers.track.headers.purchaseStatus" },
  { id: "type", label: "Type", labelKey: "trafficUI.numbers.track.headers.type" },
  { id: "region", label: "Region", labelKey: "trafficUI.numbers.track.headers.region" },
  { id: "campaign", label: "Campaign", labelKey: "trafficUI.numbers.track.headers.campaign" },
  { id: "allocated", label: "Allocated", labelKey: "trafficUI.numbers.track.headers.allocated" },
  { id: "renew", label: "Renew", labelKey: "trafficUI.numbers.track.headers.renew" },
  { id: "lifetime", label: "Lifetime", labelKey: "trafficUI.numbers.track.headers.lifetime" },
  { id: "vendor", label: "Publisher", labelKey: "trafficUI.numbers.track.headers.vendor" },
  { id: "live", label: "Live", labelKey: "trafficUI.numbers.track.headers.live" },
  { id: "hourly", label: "Hourly", labelKey: "trafficUI.numbers.track.headers.hourly" },
  { id: "daily", label: "Daily", labelKey: "trafficUI.numbers.track.headers.daily" },
  { id: "monthly", label: "Monthly", labelKey: "trafficUI.numbers.track.headers.monthly" },
  { id: "global", label: "Global", labelKey: "trafficUI.numbers.track.headers.global" },
  { id: "status", label: "Status", labelKey: "trafficUI.numbers.track.headers.status" },
  { id: "actions", label: "Actions", labelKey: "trafficUI.numbers.track.headers.actions", required: true as const },
];

interface Props {
  numbers: TrackingNumber[];
  visibleColumns: Set<string>;
  selected: Set<string>;
  onToggle: (id: string) => void;
  onToggleAll: () => void;
}

export function TrackNumbersTable({
  numbers,
  visibleColumns,
  selected,
  onToggle,
  onToggleAll,
}: Props) {
  const { t } = useTranslation();
  const remove = useNumbersStore((s) => s.removeNumber);
  const [editing, setEditing] = useState<TrackingNumber | null>(null);

  const allChecked = numbers.length > 0 && numbers.every((n) => selected.has(n.id));
  // +1 for the checkbox column
  const colSpan = 1 + Array.from(visibleColumns).length;

  return (
    <>
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[1600px]">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 w-10 text-left">
                <Checkbox
                  checked={allChecked}
                  onCheckedChange={onToggleAll}
                  aria-label={t("trafficUI.common.selectAll")}
                />
              </TableHead>
              {visibleColumns.has("number") && (
                <TableHead className="text-left">{t("trafficUI.numbers.track.headers.number")}</TableHead>
              )}
              {visibleColumns.has("name") && (
                <TableHead className="text-left">{t("trafficUI.numbers.track.headers.name")}</TableHead>
              )}
              {visibleColumns.has("country") && (
                <TableHead className="text-left">{t("trafficUI.numbers.track.headers.country")}</TableHead>
              )}
              {visibleColumns.has("purchaseStatus") && <TableHead>{t("trafficUI.numbers.track.headers.purchaseStatus")}</TableHead>}
              {visibleColumns.has("type") && <TableHead>{t("trafficUI.numbers.track.headers.type")}</TableHead>}
              {visibleColumns.has("region") && <TableHead>{t("trafficUI.numbers.track.headers.region")}</TableHead>}
              {visibleColumns.has("campaign") && (
                <TableHead className="text-left">{t("trafficUI.numbers.track.headers.campaign")}</TableHead>
              )}
              {visibleColumns.has("allocated") && <TableHead>{t("trafficUI.numbers.track.headers.allocated")}</TableHead>}
              {visibleColumns.has("renew") && <TableHead>{t("trafficUI.numbers.track.headers.renew")}</TableHead>}
              {visibleColumns.has("lifetime") && <TableHead>{t("trafficUI.numbers.track.headers.lifetime")}</TableHead>}
              {visibleColumns.has("vendor") && <TableHead>{t("trafficUI.numbers.track.headers.vendor")}</TableHead>}
              {visibleColumns.has("live") && <TableHead>{t("trafficUI.numbers.track.headers.live")}</TableHead>}
              {visibleColumns.has("hourly") && <TableHead>{t("trafficUI.numbers.track.headers.hourly")}</TableHead>}
              {visibleColumns.has("daily") && <TableHead>{t("trafficUI.numbers.track.headers.daily")}</TableHead>}
              {visibleColumns.has("monthly") && <TableHead>{t("trafficUI.numbers.track.headers.monthly")}</TableHead>}
              {visibleColumns.has("global") && <TableHead>{t("trafficUI.numbers.track.headers.global")}</TableHead>}
              {visibleColumns.has("status") && <TableHead>{t("trafficUI.numbers.track.headers.status")}</TableHead>}
              <TableHead className="pr-4">{t("trafficUI.numbers.track.headers.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {numbers.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={colSpan} className="py-10 text-center text-xs text-muted-foreground">
                  {t("trafficUI.common.noData")}
                </TableCell>
              </TableRow>
            ) : (
              numbers.map((n) => {
                const purchase = derivePurchaseStatus(n);
                const live = deriveLive(n);
                return (
                  <TableRow key={n.id}>
                    <TableCell className="pl-4 text-left">
                      <Checkbox
                        checked={selected.has(n.id)}
                        onCheckedChange={() => onToggle(n.id)}
                        aria-label={t("trafficUI.numbers.track.selectRow").replace("{number}", toE164(n.number))}
                      />
                    </TableCell>
                    {visibleColumns.has("number") && (
                      <TableCell className={cn("text-left", CELL)}>
                        {toE164(n.number)}
                      </TableCell>
                    )}
                    {visibleColumns.has("name") && (
                      <TableCell className={cn("text-left", CELL)}>
                        {n.label?.trim() || deriveName(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("country") && (
                      <TableCell className={cn("text-left", CELL)}>
                        {deriveCountry(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("purchaseStatus") && (
                      <TableCell>
                        <Badge variant={purchase.tone}>{t(purchase.labelKey)}</Badge>
                      </TableCell>
                    )}
                    {visibleColumns.has("type") && (
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {n.type === "tollfree" ? t("trafficUI.numbers.typeOptions.tollfree") : n.type === "local" ? t("trafficUI.numbers.typeOptions.local") : t("trafficUI.numbers.typeOptions.international")}
                        </Badge>
                      </TableCell>
                    )}
                    {visibleColumns.has("region") && (
                      <TableCell className={CELL}>
                        {n.state ?? "—"}
                      </TableCell>
                    )}
                    {visibleColumns.has("campaign") && (
                      <TableCell className={cn("text-left", CELL)}>
                        {n.campaignId && n.campaignName ? (
                          <Link
                            href={`${ROUTES.campaigns}/${n.campaignId}`}
                            className="text-foreground transition-colors hover:text-accent"
                          >
                            {n.campaignName}
                          </Link>
                        ) : (
                          <span>{t("trafficUI.numbers.track.unassigned")}</span>
                        )}
                      </TableCell>
                    )}
                    {visibleColumns.has("allocated") && (
                      <TableCell className={CELL}>
                        {formatNumber(deriveAllocated(n))}
                      </TableCell>
                    )}
                    {visibleColumns.has("renew") && (
                      <TableCell className={CELL}>
                        {deriveRenewDate(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("lifetime") && (
                      <TableCell className={CELL}>
                        {deriveLifetimeDays(n)}d
                      </TableCell>
                    )}
                    {visibleColumns.has("vendor") && (
                      <TableCell className={CELL}>
                        {deriveVendor(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("live") && (
                      <TableCell
                        className={cn(
                          CELL,
                          live > 0 && "text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)]",
                        )}
                      >
                        {live}
                      </TableCell>
                    )}
                    {visibleColumns.has("hourly") && (
                      <TableCell className={CELL}>
                        {formatNumber(deriveHourly(n))}
                      </TableCell>
                    )}
                    {visibleColumns.has("daily") && (
                      <TableCell className={CELL}>
                        {formatNumber(n.callsToday)}
                      </TableCell>
                    )}
                    {visibleColumns.has("monthly") && (
                      <TableCell className={CELL}>
                        {formatCompact(n.callsMonthly)}
                      </TableCell>
                    )}
                    {visibleColumns.has("global") && (
                      <TableCell className={CELL}>
                        {formatCompact(deriveGlobal(n))}
                      </TableCell>
                    )}
                    {visibleColumns.has("status") && (
                      <TableCell>
                        <NumberStatusBadge status={n.status} />
                      </TableCell>
                    )}
                    <TableCell className="pr-4">
                      <div className="inline-flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          aria-label={t("trafficUI.numbers.track.edit").replace("{number}", toE164(n.number))}
                          onClick={() => setEditing(n)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          aria-label={t("trafficUI.numbers.track.release").replace("{number}", toE164(n.number))}
                          onClick={() => {
                            remove(n.id);
                            toast.success(t("trafficUI.numbers.track.releaseSuccess").replace("{number}", toE164(n.number)));
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
    <EditNumberDialog
      number={editing}
      open={editing !== null}
      onOpenChange={(v) => !v && setEditing(null)}
    />
    </>
  );
}
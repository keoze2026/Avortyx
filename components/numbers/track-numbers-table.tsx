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
import { formatCompact, formatLocalDate, formatNumber, toE164 } from "@/lib/format";
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


/** Every text cell in a number row shares one font, size, weight and colour —
 *  the same style as the Reporting tables (Inter Medium, 9.5px). */
const CELL = "text-[9.5px] font-medium tabular-nums text-foreground";

/* VENDORS, ALLOCATED_OPTIONS and the two COUNTRIES lists are gone, with the
 * hash() that picked from them. They turned a number's id into a carrier, a
 * capacity, a country, a renewal date and three call counters - so ten numbers
 * imported minutes earlier, which had never carried a call, displayed 150-494
 * lifetime calls, 1-3 concurrent, and renewal dates spread across three weeks.
 *
 * A blank column is readable. An invented one is not, and on this page it is
 * billing information. */

/** Shown wherever the backend has no value. */
const DASH = "\u2014";

export function deriveName(n: TrackingNumber): string {
  const last4 = n.number.replace(/\D/g, "").slice(-4);
  if (n.city) return `${n.city} ${last4}`;
  // Toll-free numbers are TFNs, the others DIDs.
  return n.type === "tollfree" ? `TFN-${last4}` : `DID-${last4}`;
}

export function deriveCountry(n: TrackingNumber): string {
  return n.country?.trim() || DASH;
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

export function deriveAllocated(n: TrackingNumber): number | undefined {
  return typeof n.allocatedCapacity === "number" ? n.allocatedCapacity : undefined;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function deriveRenewDate(n: TrackingNumber): string {
  // A rental renewal is a date money moves on. Inventing one told somebody a
  // charge was coming on a day nothing happens.
  if (!n.renewsAt) return DASH;
  return formatLocalDate(n.renewsAt, { month: "short", day: "numeric" });
}

export function deriveLifetimeDays(n: TrackingNumber): number {
  return Math.max(1, Math.floor((Date.now() - n.provisionedAt) / DAY_MS));
}

/** The carrier's short code, e.g. KMQ. Blank until a carrier is set on the
 *  number — the code is a row in the backend's carrier table, never a value
 *  guessed from the number or the vendor. */
export function deriveCarrierCode(n: TrackingNumber): string {
  return n.carrierCode?.trim() || DASH;
}

/** The day this number was put on a campaign. A number that has never been
 *  assigned has no such date, and showing today's would say it started
 *  earning today. */
export function deriveAssignedDate(n: TrackingNumber): string {
  if (!n.assignedAt) return DASH;
  return new Date(n.assignedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Resolve the carrier shown in the "Publisher" column (the underlying
 * field is still named `vendor` in our domain types — that's the telecom
 * industry term — but the UI labels it as "Publisher" per product
 * preference). Prefer the backend value; fall back to a deterministic
 * placeholder so empty demos stay readable.
 */
export function deriveVendor(n: TrackingNumber): string {
  // The publisher assigned to this number in the campaign's settings - nothing
  // else. (`vendor` is where the number was bought - "Other", "Twilio" - and is
  // not a publisher.)
  return n.publisherName?.trim() || DASH;
}

/** Concurrent calls on this number right now, counted by the backend from the
 *  call log. This used to be `hash(id) % 4` — a number that never moved and was
 *  never zero, while the real count was already in the response and ignored. */
export function deriveLive(n: TrackingNumber): number {
  return n.liveCalls ?? 0;
}

/** Calls in the current hour. The backend does not aggregate this yet, so the
 *  column is blank rather than a guess derived from the daily figure. */
export function deriveHourly(n: TrackingNumber): number | undefined {
  return n.callsHourly;
}

/** Calls over this number's whole life. Also not aggregated by the backend. */
export function deriveGlobal(n: TrackingNumber): number | undefined {
  return n.callsGlobal;
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
  { id: "carrier", label: "Code", labelKey: "trafficUI.numbers.track.headers.carrier" },
  { id: "assigned", label: "Assigned", labelKey: "trafficUI.numbers.track.headers.assigned" },
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
                <TableHead className="text-center">{t("trafficUI.numbers.track.headers.country")}</TableHead>
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
              {visibleColumns.has("carrier") && <TableHead>{t("trafficUI.numbers.track.headers.carrier")}</TableHead>}
              {visibleColumns.has("assigned") && <TableHead>{t("trafficUI.numbers.track.headers.assigned")}</TableHead>}
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
                      <TableCell className={cn("text-center", CELL)}>
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
                        {n.state?.trim() || n.country?.trim() || "—"}
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
                        {deriveAllocated(n) === undefined ? DASH : formatNumber(deriveAllocated(n)!)}
                      </TableCell>
                    )}
                    {visibleColumns.has("renew") && (
                      <TableCell className={CELL}>
                        {deriveRenewDate(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("lifetime") && (
                      <TableCell className={CELL}>
                        {t("common.daysShort").replace("{n}", String(deriveLifetimeDays(n)))}
                      </TableCell>
                    )}
                    {visibleColumns.has("carrier") && (
                      <TableCell className={CELL}>
                        {deriveCarrierCode(n)}
                      </TableCell>
                    )}
                    {visibleColumns.has("assigned") && (
                      <TableCell className={CELL}>
                        {deriveAssignedDate(n)}
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
                        {deriveHourly(n) === undefined ? DASH : formatNumber(deriveHourly(n)!)}
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
                        {deriveGlobal(n) === undefined ? DASH : formatCompact(deriveGlobal(n)!)}
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
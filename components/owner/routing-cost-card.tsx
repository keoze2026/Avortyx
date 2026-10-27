"use client";

/**
 * Owner > Carrier Costs: routing cost (CH-186).
 *
 * What the termination carrier (XOLO) charges to route our calls on to
 * buyers: every connected second of every call we forwarded, at the
 * per-minute rate, per Eastern day. Sir, 21 Oct: "set routing cost so we can
 * see how much cost from yesterday". Exact seconds, so it is an estimate to
 * check the carrier's invoice against. Backend: /api/owner/routing-cost.
 *
 * CH-334 (Sir, 28 Oct: "2770 calls just $93 cost?"): calls counted as the
 * reports count them, each call rounded as the carrier bills (Edit rate >
 * Minutes billed), and the average call and the cost of one call shown, so
 * the total can be checked at a glance. The dates are the portal's own picker.
 */

import { useCallback, useEffect, useState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PeriodPicker, rangeFor, type Preset } from "@/components/owner/period-picker";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { formatTimer, uiLocaleTag } from "@/lib/format";
import { useLocalName } from "@/lib/i18n/local-name";
import { cn } from "@/lib/utils";

interface Figures {
  forwarded: number;
  connected: number;
  seconds: number;
  /** The seconds the carrier bills: each call rounded to the billing increment (CH-334). */
  billedSeconds?: number;
  /** Average talk time of a connected call (CH-334). */
  ahtSeconds?: number;
  minutes: string;
  cost: string;
  costExact: string;
  /** What one connected call cost (CH-334). */
  costPerCall?: string;
}

interface Day extends Figures {
  date: string;
}

interface RoutingCost {
  name: string;
  perMinuteCost: string;
  monthlyFee: string;
  /** How the carrier rounds each call: 1, 6, 30 or 60 seconds (CH-334). */
  billingIncrement?: number;
  start: string;
  end: string;
  days: Day[];
  totals: Figures;
}

const INCREMENTS = [1, 6, 30, 60] as const;

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** The default termination route's name is ours, so it is translated; a name the owner typed is written in the chosen script. */
export const DEFAULT_ROUTE_NAME = "XOLO TFN termination";

export function routeNameLabel(
  name: string | null | undefined,
  t: (key: string) => string,
  localName: (name: string | null | undefined) => string,
): string {
  if (!name || name === DEFAULT_ROUTE_NAME) return t("x318.app.routeDefaultName");
  return localName(name);
}

function dayLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return d.toLocaleDateString(uiLocaleTag(), { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

export function RoutingCostCard() {
  const { t } = useTranslation();
  const localName = useLocalName();
  // Opens on Today (Eastern), also after a refresh (Sir, 24 Oct).
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState(() => rangeFor("today"));
  const [data, setData] = useState<RoutingCost | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ perMinuteCost: "", monthlyFee: "", billingIncrement: 1 });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (start: string, end: string) => {
    setLoading(true);
    try {
      setData(await http.get<RoutingCost>(`/api/owner/routing-cost?start=${start}&end=${end}`));
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("routingCost.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(range.start, range.end);
  }, [range, load]);


  async function saveRate() {
    setBusy(true);
    try {
      await http.patch("/api/owner/routing-cost/rate", {
        body: {
          perMinuteCost: form.perMinuteCost || "0",
          monthlyFee: form.monthlyFee || "0",
          billingIncrement: form.billingIncrement,
        },
      });
      toast.success(t("routingCost.saved"));
      setEditing(false);
      void load(range.start, range.end);
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : t("routingCost.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  const tile = (label: string, value: string, strong = false) => (
    <div className="border-r border-border px-4 py-3 last:border-r-0">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={cn("tabular-nums", strong ? "text-base font-semibold" : "text-sm")}>{value}</div>
    </div>
  );

  const totals = data?.totals;
  return (
    <Card>
      <CardContent className="p-0">
        <div className="flex flex-wrap items-center gap-3 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{t("routingCost.title")}</span>
            <Badge variant="outline" title={data?.name && data.name !== DEFAULT_ROUTE_NAME ? data.name : undefined}>
              {routeNameLabel(data?.name, t, localName)}
            </Badge>
            {data && (
              <span className="text-xs text-muted-foreground">
                {t("routingCost.rate")
                  .replace("{rate}", `$${Number(data.perMinuteCost).toFixed(4)}`)
                  .replace("{fee}", money(data.monthlyFee))}
                {" · "}
                {t(`owner.costs.rounding.${data.billingIncrement ?? 1}`)}
              </span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Sir, 23 Oct: Today, then Yesterday, then Week, then Month, then the dates. */}
            <PeriodPicker
              preset={preset}
              range={range}
              onChange={(p, r) => {
                setPreset(p);
                setRange(r);
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setForm({
                  perMinuteCost: data?.perMinuteCost ?? "",
                  monthlyFee: data?.monthlyFee ?? "",
                  billingIncrement: data?.billingIncrement ?? 1,
                });
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> {t("routingCost.editRate")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-3 lg:grid-cols-6">
          {tile(t("routingCost.forwarded"), (totals?.forwarded ?? 0).toLocaleString("en-US"))}
          {tile(t("routingCost.connected"), (totals?.connected ?? 0).toLocaleString("en-US"))}
          {tile(t("routingCost.minutes"), Number(totals?.minutes ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 }))}
          {tile(t("routingCost.aht"), formatTimer(totals?.ahtSeconds ?? 0))}
          {tile(t("routingCost.perCall"), `$${Number(totals?.costPerCall ?? 0).toFixed(4)}`)}
          {tile(t("routingCost.cost"), money(totals?.costExact), true)}
        </div>
        <p className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">
          {t("routingCost.howCounted")
            .replace("{minutes}", Number(totals?.minutes ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2 }))
            .replace("{rate}", `$${Number(data?.perMinuteCost ?? 0).toFixed(4)}`)
            .replace("{cost}", money(totals?.costExact))}
        </p>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-center">{t("routingCost.col.date")}</TableHead>
              <TableHead className="text-center">{t("routingCost.forwarded")}</TableHead>
              <TableHead className="text-center">{t("routingCost.connected")}</TableHead>
              <TableHead className="text-center">{t("routingCost.minutes")}</TableHead>
              <TableHead className="text-center">{t("routingCost.aht")}</TableHead>
              <TableHead className="text-center">{t("routingCost.perCall")}</TableHead>
              <TableHead className="text-center">{t("routingCost.cost")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {(data?.days ?? []).map((d) => (
              <TableRow key={d.date}>
                <TableCell className="text-center">{dayLabel(d.date)}</TableCell>
                <TableCell className="text-center tabular-nums">{d.forwarded}</TableCell>
                <TableCell className="text-center tabular-nums">{d.connected}</TableCell>
                <TableCell className="text-center tabular-nums">{d.minutes}</TableCell>
                <TableCell className="text-center font-mono tabular-nums">{formatTimer(d.ahtSeconds ?? 0)}</TableCell>
                <TableCell className="text-center tabular-nums">${Number(d.costPerCall ?? 0).toFixed(4)}</TableCell>
                <TableCell className="text-center font-semibold tabular-nums">{money(d.costExact)}</TableCell>
              </TableRow>
            ))}
            {!loading && (data?.days.length ?? 0) === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={7} className="py-6 text-center text-sm text-muted-foreground">
                  {t("routingCost.empty")}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>{t("routingCost.editTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="routing-rate">{t("routingCost.perMinute")}</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                <Input
                  id="routing-rate"
                  inputMode="decimal"
                  className="pl-7"
                  value={form.perMinuteCost}
                  onChange={(e) => setForm((f) => ({ ...f, perMinuteCost: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="routing-fee">{t("routingCost.monthlyFee")}</Label>
              <div className="relative">
                <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
                <Input
                  id="routing-fee"
                  inputMode="decimal"
                  className="pl-7"
                  value={form.monthlyFee}
                  onChange={(e) => setForm((f) => ({ ...f, monthlyFee: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="routing-increment">{t("owner.costs.form.rounding")}</Label>
              <select
                id="routing-increment"
                value={form.billingIncrement}
                onChange={(e) => setForm((f) => ({ ...f, billingIncrement: Number(e.target.value) }))}
                className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm"
              >
                {INCREMENTS.map((i) => (
                  <option key={i} value={i}>
                    {t(`owner.costs.form.rounding.${i}`)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">{t("owner.costs.form.roundingHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(false)} disabled={busy}>
              {t("routingCost.cancel")}
            </Button>
            <Button onClick={() => void saveRate()} disabled={busy}>
              {t("routingCost.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

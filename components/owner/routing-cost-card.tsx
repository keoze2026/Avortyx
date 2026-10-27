"use client";

/**
 * Owner > Carrier Costs: routing cost (CH-186).
 *
 * What the termination carrier (XOLO) charges to route our calls on to
 * buyers: every connected second of every call we forwarded, at the
 * per-minute rate, per Eastern day. Sir, 21 Oct: "set routing cost so we can
 * see how much cost from yesterday". Exact seconds, so it is an estimate to
 * check the carrier's invoice against. Backend: /api/owner/routing-cost.
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
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { uiLocaleTag } from "@/lib/format";
import { useLocalName } from "@/lib/i18n/local-name";
import { cn } from "@/lib/utils";

interface Day {
  date: string;
  forwarded: number;
  connected: number;
  seconds: number;
  minutes: string;
  cost: string;
  costExact: string;
}

interface RoutingCost {
  name: string;
  perMinuteCost: string;
  monthlyFee: string;
  start: string;
  end: string;
  days: Day[];
  totals: { forwarded: number; connected: number; seconds: number; minutes: string; cost: string; costExact: string };
}

type Preset = "today" | "yesterday" | "week" | "month" | "custom";

/** Today's date in Eastern time, YYYY-MM-DD (the days the backend counts in). */
function easternToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date());
}

function shiftDay(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rangeFor(preset: Exclude<Preset, "custom">): { start: string; end: string } {
  const today = easternToday();
  if (preset === "today") return { start: today, end: today };
  if (preset === "yesterday") {
    const y = shiftDay(today, -1);
    return { start: y, end: y };
  }
  if (preset === "week") {
    // This week, Monday to today (EST).
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay(); // 0 = Sunday
    return { start: shiftDay(today, -((weekday + 6) % 7)), end: today };
  }
  return { start: `${today.slice(0, 8)}01`, end: today };
}

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
  const [form, setForm] = useState({ perMinuteCost: "", monthlyFee: "" });
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

  const pick = (p: Exclude<Preset, "custom">) => {
    setPreset(p);
    setRange(rangeFor(p));
  };

  async function saveRate() {
    setBusy(true);
    try {
      await http.patch("/api/owner/routing-cost/rate", {
        body: { perMinuteCost: form.perMinuteCost || "0", monthlyFee: form.monthlyFee || "0" },
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
              </span>
            )}
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {/* Sir, 23 Oct: Today, then Yesterday, then Week, then Month, then the dates. */}
            {(["today", "yesterday", "week", "month"] as const).map((p) => (
              <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} onClick={() => pick(p)}>
                {t(`routingCost.preset.${p}`)}
              </Button>
            ))}
            <Input
              type="date"
              aria-label={t("routingCost.from")}
              className="h-8 w-[9.5rem]"
              value={range.start}
              max={easternToday()}
              onChange={(e) => {
                if (!e.target.value) return;
                setPreset("custom");
                setRange((r) => ({ start: e.target.value, end: r.end < e.target.value ? e.target.value : r.end }));
              }}
            />
            <Input
              type="date"
              aria-label={t("routingCost.to")}
              className="h-8 w-[9.5rem]"
              value={range.end}
              min={range.start}
              max={easternToday()}
              onChange={(e) => {
                if (!e.target.value) return;
                setPreset("custom");
                setRange((r) => ({ ...r, end: e.target.value }));
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setForm({ perMinuteCost: data?.perMinuteCost ?? "", monthlyFee: data?.monthlyFee ?? "" });
                setEditing(true);
              }}
            >
              <Pencil className="h-3.5 w-3.5" /> {t("routingCost.editRate")}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 border-t border-border sm:grid-cols-4">
          {tile(t("routingCost.forwarded"), String(totals?.forwarded ?? 0))}
          {tile(t("routingCost.connected"), String(totals?.connected ?? 0))}
          {tile(t("routingCost.minutes"), totals?.minutes ?? "0.00")}
          {tile(t("routingCost.cost"), money(totals?.costExact), true)}
        </div>
        <p className="border-t border-border px-5 py-2 text-[11px] text-muted-foreground">{t("routingCost.note")}</p>

        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-center">{t("routingCost.col.date")}</TableHead>
              <TableHead className="text-center">{t("routingCost.forwarded")}</TableHead>
              <TableHead className="text-center">{t("routingCost.connected")}</TableHead>
              <TableHead className="text-center">{t("routingCost.minutes")}</TableHead>
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
                <TableCell className="text-center font-semibold tabular-nums">{money(d.costExact)}</TableCell>
              </TableRow>
            ))}
            {!loading && (data?.days.length ?? 0) === 0 && (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
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

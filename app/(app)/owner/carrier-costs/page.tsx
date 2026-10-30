"use client";

/**
 * Owner > Carrier Costs (CH-154).
 *
 * What each carrier charges US, next to what our numbers actually did, so the
 * owner can check a carrier's invoice for anything extra. One group per
 * carrier: its rate card, every TFN with calls, TCL, AHT and cost, and the
 * month's bill. TFNs a workspace deleted stay listed here (greyed, with the
 * date) even though the workspace no longer sees them. System owner only.
 * Backend: /api/owner/carrier-costs (phone_numbers/owner_costs.py).
 *
 * CH-334: the company profit is its own card (components/owner/
 * company-profit-card.tsx) with Today / Yesterday / Week / Month / dates.
 *
 * CH-433 (Sir's design, 30 Oct): the carriers are statements now - each
 * carrier with its TFN codes, termination, monthly charges and TFN list, then
 * merged (components/owner/carrier-statements.tsx). The profit, expenses and
 * routing cards stay below; TFNs with no carrier are listed at the end.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { ShieldX } from "lucide-react";
import { toast } from "sonner";

import { CarrierStatements, type StatementCode } from "@/components/owner/carrier-statements";
import { ExpensesCard } from "@/components/owner/expenses-card";
import { RoutingCostCard } from "@/components/owner/routing-cost-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http, ApiError } from "@/lib/api/http";
import { formatLocalDate, formatTimer } from "@/lib/format";
import { tFor } from "@/lib/i18n";
import { useLocalName } from "@/lib/i18n/local-name";
import { useAuthStore } from "@/lib/store/auth-store";
import { useLocaleStore } from "@/lib/store/locale-store";

// The http layer turns snake_case into camelCase on the way in.
interface NumberRow {
  id: string;
  number: string;
  deleted: boolean;
  addedAt: string;
  deletedAt: string | null;
  campaign: string;
  calls: number;
  connected: number;
  tclSeconds: number;
  billedSeconds: number;
  ahtSeconds: number;
  numberFee: string;
  minuteCost: string;
  total: string;
}

interface Totals {
  numbers: number;
  live: number;
  deleted: number;
  calls: number;
  connected: number;
  tclSeconds: number;
  billedSeconds: number;
  ahtSeconds: number;
  numberFees: string;
  portalFee: string;
  minuteCharges: string;
  monthlyBill: string;
}

interface CarrierGroup {
  id: string;
  organizationId: string;
  organizationName: string;
  name: string;
  code: string;
  risk: string;
  isActive: boolean;
  numberMonthlyCost: string;
  portalMonthlyFee: string;
  perMinuteCost: string;
  /** How the carrier rounds each call: 1, 6, 30 or 60 seconds (CH-254). */
  billingIncrement: number;
  numbers: NumberRow[];
  totals: Totals;
}

/** The whole month's bill: TFN carriers plus routing on to buyers (CH-254). */
interface Summary {
  numberFees: string;
  portalFees: string;
  minuteCharges: string;
  carriersTotal: string;
  routingMinutes: string;
  routingMonthlyFee: string;
  routingTotal: string;
  grandTotal: string;
}

/** Company profit before tax (CH-257): customer charges - carrier costs. */
interface Profit {
  calls: string;
  rejected: string;
  voip: string;
  portal: string;
  tfn: string;
  other: string;
  refunds: string;
  income: string;
  customers: number;
  carrierCosts: string;
  profit: string;
}

interface Warning {
  kind: "no_minute_rate" | "no_number_fee" | "no_carrier";
  carrier?: string;
  code?: string;
  calls?: number;
  numbers?: number;
}

interface CostsResponse {
  month: string;
  carriers: CarrierGroup[];
  grandTotal: string;
  unassigned: { numbers: NumberRow[]; totals: Totals };
  routing?: { name: string };
  summary?: Summary;
  warnings?: Warning[];
  profit?: Profit;
}

/** The carrier whose rates are being edited (from a statement's code row). */
interface EditTarget {
  id: string;
  name: string;
  numberMonthlyCost: string;
  portalMonthlyFee: string;
  perMinuteCost: string;
  billingIncrement: number;
}

const INCREMENTS = [1, 6, 30, 60] as const;

/** Quick fills for the carriers Sir named; the owner can still type any value. */
const PRESETS: { key: string; label: string; labelKey: string; numberMonthlyCost: string; portalMonthlyFee: string; perMinuteCost: string }[] = [
  { key: "xolo-high", label: "Xolo IP high risk", labelKey: "x1.carrierCosts.preset.xoloHigh", numberMonthlyCost: "15", portalMonthlyFee: "350", perMinuteCost: "0.40" },
  { key: "xolo-fwd", label: "Xolo IP forwarding TFN", labelKey: "x1.carrierCosts.preset.xoloForwarding", numberMonthlyCost: "5", portalMonthlyFee: "0", perMinuteCost: "0.15" },
  { key: "freedom", label: "Freedom high risk", labelKey: "x1.carrierCosts.preset.freedomHigh", numberMonthlyCost: "5", portalMonthlyFee: "0", perMinuteCost: "0.04" },
];

function money(v: string | number | null | undefined): string {
  const n = Number(v ?? 0);
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string | null): string {
  if (!iso) return "";
  return formatLocalDate(iso, { month: "short", day: "numeric", year: "numeric" });
}

/** This month in Eastern time, as the backend counts it (CH-254). */
function thisMonth(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit" })
    .format(new Date())
    .slice(0, 7);
}

function errText(e: unknown): string {
  return e instanceof ApiError ? e.message : tFor(useLocaleStore.getState().locale, "x1.carrierCosts.genericError");
}

function NumbersTable({
  rows,
  selectable,
  selected,
  onToggle,
}: {
  rows: NumberRow[];
  selectable?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          {/* Every column centred, values under their heading (Sir, 21 Oct, CH-186). */}
          {selectable && <TableHead className="w-10" />}
          <TableHead className="text-center">{t("owner.costs.col.tfn")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.status")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.calls")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.connected")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.tcl")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.aht")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.numberFee")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.minuteCost")}</TableHead>
          <TableHead className="text-center">{t("owner.costs.col.total")}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((n) => (
          <TableRow key={n.id} className={n.deleted ? "opacity-60" : ""}>
            {selectable && (
              <TableCell>
                <Checkbox checked={selected?.has(n.id) ?? false} onCheckedChange={() => onToggle?.(n.id)} />
              </TableCell>
            )}
            <TableCell className="text-center font-mono text-sm">{n.number}</TableCell>
            <TableCell className="text-center">
              {n.deleted ? (
                <span className="inline-flex items-center justify-center gap-1.5">
                  <Badge variant="destructive">{t("owner.costs.deleted")}</Badge>
                  <span className="text-xs text-muted-foreground">{shortDate(n.deletedAt)}</span>
                </span>
              ) : (
                <Badge variant="secondary">{t("owner.costs.live")}</Badge>
              )}
            </TableCell>
            <TableCell className="text-center tabular-nums">{n.calls}</TableCell>
            <TableCell className="text-center tabular-nums">{n.connected}</TableCell>
            <TableCell className="text-center font-mono tabular-nums">{formatTimer(n.tclSeconds)}</TableCell>
            <TableCell className="text-center font-mono tabular-nums">{formatTimer(n.ahtSeconds)}</TableCell>
            <TableCell className="text-center tabular-nums">{money(n.numberFee)}</TableCell>
            <TableCell className="text-center tabular-nums">{money(n.minuteCost)}</TableCell>
            <TableCell className="text-center font-semibold tabular-nums">{money(n.total)}</TableCell>
          </TableRow>
        ))}
        {rows.length === 0 && (
          <TableRow className="hover:bg-transparent">
            <TableCell colSpan={selectable ? 10 : 9} className="py-6 text-center text-sm text-muted-foreground">
              {t("owner.costs.noNumbers")}
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}

export default function CarrierCostsPage() {
  const { t } = useTranslation();
  const localName = useLocalName();
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);

  const [month] = useState(thisMonth());
  const [data, setData] = useState<CostsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [form, setForm] = useState({ numberMonthlyCost: "", portalMonthlyFee: "", perMinuteCost: "" });
  const [increment, setIncrement] = useState(1);
  const [busy, setBusy] = useState(false);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [assignTo, setAssignTo] = useState("");

  const load = useCallback(async (m: string) => {
    setLoading(true);
    try {
      setData(await http.get<CostsResponse>(`/api/owner/carrier-costs?month=${encodeURIComponent(m)}`));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isSuperuser) load(month);
  }, [isSuperuser, month, load]);

  const carriers = data?.carriers ?? [];
  const unassigned = data?.unassigned.numbers ?? [];
  const assignable = useMemo(() => carriers, [carriers]);

  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{t("owner.notYours.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("owner.notYours.body")}</p>
      </div>
    );
  }

  const openEdit = (c: StatementCode) => {
    setEditing({
      id: c.carrierId,
      name: `${c.name} (${c.code})`,
      numberMonthlyCost: c.numberMonthlyCost,
      portalMonthlyFee: c.portalMonthlyFee,
      perMinuteCost: c.perMinuteCost,
      billingIncrement: c.billingIncrement,
    });
    setForm({
      numberMonthlyCost: c.numberMonthlyCost,
      portalMonthlyFee: c.portalMonthlyFee,
      perMinuteCost: c.perMinuteCost,
    });
    setIncrement(c.billingIncrement ?? 1);
  };

  async function saveRates() {
    if (!editing) return;
    setBusy(true);
    try {
      await http.patch(`/api/owner/carriers/${editing.id}/costs`, {
        body: {
          number_monthly_cost: form.numberMonthlyCost || "0",
          portal_monthly_fee: form.portalMonthlyFee || "0",
          per_minute_cost: form.perMinuteCost || "0",
          billing_increment: increment,
        },
      });
      toast.success(t("owner.costs.saved"));
      setEditing(null);
      setRefreshKey((k) => k + 1);
      load(month);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  async function assign() {
    if (!assignTo || picked.size === 0) return;
    setBusy(true);
    try {
      const r = await http.post<{ updated: number; skipped: number }>("/api/owner/carrier-costs/assign", {
        body: { carrier_id: assignTo, numbers: Array.from(picked) },
      });
      toast.success(t("owner.costs.assigned").replace("{count}", String(r.updated)));
      setPicked(new Set());
      setRefreshKey((k) => k + 1);
      load(month);
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const field = (key: keyof typeof form, label: string, hint: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`rate-${key}`}>{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-2 text-sm text-muted-foreground">$</span>
        <Input
          id={`rate-${key}`}
          inputMode="decimal"
          className="pl-7"
          value={form[key]}
          onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6">
      {/* CH-433: Sir's statements - Today / Yesterday / This week / This month / dates. */}
      <CarrierStatements onEditRates={openEdit} refreshKey={refreshKey} />

      <div className="print:hidden space-y-6">
        {/* The day's expenses line by line (CH-336) and routing on to buyers
            by day (CH-186). Company profit has its own page (CH-434). */}
        <ExpensesCard />
        <RoutingCostCard />
      </div>

      {unassigned.length > 0 && (
        <Card className="print:hidden">
          <CardContent className="p-0">
            <div className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className="text-base font-semibold">{t("owner.costs.unassigned")}</span>
              <span className="text-xs text-muted-foreground">{t("owner.costs.unassignedHint")}</span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  value={assignTo}
                  onChange={(e) => setAssignTo(e.target.value)}
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm"
                  aria-label={t("owner.costs.assignTo")}
                >
                  <option value="">{t("owner.costs.assignTo")}</option>
                  {assignable.map((c) => (
                    <option key={c.id} value={c.id}>
                      {localName(c.name)} ({c.code}) - {localName(c.organizationName)}
                    </option>
                  ))}
                </select>
                <Button size="sm" className="h-8" disabled={busy || !assignTo || picked.size === 0} onClick={assign}>
                  {t("owner.costs.assign").replace("{count}", String(picked.size))}
                </Button>
              </div>
            </div>
            <div className="overflow-x-auto border-t border-border">
              <NumbersTable
                rows={unassigned}
                selectable
                selected={picked}
                onToggle={(id) =>
                  setPicked((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  })
                }
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {t("owner.costs.editRates")}: {editing?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <Button
                  key={p.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    setForm({
                      numberMonthlyCost: p.numberMonthlyCost,
                      portalMonthlyFee: p.portalMonthlyFee,
                      perMinuteCost: p.perMinuteCost,
                    })
                  }
                >
                  {p.labelKey ? t(p.labelKey) : p.label}
                </Button>
              ))}
            </div>
            {field("numberMonthlyCost", t("owner.costs.form.numberFee"), t("owner.costs.form.numberFeeHint"))}
            {field("portalMonthlyFee", t("owner.costs.form.portal"), t("owner.costs.form.portalHint"))}
            {field("perMinuteCost", t("owner.costs.form.perMinute"), t("owner.costs.form.perMinuteHint"))}
            <div className="space-y-1.5">
              <Label htmlFor="rate-increment">{t("owner.costs.form.rounding")}</Label>
              <select
                id="rate-increment"
                value={increment}
                onChange={(e) => setIncrement(Number(e.target.value))}
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
            <Button variant="ghost" onClick={() => setEditing(null)}>
              {t("owner.costs.cancel")}
            </Button>
            <Button onClick={saveRates} disabled={busy}>
              {t("owner.costs.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

"use client";

/**
 * Owner > Carrier Costs as statements (CH-433, Sir's design, 30 Oct).
 *
 * Each carrier (XOLO, Freedom ...) as a statement you can send: its TFN codes
 * with TFNs, TFN fees, calls, TCL, minutes, ACL and minute cost, the monthly
 * charges and the total, its TFN list - then the carriers merged. Today,
 * Yesterday, This week, This month or any dates (Eastern days). Every figure
 * is the server's (GET /api/owner/carrier-statement); how each one is counted
 * is written at the top of phone_numbers/carrier_statement.py.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, ChevronDown, ChevronRight, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

import { DatePicker } from "@/components/shared/date-picker";
import { easternToday } from "@/components/owner/period-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { downloadRows, type ExportColumn } from "@/lib/export";
import { formatTimer, uiLocaleTag } from "@/lib/format";
import { cn } from "@/lib/utils";

/* ─── Wire (camelCase from the http layer) ─────────────────────────── */

export interface StatementCode {
  kind: "tfn";
  carrierId: string;
  code: string;
  name: string;
  risk: string;
  tfns: number;
  live: number;
  deleted: number;
  tfnRate: string;
  numberMonthlyCost: string;
  portalMonthlyFee: string;
  tfnFees: string;
  calls: number;
  connected: number;
  tclSeconds: number;
  billedSeconds: number;
  minutes: string;
  aclSeconds: number;
  perMinuteCost: string;
  billingIncrement: number;
  minuteCost: string;
  total: string;
}

interface Termination {
  kind: "termination";
  name: string;
  calls: number;
  connected: number;
  tclSeconds: number;
  billedSeconds: number;
  minutes: string;
  aclSeconds: number;
  perMinuteCost: string;
  billingIncrement: number;
  minuteCost: string;
  total: string;
}

interface MonthlyRow {
  kind: "monthly";
  carrierId?: string;
  code: string;
  risk: string;
  feeMonth: string;
  amount: string;
}

interface TfnRow {
  id: string;
  number: string;
  code: string;
  deleted: boolean;
  addedAt: string;
  deletedAt: string | null;
  rate: string;
  billed: string;
}

interface Company {
  name: string;
  codes: StatementCode[];
  termination: Termination | null;
  monthly: MonthlyRow[];
  numbers: TfnRow[];
  totals: {
    tfns: number;
    live: number;
    deleted: number;
    tfnFees: string;
    minutes: string;
    minuteCost: string;
    monthly: string;
    total: string;
  };
}

interface Statement {
  start: string;
  end: string;
  days: number;
  monthShare: string;
  monthDays: number | null;
  wholeMonth: boolean;
  carriers: Company[];
  total: string;
  tfns: { total: number; live: number; deleted: number };
  warnings: Array<{ kind: "no_minute_rate" | "no_number_fee" | "no_carrier"; code?: string; calls?: number; numbers?: number }>;
}

interface CdrRow {
  callId: string;
  time: string;
  caller: string;
  tfn: string;
  carrier: string;
  code: string;
  status: string;
  retry: boolean;
  duration: number;
  billedSeconds: number;
  cost: string;
  destination: string;
  terminationSeconds: number;
  terminationCost: string;
}

/* ─── Periods ──────────────────────────────────────────────────────── */

type Preset = "today" | "yesterday" | "week" | "month" | "custom";
type Range = { start: string; end: string };

function shift(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function rangeOf(p: Exclude<Preset, "custom">): Range {
  const today = easternToday();
  if (p === "today") return { start: today, end: today };
  if (p === "yesterday") return { start: shift(today, -1), end: shift(today, -1) };
  if (p === "week") {
    const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
    return { start: shift(today, -((weekday + 6) % 7)), end: today };
  }
  // The whole calendar month: a carrier bills its monthly fees for all of it.
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${today.slice(0, 8)}01`, end: `${today.slice(0, 8)}${String(last).padStart(2, "0")}` };
}

function dayDate(iso: string) {
  return new Date(`${iso}T12:00:00Z`);
}

function rangeLabel(r: Range): string {
  const tag = uiLocaleTag();
  const a = dayDate(r.start);
  const b = dayDate(r.end);
  if (r.start === r.end) return a.toLocaleDateString(tag, { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
  try {
    return new Intl.DateTimeFormat(tag, { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).formatRange(a, b);
  } catch {
    return `${r.start} – ${r.end}`;
  }
}

/* ─── Formatting ───────────────────────────────────────────────────── */

const money = (v: string | number | null | undefined) =>
  `$${Number(v ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const rate4 = (v: string | number) => `$${Number(v).toFixed(4)}`;
const mins = (v: string | number) =>
  Number(v).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = (v: number) => v.toLocaleString("en-US");
const pct = (part: string | number, whole: string | number) => {
  const w = Number(whole);
  return w > 0 ? `${((Number(part) / w) * 100).toFixed(1)}%` : "0.0%";
};
function us(n: string) {
  const d = n.replace(/\D/g, "").slice(-10);
  return d.length === 10 ? `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}` : n;
}
function shortDay(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(uiLocaleTag(), { month: "short", day: "numeric", timeZone: "America/New_York" });
}

/* ─── Component ────────────────────────────────────────────────────── */

export function CarrierStatements({ onEditRates, refreshKey = 0 }: { onEditRates?: (c: StatementCode) => void; refreshKey?: number }) {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<Range>(() => rangeOf("today"));
  const [data, setData] = useState<Statement | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      setData(await http.get<Statement>("/api/owner/carrier-statement", { query: { start: r.start, end: r.end } }));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range, refreshKey]);

  const pick = (p: Exclude<Preset, "custom">) => {
    setPreset(p);
    setRange(rangeOf(p));
  };

  const exportCdrs = async () => {
    setExporting(true);
    try {
      const res = await http.get<{ rows: CdrRow[]; truncated: boolean }>("/api/owner/carrier-statement/cdrs", {
        query: { start: range.start, end: range.end },
      });
      const cols: ExportColumn<CdrRow>[] = [
        { label: "Time (ET)", value: (r) => r.time },
        { label: "Call ID", value: (r) => r.callId },
        { label: "Caller", value: (r) => r.caller },
        { label: "TFN", value: (r) => r.tfn },
        { label: "Carrier", value: (r) => r.carrier },
        { label: "Code", value: (r) => r.code },
        { label: "Status", value: (r) => r.status },
        { label: "Retry", value: (r) => (r.retry ? "yes" : "") },
        { label: "Duration (s)", value: (r) => r.duration },
        { label: "Billed (s)", value: (r) => r.billedSeconds },
        { label: "Cost", value: (r) => r.cost },
        { label: "Forwarded to", value: (r) => r.destination },
        { label: "Termination billed (s)", value: (r) => r.terminationSeconds },
        { label: "Termination cost", value: (r) => r.terminationCost },
      ];
      downloadRows("csv", cols, res.rows, `carrier-cdrs-${range.start}_${range.end}`, "Carrier CDRs");
      toast.success(t("x433.cdrsDone").replace("{n}", int(res.rows.length)));
      if (res.truncated) toast.message(t("x433.cdrsTruncated"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const label = rangeLabel(range);
  const today = easternToday();
  // "Billed today" on a single day, "Billed" for any other period.
  const billedHead =
    range.start === range.end && range.start === today
      ? t("x433.billedToday")
      : preset === "month"
        ? t("x433.billedMonth")
        : t("x433.billed");

  return (
    <div className="carrier-statements space-y-4">
      {/* Paper copies: the statements only, dark text on white (Audit PDF). */}
      <style>{`@media print {
        [data-slot="sidebar"], [data-slot="sidebar-gap"], header, .print-hide { display: none !important; }
        body, .carrier-statements, .carrier-statements * { color: #111 !important; background: transparent !important; border-color: #d4d4d8 !important; box-shadow: none !important; }
        .carrier-statements section { break-inside: avoid; }
      }`}</style>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("owner.costs.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("x433.subtitle")}</p>
        </div>
        <div className="print-hide flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5" role="tablist">
            {(["today", "yesterday", "week", "month"] as const).map((p) => (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={preset === p}
                onClick={() => pick(p)}
                className={cn(
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  preset === p ? "bg-accent/15 text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {t(`x433.preset.${p}`)}
              </button>
            ))}
          </div>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                <CalendarDays className="h-3.5 w-3.5" /> {label}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto space-y-2 p-3">
              <div className="text-xs font-medium">{t("x433.pickDates")}</div>
              <div className="flex items-center gap-2">
                <DatePicker
                  aria-label={t("routingCost.from")}
                  value={range.start}
                  max={today}
                  today={today}
                  onChange={(start) => {
                    setPreset("custom");
                    setRange((r) => ({ start, end: r.end < start ? start : r.end }));
                  }}
                />
                <span className="text-muted-foreground">–</span>
                <DatePicker
                  aria-label={t("routingCost.to")}
                  value={range.end}
                  min={range.start}
                  today={today}
                  onChange={(end) => {
                    setPreset("custom");
                    setRange((r) => ({ ...r, end }));
                  }}
                />
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => void exportCdrs()} disabled={exporting}>
            {t("x433.exportCdrs")}
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => window.print()} disabled={!data}>
            {t("x433.auditPdf")}
          </Button>
        </div>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">{t("owner.costs.loading")}</p>}

      {data && (
        <>
          {/* Total, each carrier, TFNs */}
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
            <Kpi label={t("x433.totalCost")} value={money(data.total)} foot={label} />
            {data.carriers.slice(0, 2).map((c) => (
              <Kpi
                key={c.name}
                label={c.name}
                value={money(c.totals.total)}
                foot={t("x433.ofCost").replace(
                  "{pct}",
                  `${Number(data.total) > 0 ? Math.round((Number(c.totals.total) / Number(data.total)) * 100) : 0}%`,
                )}
              />
            ))}
            <Kpi
              label={t("x433.tfns")}
              value={int(data.tfns.total)}
              foot={t("x433.liveDeleted").replace("{live}", int(data.tfns.live)).replace("{deleted}", int(data.tfns.deleted))}
            />
          </div>

          {data.warnings.length > 0 && (
            <div className="space-y-1.5 rounded-md border border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 px-4 py-3 text-sm">
              {data.warnings.map((w, i) => (
                <div key={i} className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--warning)]" />
                  <span>
                    {t(`x433.warn.${w.kind}`)
                      .replace("{code}", w.code ?? "")
                      .replace("{calls}", int(w.calls ?? 0))
                      .replace("{numbers}", int(w.numbers ?? 0))}
                  </span>
                </div>
              ))}
            </div>
          )}

          {data.carriers.map((c) => (
            <CompanyStatement key={c.name} company={c} data={data} label={label} billedHead={billedHead} onEditRates={onEditRates} />
          ))}

          {data.carriers.length > 1 && <Merged data={data} label={label} />}
          {data.carriers.length === 0 && <p className="text-sm text-muted-foreground">{t("owner.costs.none")}</p>}
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, foot }: { label: string; value: string; foot: string }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-[2.6rem] justify-center rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase">
      {children}
    </span>
  );
}

function Sub({ children }: { children: React.ReactNode }) {
  return <div className="font-mono text-[10px] leading-tight text-muted-foreground/70">{children}</div>;
}

const NA = () => <span className="text-muted-foreground/50">—</span>;

/** "÷ 31", "× 7/31", or nothing for a whole month. */
function shareText(data: Statement) {
  if (data.wholeMonth) return "";
  if (data.monthDays && data.days === 1) return ` ÷ ${data.monthDays}`;
  if (data.monthDays) return ` × ${data.days}/${data.monthDays}`;
  return ` × ${Number(data.monthShare).toFixed(4)}`;
}

function CompanyStatement({
  company: c,
  data,
  label,
  billedHead,
  onEditRates,
}: {
  company: Company;
  data: Statement;
  label: string;
  billedHead: string;
  onEditRates?: (c: StatementCode) => void;
}) {
  const { t } = useTranslation();
  const share = shareText(data);
  const riskWord = (risk: string) => (risk === "high" ? t("x433.highRisk") : risk === "low" ? t("x433.lowRisk") : t("x433.standard"));

  // The rate line: codes with the same type and prices together.
  const rateLine = useMemo(() => {
    const groups = new Map<string, { risk: string; codes: string[]; tfn: string; min: string }>();
    for (const x of c.codes) {
      const tfn = x.tfnRate || x.numberMonthlyCost;
      const key = `${x.risk}|${tfn}|${x.perMinuteCost}`;
      const g = groups.get(key) ?? { risk: x.risk, codes: [], tfn, min: x.perMinuteCost };
      g.codes.push(x.code);
      groups.set(key, g);
    }
    const parts = [...groups.values()].map(
      (g) => `${riskWord(g.risk)} ${g.codes.join(", ")} ${money(g.tfn).replace(/\.00$/, "")}/TFN · $${Number(g.min).toString()}/min`,
    );
    if (c.termination) parts.push(`${t("x433.termination")} $${Number(c.termination.perMinuteCost).toString()}/min`);
    const monthly = c.monthly.map((m) => `${m.code === "termination" ? t("x433.termination") : m.code} ${money(m.feeMonth).replace(/\.00$/, "")}`);
    return parts.join(" — ") + (monthly.length ? ` · ${t("x433.monthly")}: ${monthly.join(", ")}` : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, t]);

  // How the minutes were billed, in words.
  const roundingNote = useMemo(() => {
    const incs = new Map<number, string[]>();
    for (const x of c.codes) incs.set(x.billingIncrement, [...(incs.get(x.billingIncrement) ?? []), x.code]);
    if (c.termination) incs.set(c.termination.billingIncrement, [...(incs.get(c.termination.billingIncrement) ?? []), t("x433.termination")]);
    if (incs.size <= 1) {
      const inc = [...incs.keys()][0] ?? 1;
      return inc <= 1 ? t("x433.exactSecond") : t("x433.roundedTo").replace("{n}", String(inc));
    }
    return [...incs.entries()]
      .map(([inc, codes]) => `${codes.join(", ")}: ${inc <= 1 ? t("x433.exactSecond") : t("x433.roundedTo").replace("{n}", String(inc))}`)
      .join("; ");
  }, [c, t]);

  const head = "h-8 px-3 text-[11px] font-medium text-muted-foreground";
  const cell = "px-3 py-2.5 align-top tabular-nums";

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div className="min-w-0">
          <h2 className="text-base font-semibold">{c.name}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{rateLine}</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{money(c.totals.total)}</div>
        </div>
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[980px] text-[13px]">
          <thead>
            <tr className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60">
              <th colSpan={2} />
              <th colSpan={2} className="border-b border-border/60 pb-1 text-center">{t("x433.groupTfns")}</th>
              <th colSpan={4} className="border-b border-border/60 pb-1 text-center">{t("x433.groupUsage")}</th>
              <th colSpan={3} className="border-b border-border/60 pb-1 text-center">{t("x433.groupCharges")}</th>
            </tr>
            <tr className="border-b border-border">
              <th className={cn(head, "pl-5 text-left")}>{t("x433.code")}</th>
              <th className={cn(head, "text-left")}>{t("x433.type")}</th>
              <th className={cn(head, "text-right")}>{t("x433.tfns")}</th>
              <th className={cn(head, "text-right")}>{t("x433.tfnFees")}</th>
              <th className={cn(head, "text-right")}>{t("x433.calls")}</th>
              <th className={cn(head, "text-right")}>TCL</th>
              <th className={cn(head, "text-right")}>{t("x433.minutes")}</th>
              <th className={cn(head, "text-right")}>ACL</th>
              <th className={cn(head, "text-right")}>{t("x433.minutesCost")}</th>
              <th className={cn(head, "text-right")}>{t("x433.monthly")}</th>
              <th className={cn(head, "pr-5 text-right")}>{t("x433.total")}</th>
            </tr>
          </thead>
          <tbody>
            {c.codes.map((x) => (
              <tr key={x.code} className="border-b border-border/60">
                <td className={cn(cell, "pl-5")}>
                  <span className="inline-flex items-center gap-1.5">
                    <Chip>{x.code}</Chip>
                    {onEditRates && (
                      <button
                        type="button"
                        onClick={() => onEditRates(x)}
                        title={t("owner.costs.editRates")}
                        aria-label={t("owner.costs.editRates")}
                        className="print-hide rounded p-0.5 text-muted-foreground/60 hover:text-foreground"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                </td>
                <td className={cell}>{riskWord(x.risk)}</td>
                <td className={cn(cell, "text-right")}>
                  {x.deleted ? `${int(x.live)} + ${int(x.deleted)} ${t("x433.del")}` : int(x.tfns)}
                </td>
                <td className={cn(cell, "text-right")}>
                  {money(x.tfnFees)}
                  {x.tfnRate ? <Sub>{`${x.tfns} × ${money(x.tfnRate)}${share}`}</Sub> : <Sub>{t("x433.mixedRates")}</Sub>}
                </td>
                <td className={cn(cell, "text-right")}>{int(x.calls)}</td>
                <td className={cn(cell, "text-right font-mono")}>{formatTimer(x.tclSeconds)}</td>
                <td className={cn(cell, "text-right")}>{mins(x.minutes)}</td>
                <td className={cn(cell, "text-right font-mono")}>{formatTimer(x.aclSeconds)}</td>
                <td className={cn(cell, "text-right")}>
                  {money(x.minuteCost)}
                  <Sub>{`${mins(x.minutes)} × ${rate4(x.perMinuteCost)}`}</Sub>
                </td>
                <td className={cn(cell, "text-right")}><NA /></td>
                <td className={cn(cell, "pr-5 text-right font-semibold")}>{money(x.total)}</td>
              </tr>
            ))}
            {c.termination && (
              <tr className="border-b border-border/60">
                <td className={cn(cell, "pl-5")}><Chip>{c.name.slice(0, 4)}</Chip></td>
                <td className={cell}>{t("x433.termination")}</td>
                <td className={cn(cell, "text-right")}><NA /></td>
                <td className={cn(cell, "text-right")}><NA /></td>
                <td className={cn(cell, "text-right")}>{int(c.termination.calls)}</td>
                <td className={cn(cell, "text-right font-mono")}>{formatTimer(c.termination.tclSeconds)}</td>
                <td className={cn(cell, "text-right")}>{mins(c.termination.minutes)}</td>
                <td className={cn(cell, "text-right font-mono")}>{formatTimer(c.termination.aclSeconds)}</td>
                <td className={cn(cell, "text-right")}>
                  {money(c.termination.minuteCost)}
                  <Sub>{`${mins(c.termination.minutes)} × ${rate4(c.termination.perMinuteCost)}`}</Sub>
                </td>
                <td className={cn(cell, "text-right")}><NA /></td>
                <td className={cn(cell, "pr-5 text-right font-semibold")}>{money(c.termination.total)}</td>
              </tr>
            )}
            {c.monthly.map((m) => (
              <tr key={`m-${m.code}`} className="border-b border-border/60">
                <td className={cn(cell, "pl-5")}><Chip>{m.code === "termination" ? c.name.slice(0, 4) : m.code}</Chip></td>
                <td className={cell} colSpan={7}>
                  {m.code === "termination" ? t("x433.terminationMonthly") : t("x433.codeMonthly").replace("{type}", riskWord(m.risk))}
                  <span className="text-muted-foreground"> · {money(m.feeMonth)} / {t("x433.month")}</span>
                </td>
                <td className={cn(cell, "text-right")}><NA /></td>
                <td className={cn(cell, "text-right")}>
                  {money(m.amount)}
                  {share && <Sub>{`${money(m.feeMonth).replace(/\.00$/, "")}${share}`}</Sub>}
                </td>
                <td className={cn(cell, "pr-5 text-right font-semibold")}>{money(m.amount)}</td>
              </tr>
            ))}
            <tr className="bg-muted/30 font-semibold">
              <td className={cn(cell, "pl-5")} colSpan={3}>{t("x433.carrierTotal").replace("{name}", c.name)}</td>
              <td className={cn(cell, "text-right")}>{money(c.totals.tfnFees)}</td>
              <td className={cell} colSpan={2} />
              <td className={cn(cell, "text-right")}>{mins(c.totals.minutes)}</td>
              <td className={cell} />
              <td className={cn(cell, "text-right")}>{money(c.totals.minuteCost)}</td>
              <td className={cn(cell, "text-right")}>{money(c.totals.monthly)}</td>
              <td className={cn(cell, "pr-5 text-right")}>{money(c.totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="border-b border-border px-5 py-2 text-[11px] text-muted-foreground">
        {[
          t("x433.noteMinutes").replace("{rounding}", roundingNote),
          t("x433.noteAcl"),
          data.wholeMonth ? t("x433.noteWholeMonth") : data.monthDays ? t("x433.noteProrated").replace("{days}", String(data.monthDays)) : t("x433.noteProratedMonths"),
        ].join(" · ")}
      </p>

      <TfnList company={c} billedHead={billedHead} />
    </section>
  );
}

function TfnList({ company: c, billedHead }: { company: Company; billedHead: string }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const [tab, setTab] = useState<"all" | "live" | "deleted">("all");
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [all, setAll] = useState(false);

  const rows = useMemo(() => {
    const q = query.replace(/\D/g, "");
    return c.numbers.filter(
      (n) =>
        (tab === "all" || (tab === "deleted") === n.deleted) &&
        (!q || n.number.replace(/\D/g, "").includes(q) || n.code.toLowerCase().includes(query.trim().toLowerCase())),
    );
  }, [c.numbers, tab, query]);
  const shown = all ? rows : rows.slice(0, 5);
  const live = c.numbers.filter((n) => !n.deleted).length;

  const exportCsv = () => {
    const cols: ExportColumn<TfnRow>[] = [
      { label: "TFN", value: (r) => r.number },
      { label: "Code", value: (r) => r.code },
      { label: "Status", value: (r) => (r.deleted ? "Deleted" : "Live") },
      { label: "Added", value: (r) => r.addedAt.slice(0, 10) },
      { label: "Deleted", value: (r) => (r.deletedAt ? r.deletedAt.slice(0, 10) : "") },
      { label: "Rate / month", value: (r) => r.rate },
      { label: billedHead, value: (r) => r.billed },
    ];
    downloadRows("csv", cols, rows, `tfns-${c.name.toLowerCase()}`, `${c.name} TFNs`);
  };

  if (!c.numbers.length) return null;
  const head = "h-8 px-3 text-[11px] font-medium text-muted-foreground";
  const tabBtn = (id: "all" | "live" | "deleted", n: number) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      className={cn("rounded px-2 py-0.5", tab === id ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground")}
    >
      {t(`x433.list.${id}`)} <span className="text-muted-foreground">{n}</span>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 px-5 py-3">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1.5 text-xs font-semibold">
          {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />} {t("x433.tfnList")}
        </button>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5 text-[11px]">
          {tabBtn("all", c.numbers.length)}
          {tabBtn("live", live)}
          {tabBtn("deleted", c.numbers.length - live)}
        </div>
        <div className="print-hide ml-auto flex items-center gap-2">
          {searching ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              <Input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("x433.searchTfn")} className="h-7 w-44 pl-7 text-xs" />
            </div>
          ) : (
            <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => setSearching(true)}>{t("x433.searchTfn")}</Button>
          )}
          <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={exportCsv}>{t("x433.exportCsv")}</Button>
        </div>
      </div>
      {open && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-[13px]">
              <thead>
                <tr className="border-y border-border">
                  <th className={cn(head, "pl-5 text-left")}>TFN</th>
                  <th className={cn(head, "text-left")}>{t("x433.code")}</th>
                  <th className={cn(head, "text-left")}>{t("x433.status")}</th>
                  <th className={cn(head, "text-left")}>{t("x433.added")}</th>
                  <th className={cn(head, "text-left")}>{t("x433.deletedCol")}</th>
                  <th className={cn(head, "text-right")}>{t("x433.ratePerMonth")}</th>
                  <th className={cn(head, "pr-5 text-right")}>{billedHead}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((n) => (
                  <tr key={n.id} className="border-b border-border/50">
                    <td className="px-3 py-2 pl-5 font-mono tabular-nums">{us(n.number)}</td>
                    <td className="px-3 py-2"><Chip>{n.code}</Chip></td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[11px]",
                          n.deleted ? "bg-muted text-muted-foreground" : "bg-[color:var(--success)]/15 text-[color:var(--success)]",
                        )}
                      >
                        {n.deleted ? t("x433.statusDeleted") : t("x433.statusLive")}
                      </span>
                    </td>
                    <td className="px-3 py-2">{shortDay(n.addedAt)}</td>
                    <td className="px-3 py-2">{n.deletedAt ? shortDay(n.deletedAt) : <NA />}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{money(n.rate)}</td>
                    <td className="px-3 py-2 pr-5 text-right tabular-nums">{money(n.billed)}</td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={7} className="px-5 py-4 text-xs text-muted-foreground">{t("owner.costs.noNumbers")}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-2.5 text-[11px] text-muted-foreground">
            {t("x433.showing").replace("{n}", int(shown.length)).replace("{m}", int(rows.length))}
            {rows.length > 5 && (
              <>
                {" · "}
                <button type="button" className="print-hide text-accent hover:underline" onClick={() => setAll((a) => !a)}>
                  {all ? t("x433.showFewer") : t("x433.showAll").replace("{m}", int(rows.length))}
                </button>
              </>
            )}
            {" · "}
            {t("x433.deletedStay")}
          </p>
        </>
      )}
    </div>
  );
}

function Merged({ data, label }: { data: Statement; label: string }) {
  const { t } = useTranslation();
  const cs = data.carriers;
  const sum = (k: "tfnFees" | "minuteCost" | "monthly" | "total") => cs.reduce((s, c) => s + Number(c.totals[k]), 0);
  const lines: Array<{ label: string; key: "tfnFees" | "minuteCost" | "monthly" | "total"; bold?: boolean }> = [
    { label: t("x433.tfnFees"), key: "tfnFees" },
    { label: t("x433.minutes"), key: "minuteCost" },
    { label: t("x433.monthlyCharges"), key: "monthly" },
    { label: t("x433.total"), key: "total", bold: true },
  ];
  const cell = "px-3 py-3 text-right tabular-nums";
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pt-4">
        <div>
          <h2 className="text-base font-semibold">{cs.map((c) => c.name).join(" + ")}</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">{t("x433.mergedTotal")}</p>
        </div>
        <div className="text-right">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-2xl font-semibold tabular-nums">{money(data.total)}</div>
        </div>
      </div>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[560px] text-[13px]">
          <thead>
            <tr className="border-b border-border text-[11px] text-muted-foreground">
              <th className="h-8 px-3 pl-5 text-left font-medium">{t("x433.costType")}</th>
              {cs.map((c) => (
                <th key={c.name} className="h-8 px-3 text-right font-medium">{c.name}</th>
              ))}
              <th className="h-8 px-3 pr-5 text-right font-medium">{t("x433.total")}</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.key} className={cn("border-b border-border/60", l.bold && "font-semibold")}>
                <td className="px-3 py-3 pl-5">{l.label}</td>
                {cs.map((c) => (
                  <td key={c.name} className={cell}>{money(c.totals[l.key])}</td>
                ))}
                <td className={cn(cell, "pr-5")}>{money(l.key === "total" ? data.total : sum(l.key))}</td>
              </tr>
            ))}
            <tr className="text-muted-foreground">
              <td className="px-3 py-3 pl-5">{t("x433.shareOfCost")}</td>
              {cs.map((c) => (
                <td key={c.name} className={cell}>{pct(c.totals.total, data.total)}</td>
              ))}
              <td className={cn(cell, "pr-5")}>{Number(data.total) > 0 ? "100%" : "0%"}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

/**
 * Owner > Company Profit (CH-434, Sir's design, 30 Oct): what customers paid
 * us, minus what carriers charge us, before tax - Today, Yesterday, This Week,
 * This Month or any dates. Every figure is the server's
 * (GET /api/owner/company-profit-statement, phone_numbers/company_profit.py);
 * the carrier costs are the Carrier Costs statements, so both pages agree.
 */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { PeriodBar, rangeLabel, rangeOf, type Preset, type Range } from "@/components/owner/carrier-statements";
import { easternToday } from "@/components/owner/period-picker";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { downloadRows } from "@/lib/export";
import { cn } from "@/lib/utils";

type LineKey = "minutes" | "recording" | "voip" | "rejected" | "tfn" | "portal" | "other";

interface ProfitStatement {
  start: string;
  end: string;
  days: number;
  charged: string;
  refunds: string;
  customers: number;
  lines: Array<{ key: LineKey; quantity: number; amount: string; price: string | null }>;
  carriers: Array<{ name: string; total: string; codes: string[] }>;
  carrierCosts: string;
  profit: string;
  marginPct: string | null;
  whatIf: {
    connectedMinutes: string;
    billedMinutes: number;
    perMinute: string;
    perMinuteRecording: string;
    customerMinutes: string;
    customerMinutesRecording: string;
    carrierMinutes: string;
    carrierMinuteParts: Array<{ label: string; amount: string }>;
    fixed: string;
    tfnFees: string;
    monthly: string;
    profit: string;
    profitRecording: string;
    portalFee: string;
    tfnFee: string;
    voipFee: string;
  };
  byCustomer: Array<{
    id: string;
    name: string;
    minutes: number;
    voip: number;
    rejected: number;
    tfns: number;
    portalFee: string;
    charged: string;
    ourCost: string;
    profit: string;
  }>;
  priceVsCost: Array<{
    carrier: string;
    risk: string;
    codes: string[];
    carrierRate: string;
    terminationRate: string;
    ourCost: string;
    customerPrice: string;
    margin: string;
    marginPct: string;
    marginNoRecording: string;
    marginNoRecordingPct: string;
  }>;
  priceList: Record<string, string>;
}

const money = (v: string | number) => {
  const n = Number(v);
  const s = `$${Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  return n < 0 ? `−${s}` : s;
};
const neg = (v: string | number) => (Number(v) === 0 ? money(0) : `−${money(Math.abs(Number(v)))}`);
const rate4 = (v: string | number) => `$${Number(v).toFixed(4)}`;
const int = (n: number) => n.toLocaleString("en-US");

export function CompanyProfitPage() {
  const { t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("today");
  const [range, setRange] = useState<Range>(() => rangeOf("today"));
  const [data, setData] = useState<ProfitStatement | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (r: Range) => {
    setLoading(true);
    try {
      setData(await http.get<ProfitStatement>("/api/owner/company-profit-statement", { query: { start: r.start, end: r.end } }));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const label = rangeLabel(range);
  const isToday = range.start === range.end && range.start === easternToday();

  const exportCsv = () => {
    if (!data) return;
    type Row = { section: string; line: string; quantity: string; amount: string };
    const rows: Row[] = [
      ...data.lines.map((l) => ({ section: t("x434.customerCharges"), line: t(`x434.line.${l.key}`), quantity: String(l.quantity), amount: l.amount })),
      { section: t("x434.customerCharges"), line: t("x434.refunds"), quantity: "", amount: `-${data.refunds}` },
      { section: t("x434.profit"), line: t("x434.chargedToCustomers"), quantity: "", amount: data.charged },
      ...data.carriers.map((c) => ({ section: t("x434.profit"), line: c.name, quantity: "", amount: `-${c.total}` })),
      { section: t("x434.profit"), line: t("x434.profitBeforeTax"), quantity: "", amount: data.profit },
      ...data.byCustomer.map((c) => ({ section: t("x434.byCustomer"), line: c.name, quantity: `${c.minutes} min`, amount: `${c.charged} - ${c.ourCost} = ${c.profit}` })),
    ];
    downloadRows(
      "csv",
      [
        { label: "Section", value: (r: Row) => r.section },
        { label: "Line", value: (r: Row) => r.line },
        { label: "Quantity", value: (r: Row) => r.quantity },
        { label: "Amount", value: (r: Row) => r.amount },
      ],
      rows,
      `company-profit-${range.start}_${range.end}`,
      "Company profit",
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{t("x434.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("x434.subtitle")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodBar preset={preset} range={range} onChange={(p, r) => { setPreset(p); setRange(r); }} />
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={exportCsv} disabled={!data}>
            {t("x434.export")}
          </Button>
        </div>
      </div>

      {loading && !data && <p className="text-sm text-muted-foreground">{t("owner.costs.loading")}</p>}

      {data && (
        <>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border lg:grid-cols-4">
            <Kpi label={t("x434.chargedToCustomers")} value={money(data.charged)} foot={t("x434.workspaces").replace("{n}", int(data.customers))} />
            <Kpi
              label={t("x434.carrierCosts")}
              value={money(data.carrierCosts)}
              foot={data.carriers.map((c) => `${c.name} ${money(c.total)}`).join(" · ")}
            />
            <Kpi
              label={t("x434.profitBeforeTax")}
              value={money(data.profit)}
              tone={Number(data.profit) < 0 ? "bad" : Number(data.profit) > 0 ? "good" : undefined}
              foot={t("x434.chargedMinusCosts")}
            />
            <Kpi
              label={t("x434.margin")}
              value={data.marginPct === null ? "—" : `${data.marginPct}%`}
              foot={data.marginPct === null ? t("x434.marginLater") : t("x434.marginHow")}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title={t("x434.customerCharges")} sub={t("x434.customerChargesSub")} right={money(data.charged)}>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th className="h-8 px-5 text-left font-medium">{t("x434.charge")}</th>
                    <th className="h-8 px-2 text-right font-medium">{t("x434.quantity")}</th>
                    <th className="h-8 px-2 text-right font-medium">{t("x434.price")}</th>
                    <th className="h-8 px-5 text-right font-medium">{t("x434.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines
                    .filter((l) => l.key !== "other" || Number(l.amount) !== 0)
                    .map((l) => (
                      <tr key={l.key} className="border-b border-border/50">
                        <td className="px-5 py-2.5">
                          <div>{t(`x434.line.${l.key}`)}</div>
                          <div className="text-[11px] text-muted-foreground">
                            {t(`x434.lineSub.${l.key}`).replace("{markup}", String(Number(data.priceList.markupPercent ?? 0)))}
                          </div>
                        </td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{t(`x434.unit.${l.key}`).replace("{n}", int(l.quantity))}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">
                          {l.key === "other" ? "—" : l.price === null ? t("x434.varies") : `${l.key === "tfn" || l.key === "portal" ? money(l.price) : rate4(l.price)} ${t(`x434.per.${l.key}`)}`}
                        </td>
                        <td className="px-5 py-2.5 text-right tabular-nums">{money(l.amount)}</td>
                      </tr>
                    ))}
                  {Number(data.refunds) !== 0 && (
                    <tr className="border-b border-border/50">
                      <td className="px-5 py-2.5" colSpan={3}>{t("x434.refunds")}</td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{neg(data.refunds)}</td>
                    </tr>
                  )}
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-5 py-3" colSpan={3}>{t("x434.chargedToCustomers")}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{money(data.charged)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>

            <Card
              title={t("x434.profit")}
              sub={`${label} · ${t("x434.eastern")}`}
              right={money(data.profit)}
              rightTone={Number(data.profit) < 0 ? "bad" : Number(data.profit) > 0 ? "good" : undefined}
              foot={t("x434.profitNote")}
            >
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border text-[11px] text-muted-foreground">
                    <th className="h-8 px-5 text-left font-medium">{t("x434.lineHead")}</th>
                    <th className="h-8 px-5 text-right font-medium">{t("x434.amount")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="px-5 py-2.5">{t("x434.chargedToCustomers")}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{money(data.charged)}</td>
                  </tr>
                  {data.carriers.map((c) => (
                    <tr key={c.name} className="border-b border-border/50">
                      <td className="px-5 py-2.5">
                        <div>{c.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {c.codes.map((x) => (x === "termination" ? t("x433.termination") : x)).join(" · ")}
                        </div>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">{money(c.total)}</td>
                    </tr>
                  ))}
                  <tr className="border-b border-border/50">
                    <td className="px-5 py-2.5">{t("x434.carrierCosts")}</td>
                    <td className="px-5 py-2.5 text-right tabular-nums">{neg(data.carrierCosts)}</td>
                  </tr>
                  <tr className="bg-muted/30 font-semibold">
                    <td className="px-5 py-3">{t("x434.profitBeforeTax")}</td>
                    <td className={cn("px-5 py-3 text-right tabular-nums", Number(data.profit) < 0 && "text-destructive")}>{money(data.profit)}</td>
                  </tr>
                </tbody>
              </table>
            </Card>
          </div>

          <WhatIf data={data} title={isToday ? t("x434.whatIfToday") : t("x434.whatIfPeriod")} label={label} />
          <ByCustomer data={data} />
          <PriceVsCost data={data} />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, foot, tone }: { label: string; value: string; foot: string; tone?: "good" | "bad" }) {
  return (
    <div className="bg-card px-4 py-3.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "mt-1 text-2xl font-semibold tabular-nums tracking-tight",
          tone === "bad" && "text-destructive",
          tone === "good" && "text-[color:var(--success)]",
        )}
      >
        {value}
      </div>
      <div className="mt-1 truncate text-[11px] text-muted-foreground">{foot}</div>
    </div>
  );
}

function Card({
  title,
  sub,
  right,
  rightTone,
  foot,
  children,
}: {
  title: string;
  sub?: string;
  right?: string;
  rightTone?: "good" | "bad";
  foot?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex items-start justify-between gap-3 px-5 pb-3 pt-4">
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
        </div>
        {right && (
          <div
            className={cn(
              "text-2xl font-semibold tabular-nums",
              rightTone === "bad" && "text-destructive",
              rightTone === "good" && "text-[color:var(--success)]",
            )}
          >
            {right}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-x-auto">{children}</div>
      {foot && <p className="border-t border-border px-5 py-2.5 text-[11px] text-muted-foreground">{foot}</p>}
    </section>
  );
}

function WhatIf({ data, title, label }: { data: ProfitStatement; title: string; label: string }) {
  const { t } = useTranslation();
  const w = data.whatIf;
  const parts = w.carrierMinuteParts.filter((p) => Number(p.amount) !== 0).map((p) => `${p.label === "termination" ? t("x433.termination").toLowerCase() : p.label} ${money(p.amount)}`).join(" · ");
  const cell = "px-3 py-2.5 text-right tabular-nums";
  return (
    <Card
      title={title}
      sub={t("x434.whatIfSub")
        .replace("{connected}", Number(w.connectedMinutes).toLocaleString("en-US", { minimumFractionDigits: 2 }))
        .replace("{billed}", int(w.billedMinutes))
        .replace("{label}", label)}
      foot={t("x434.whatIfNote").replace("{portal}", money(w.portalFee)).replace("{tfn}", money(w.tfnFee)).replace("{voip}", rate4(w.voipFee))}
    >
      <table className="w-full min-w-[640px] text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th className="h-8 px-5 text-left font-medium">{t("x434.lineHead")}</th>
            <th className="h-8 px-3 text-right font-medium">{t("x434.minutesOnly")}</th>
            <th className="h-8 px-5 text-right font-medium">{t("x434.minutesRecording")}</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-border/50">
            <td className="px-5 py-2.5">
              <div>{t("x434.customerMinutes")}</div>
              <div className="text-[11px] text-muted-foreground">{`${int(w.billedMinutes)} × ${rate4(w.perMinute)} · ${t("x434.or")} × ${rate4(w.perMinuteRecording)}`}</div>
            </td>
            <td className={cell}>{money(w.customerMinutes)}</td>
            <td className={cn(cell, "pr-5")}>{money(w.customerMinutesRecording)}</td>
          </tr>
          <tr className="border-b border-border/50">
            <td className="px-5 py-2.5">
              <div>{t("x434.carrierMinutes")}</div>
              <div className="text-[11px] text-muted-foreground">{parts}</div>
            </td>
            <td className={cell}>{neg(w.carrierMinutes)}</td>
            <td className={cn(cell, "pr-5")}>{neg(w.carrierMinutes)}</td>
          </tr>
          <tr className="border-b border-border/50">
            <td className="px-5 py-2.5">
              <div>{t("x434.fixedFees")}</div>
              <div className="text-[11px] text-muted-foreground">
                {t("x434.fixedFeesSub").replace("{tfn}", money(w.tfnFees)).replace("{monthly}", money(w.monthly))}
              </div>
            </td>
            <td className={cell}>{neg(w.fixed)}</td>
            <td className={cn(cell, "pr-5")}>{neg(w.fixed)}</td>
          </tr>
          <tr className="bg-muted/30 font-semibold">
            <td className="px-5 py-3">{t("x434.whatIfProfit")}</td>
            <td className={cn(cell, "py-3", Number(w.profit) < 0 && "text-destructive")}>{money(w.profit)}</td>
            <td className={cn(cell, "py-3 pr-5", Number(w.profitRecording) < 0 && "text-destructive")}>{money(w.profitRecording)}</td>
          </tr>
        </tbody>
      </table>
    </Card>
  );
}

function ByCustomer({ data }: { data: ProfitStatement }) {
  const { t } = useTranslation();
  const head = "h-8 px-3 text-right font-medium";
  return (
    <Card title={t("x434.byCustomer")} sub={t("x434.byCustomerSub")} foot={data.byCustomer.length ? t("x434.byCustomerNote") : undefined}>
      <table className="w-full min-w-[820px] text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th className="h-8 px-5 text-left font-medium">{t("x434.workspace")}</th>
            <th className={head}>{t("x433.minutes")}</th>
            <th className={head}>{t("x434.line.voip")}</th>
            <th className={head}>{t("x434.line.rejected")}</th>
            <th className={head}>{t("x433.tfns")}</th>
            <th className={head}>{t("x434.portalFee")}</th>
            <th className={head}>{t("x434.charged")}</th>
            <th className={head}>{t("x434.ourCost")}</th>
            <th className={cn(head, "pr-5")}>{t("x434.profit")}</th>
          </tr>
        </thead>
        <tbody>
          {data.byCustomer.map((c) => (
            <tr key={c.id} className="border-b border-border/50">
              <td className="px-5 py-2.5 font-medium">{c.name}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{int(c.minutes)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{int(c.voip)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{int(c.rejected)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{int(c.tfns)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(c.portalFee)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{money(c.charged)}</td>
              <td className="px-3 py-2.5 text-right tabular-nums">{neg(c.ourCost)}</td>
              <td className={cn("px-3 py-2.5 pr-5 text-right font-semibold tabular-nums", Number(c.profit) < 0 ? "text-destructive" : Number(c.profit) > 0 && "text-[color:var(--success)]")}>
                {money(c.profit)}
              </td>
            </tr>
          ))}
          {!data.byCustomer.length && (
            <tr>
              <td colSpan={9} className="px-5 py-8 text-center">
                <div className="font-medium">{t("x434.noCustomers")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("x434.noCustomersSub")}</div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function PriceVsCost({ data }: { data: ProfitStatement }) {
  const { t } = useTranslation();
  const rows = data.priceVsCost;
  const worst = rows.reduce<(typeof rows)[number] | null>((w, r) => (!w || Number(r.marginNoRecording) < Number(w.marginNoRecording) ? r : w), null);
  const pl = data.priceList;
  const name = (r: (typeof rows)[number]) =>
    `${r.carrier} ${r.risk === "high" ? t("x433.highRisk").toLowerCase() : r.risk === "low" ? t("x433.lowRisk").toLowerCase() : ""}`.trim();
  const note =
    t("x434.priceNote").replace("{minute}", rate4(pl.perMinuteRate)).replace("{recording}", rate4(pl.recordingFeePerMinute)) +
    (worst
      ? " " +
        (Number(worst.marginNoRecording) < 0 ? t("x434.priceNoteLoses") : t("x434.priceNoteEarns"))
          .replace("{line}", name(worst))
          .replace("{m}", rate4(Math.abs(Number(worst.marginNoRecording))))
          .replace("{p}", `${Math.abs(Number(worst.marginNoRecordingPct)).toFixed(0)}%`)
      : "");
  const head = "h-8 px-3 text-right font-medium";
  return (
    <Card title={t("x434.priceVsCost")} sub={t("x434.priceVsCostSub")} foot={note}>
      <table className="w-full min-w-[760px] text-[13px]">
        <thead>
          <tr className="border-b border-border text-[11px] text-muted-foreground">
            <th className="h-8 px-5 text-left font-medium">{t("x433.code")}</th>
            <th className="h-8 px-3 text-left font-medium">{t("x434.lineHead")}</th>
            <th className={head}>{t("x434.carrierPerMin")}</th>
            <th className={head}>{t("x434.terminationPerMin")}</th>
            <th className={head}>{t("x434.ourCostPerMin")}</th>
            <th className={head}>{t("x434.customerPrice")}</th>
            <th className={cn(head, "pr-5")}>{t("x434.marginPerMin")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const pct = Number(r.marginPct);
            return (
              <tr key={r.codes.join("/")} className="border-b border-border/50">
                <td className="px-5 py-2.5">
                  <span className="rounded border border-border bg-muted/40 px-1.5 py-0.5 font-mono text-[10px] font-semibold">{r.codes.join(" / ")}</span>
                </td>
                <td className="px-3 py-2.5">{name(r)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rate4(r.carrierRate)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rate4(r.terminationRate)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{rate4(r.ourCost)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{rate4(r.customerPrice)}</td>
                <td
                  className={cn(
                    "px-3 py-2.5 pr-5 text-right tabular-nums",
                    pct < 0 ? "text-destructive" : pct < 10 ? "text-[color:var(--warning)]" : "",
                  )}
                >
                  {rate4(r.margin)} <span className="text-muted-foreground">· {pct.toFixed(0)}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

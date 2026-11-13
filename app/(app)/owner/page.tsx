"use client";

/**
 * Owner — Organizations.
 *
 * The system owner's client list: every workspace with its balance, how long
 * the balance lasts (Runway), rates, headcount, today's traffic and whether
 * it needs attention (Health). A row opens the account page
 * (/owner/{id}: Overview, Traffic, Numbers, Caller & TFN lookup, Users,
 * Billing), where the actions are: edit rates & fees, adjust the balance,
 * message the client, open their portal, suspend / activate, delete.
 *
 * CH-675 (Sir, 13 Nov: "Org page - change it to the updated version with
 * more details"). Renders only for is_superuser; everyone else is turned
 * away in plain words even if they type the URL. Backend:
 * /api/owner/organizations (CH-113, CH-675).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Plus, Search, ShieldX } from "lucide-react";
import { toast } from "sonner";

import { CreateOrgDialog, errText } from "@/components/owner/org-actions";
import {
  HealthMark,
  MainBadge,
  OrgTile,
  StatStrip,
  StatTile,
  StatusMark,
  money,
  rateText,
  runwayIsShort,
  runwayText,
  type OrgRow,
} from "@/components/owner/org-format";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { LocalName } from "@/lib/i18n/local-name";
import { useAuthStore } from "@/lib/store/auth-store";
import { cn } from "@/lib/utils";

/** CH-665: the stock bucket, per type and carrier. */
interface StockRow {
  risk: "high" | "low";
  carrier: string;
  forSale: number;
  sold: number;
}

type Filter = "all" | "attention" | "today";

const needsAttention = (o: OrgRow) => (o.health ?? "ok") !== "ok";

export default function OwnerPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const isSuperuser = useAuthStore((s) => s.user?.isSuperuser === true);

  const [rows, setRows] = useState<OrgRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [stock, setStock] = useState<StockRow[]>([]);

  const load = useCallback(async (q: string) => {
    try {
      const r = await http.get<{ items: OrgRow[] }>(
        `/api/owner/organizations?search=${encodeURIComponent(q)}&page_size=200`,
      );
      setRows(r.items);
      http
        .get<{ rows: StockRow[] }>(`/api/owner/tfn-stock`)
        .then((s) => setStock(s.rows))
        .catch(() => setStock([]));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setLoading(false);
    }
  }, []);

  const reload = useCallback(() => load(search), [load, search]);

  useEffect(() => {
    if (!isSuperuser) return;
    const h = setTimeout(() => load(search), search ? 250 : 0);
    return () => clearTimeout(h);
  }, [isSuperuser, search, load]);

  const summary = useMemo(() => {
    const clients = rows.filter((o) => !o.isMainAccount);
    const withTraffic = rows.filter((o) => o.callsToday > 0);
    const attention = rows.filter(needsAttention);
    const ratesWithRevenue = Array.from(
      new Set(rows.filter((o) => Number(o.revenueToday) > 0 && o.perMinuteRate).map((o) => Number(o.perMinuteRate))),
    );
    return {
      total: rows.length,
      active: rows.filter((o) => o.isActive).length,
      clients: clients.length,
      balances: rows.reduce((n, o) => n + (Number(o.balance) || 0), 0),
      calls: rows.reduce((n, o) => n + (o.callsToday || 0), 0),
      withTraffic: withTraffic.length,
      revenue: rows.reduce((n, o) => n + (Number(o.revenueToday) || 0), 0),
      oneRate: ratesWithRevenue.length === 1 ? ratesWithRevenue[0] : null,
      attention,
    };
  }, [rows]);

  if (!isSuperuser) {
    return (
      <div className="mx-auto w-full max-w-[560px] pt-24 text-center">
        <ShieldX className="mx-auto h-8 w-8 text-muted-foreground" />
        <h1 className="mt-3 text-lg font-semibold">{t("owner.notYours.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("owner.notYours.body")}</p>
      </div>
    );
  }

  const stockTotals = (["high", "low"] as const).map((risk) => ({
    risk,
    forSale: stock.filter((s) => s.risk === risk).reduce((n, s) => n + s.forSale, 0),
    sold: stock.filter((s) => s.risk === risk).reduce((n, s) => n + s.sold, 0),
  }));

  const shown = rows.filter((o) =>
    filter === "attention" ? needsAttention(o) : filter === "today" ? o.callsToday > 0 : true,
  );
  const ours = shown.filter((o) => o.isMainAccount);
  const clients = shown.filter((o) => !o.isMainAccount);

  const fill = (key: string, n: number | string) => t(key).replace("{count}", String(n));

  const num = "text-right font-mono text-[13px] tabular-nums";
  // No balance (or none set): "—". A balance under a minute: "< 1 min", red.
  const runwayCell = (o: OrgRow) => {
    const bal = Number(o.balance);
    if (o.runwayMinutes == null || !(bal > 0)) return { text: "—", cls: "text-muted-foreground" };
    return { text: runwayText(o.runwayMinutes), cls: runwayIsShort(o) ? "text-red-600 dark:text-red-400" : "" };
  };
  const dimIfZero = (v: number) => (v === 0 ? "text-muted-foreground/70" : "");

  const renderRow = (o: OrgRow) => (
    <TableRow
      key={o.id}
      className={cn("cursor-pointer", o.isActive ? "" : "opacity-60")}
      onClick={() => router.push(`/owner/${o.id}`)}
    >
      <TableCell className="text-left py-3.5 pl-5">
        <div className="flex items-center gap-3">
          <OrgTile name={o.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LocalName name={o.name} className="truncate font-medium" />
              {o.isMainAccount && <MainBadge t={t} />}
            </div>
            <div className="font-mono text-xs text-muted-foreground">{o.slug}</div>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-left">
        <StatusMark active={o.isActive} t={t} />
      </TableCell>
      <TableCell className={cn("text-left", num, o.balance != null && dimIfZero(Number(o.balance)), o.balance == null && "text-muted-foreground")}>
        {money(o.balance)}
      </TableCell>
      <TableCell className={cn("text-left", num, runwayCell(o).cls)}>{runwayCell(o).text}</TableCell>
      <TableCell className={cn("text-left", num, !o.perMinuteRate && "text-muted-foreground")}>{rateText(o.perMinuteRate)}</TableCell>
      <TableCell className={cn("text-left", num, "text-muted-foreground")}>
        {o.markupPercent == null ? "—" : `${Number(o.markupPercent)}%`}
      </TableCell>
      <TableCell className={num}>{o.users}</TableCell>
      <TableCell className={cn("text-left", num, dimIfZero(o.callsToday))}>{o.callsToday}</TableCell>
      <TableCell className={cn("text-left", num, dimIfZero(Number(o.revenueToday) || 0))}>{money(o.revenueToday)}</TableCell>
      <TableCell className="text-left pl-6">
        <HealthMark health={o.health} t={t} />
      </TableCell>
      <TableCell className="w-[48px] pr-5 text-right">
        <ChevronRight aria-hidden className="ml-auto h-4 w-4 text-muted-foreground" />
      </TableCell>
    </TableRow>
  );

  const section = (label: React.ReactNode) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={11} className="bg-muted/30 py-2.5 pl-5 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  const seg = (id: Filter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      aria-pressed={filter === id}
      className={cn(
        "rounded-md px-3 py-1 text-[13px] transition-colors",
        filter === id ? "bg-muted font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

  const th = "text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";

  return (
    <div className="mx-auto w-full max-w-[1280px] space-y-6">
      <PageHeader
        title={t("owner.orgs.title")}
        description={t("x675.list.subtitle")}
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t("owner.orgs.newOrg")}
          </Button>
        }
        className="pb-0"
      />

      <StatStrip>
        <StatTile
          label={t("x675.card.organizations")}
          value={summary.total}
          sub={`${fill("x675.card.activeCount", summary.active)} · ${fill("x675.card.clientsCount", summary.clients)}`}
        />
        <StatTile label={t("x675.card.balances")} value={money(summary.balances)} sub={t("x675.card.balancesSub")} tone="green" />
        <StatTile
          label={t("owner.orgs.callsToday")}
          value={summary.calls}
          sub={summary.withTraffic === 1 ? t("x675.card.withTraffic1") : fill("x675.card.withTraffic", summary.withTraffic)}
          tone="blue"
        />
        <StatTile
          label={t("owner.orgs.revenueToday")}
          value={money(summary.revenue)}
          sub={summary.oneRate != null ? fill("x675.card.atRate", rateText(String(summary.oneRate))) : "—"}
        />
        <StatTile
          label={t("x675.card.attention")}
          value={summary.attention.length}
          sub={summary.attention.length ? summary.attention.map((o) => o.name).join(" · ") : t("x675.card.allGood")}
          tone={summary.attention.length ? "red" : undefined}
          onClick={() => setFilter(filter === "attention" ? "all" : "attention")}
          active={filter === "attention"}
        />
      </StatStrip>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-xs flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("owner.orgs.searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5">
          {seg("all", t("x675.filter.all"))}
          {seg("attention", t("x675.card.attention"))}
          {seg("today", t("x675.filter.activeToday"))}
        </div>

        {/* CH-665: the stock customers buy from, per type. */}
        <div className="ml-auto flex flex-wrap items-center gap-2 text-[13px]">
          <span className="text-muted-foreground">{t("x665.owner.stock")}</span>
          {stockTotals.map((s) => (
            <span
              key={s.risk}
              className="rounded-md border bg-card px-2.5 py-1"
              title={stock
                .filter((r) => r.risk === s.risk)
                .map((r) => `${r.carrier || "—"}: ${r.forSale} / ${r.sold}`)
                .join("\n")}
            >
              {t(s.risk === "high" ? "x665.type.high" : "x665.type.low")}{" "}
              <b className="font-semibold">{s.forSale}</b> {t("x675.stock.forSale")} ·{" "}
              <b className="font-semibold">{s.sold}</b> {t("x675.stock.sold")}
            </span>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden py-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(th, "pl-5")}>{t("x675.col.organization")}</TableHead>
                <TableHead className={th}>{t("owner.orgs.status")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("owner.orgs.balance")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("x675.col.runway")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("x675.col.rate")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("x675.col.markup")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("owner.orgs.users")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("owner.orgs.callsToday")}</TableHead>
                <TableHead className={cn(th, "text-right")}>{t("owner.orgs.revenueToday")}</TableHead>
                <TableHead className={cn(th, "pl-6")}>{t("x675.col.health")}</TableHead>
                <TableHead className="w-[48px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ours.length > 0 && section(t("x675.section.yours"))}
              {ours.map(renderRow)}
              {clients.length > 0 && section(
                  <>
                    {t("x675.section.clients")} <span className="ml-1.5">{clients.length}</span>
                  </>,
                )}
              {clients.map(renderRow)}
              {!loading && shown.length === 0 && (
                <TableRow>
                  <TableCell colSpan={11} className="py-10 text-center text-sm text-muted-foreground">
                    {t("owner.orgs.empty")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <CreateOrgDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={reload} />
    </div>
  );
}

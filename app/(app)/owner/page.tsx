"use client";

/**
 * Owner — Organizations.
 *
 * The system owner's client list: every workspace with its balance, how long
 * the balance lasts (Runway), rates, headcount, today's traffic and whether
 * it needs attention (Health). A row opens the account page
 * (/owner/{id}: Overview, Traffic, Numbers, Caller & TFN lookup, Users,
 * Billing). The actions stay on every row: edit rates & fees, adjust the
 * balance, message the client, suspend / activate, delete.
 *
 * CH-675 (Sir, 13 Nov: "Org page - change it to the updated version with
 * more details"). Renders only for is_superuser; everyone else is turned
 * away in plain words even if they type the URL. Backend:
 * /api/owner/organizations (CH-113, CH-675).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, MoreHorizontal, Plus, Search, ShieldX, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { CreateOrgDialog, errText, useOrgActions } from "@/components/owner/org-actions";
import {
  HealthMark,
  MainBadge,
  OrgTile,
  StatTile,
  StatusMark,
  money,
  rateText,
  runwayIsShort,
  runwayText,
  type OrgRow,
} from "@/components/owner/org-format";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  const actions = useOrgActions(reload);

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

  const renderRow = (o: OrgRow) => (
    <TableRow
      key={o.id}
      className={cn("cursor-pointer", o.isActive ? "" : "opacity-60")}
      onClick={() => router.push(`/owner/${o.id}`)}
    >
      <TableCell>
        <div className="flex items-center gap-3">
          <OrgTile name={o.name} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <LocalName name={o.name} className="truncate font-medium" />
              {o.isMainAccount && <MainBadge t={t} />}
            </div>
            <div className="text-xs text-muted-foreground">
              {o.slug}
              {(o.tfnRisk === "high" || o.tfnRisk === "low") && (
                <Badge variant={o.tfnRisk === "high" ? "destructive" : "secondary"} className="ml-2 px-1.5 py-0 text-[10px]">
                  {t(o.tfnRisk === "high" ? "x665.type.high" : "x665.type.low")}
                </Badge>
              )}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell>
        <StatusMark active={o.isActive} t={t} />
      </TableCell>
      <TableCell className="text-right tabular-nums">{money(o.balance)}</TableCell>
      <TableCell className={cn("text-right tabular-nums", runwayIsShort(o) && "font-medium text-red-600 dark:text-red-400")}>
        {runwayText(o.runwayMinutes)}
      </TableCell>
      <TableCell className="text-right tabular-nums">{rateText(o.perMinuteRate)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {o.markupPercent == null ? "—" : `${Number(o.markupPercent)}%`}
      </TableCell>
      <TableCell className="text-right tabular-nums">{o.users}</TableCell>
      <TableCell className="text-right tabular-nums">{o.callsToday}</TableCell>
      <TableCell className="text-right tabular-nums">{money(o.revenueToday)}</TableCell>
      <TableCell>
        <HealthMark health={o.health} t={t} />
      </TableCell>
      <TableCell onClick={(e) => e.stopPropagation()} className="w-[72px]">
        <div className="flex items-center justify-end gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8" aria-label={t("x675.actions")}>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => actions.openFees(o)}>{t("owner.orgs.editRates")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.openMoney(o, "credit")}>{t("owner.orgs.credit")}</DropdownMenuItem>
              <DropdownMenuItem onClick={() => actions.openMoney(o, "debit")}>{t("owner.orgs.debit")}</DropdownMenuItem>
              {!o.isMainAccount && (
                <DropdownMenuItem onClick={() => actions.openMessage(o)}>{t("x675.message.title")}</DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={o.isActive ? "text-destructive" : ""}
                onClick={() => actions.openSuspend(o)}
              >
                {o.isActive ? t("owner.orgs.suspend") : t("owner.orgs.activate")}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => actions.openDelete(o)}>
                <Trash2 className="mr-2 h-4 w-4" />
                {t("owner.orgs.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ChevronRight aria-hidden className="h-4 w-4 text-muted-foreground" />
        </div>
      </TableCell>
    </TableRow>
  );

  const section = (label: string) => (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={11} className="bg-muted/40 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </TableCell>
    </TableRow>
  );

  const chip = (id: Filter, label: string) => (
    <button
      key={id}
      type="button"
      onClick={() => setFilter(id)}
      className={cn(
        "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        filter === id ? "border-accent bg-accent/10 text-accent" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );

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

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label={t("x675.card.organizations")}
          value={summary.total}
          sub={`${fill("x675.card.activeCount", summary.active)} · ${fill("x675.card.clientsCount", summary.clients)}`}
        />
        <StatTile label={t("x675.card.balances")} value={money(summary.balances)} sub={t("x675.card.balancesSub")} />
        <StatTile
          label={t("owner.orgs.callsToday")}
          value={summary.calls}
          sub={fill("x675.card.withTraffic", summary.withTraffic)}
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
          tone={summary.attention.length ? "warn" : undefined}
          onClick={() => setFilter(filter === "attention" ? "all" : "attention")}
          active={filter === "attention"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("owner.orgs.searchPlaceholder")}
            className="pl-8"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {chip("all", `${t("x675.filter.all")} ${rows.length}`)}
          {chip("attention", `${t("x675.card.attention")} ${summary.attention.length}`)}
          {chip("today", `${t("x675.filter.activeToday")} ${summary.withTraffic}`)}
        </div>
      </div>

      {/* CH-665: the stock customers buy from, per type. */}
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">{t("x665.owner.stock")}</span>
        {stockTotals.map((s) => (
          <Badge
            key={s.risk}
            variant="outline"
            title={stock
              .filter((r) => r.risk === s.risk)
              .map((r) => `${r.carrier || "—"}: ${r.forSale} / ${r.sold}`)
              .join("\n")}
          >
            {t(s.risk === "high" ? "x665.type.high" : "x665.type.low")}:{" "}
            {t("x665.owner.forSale").replace("{count}", String(s.forSale))} ·{" "}
            {t("x665.owner.sold").replace("{count}", String(s.sold))}
          </Badge>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("x675.col.organization")}</TableHead>
                <TableHead>{t("owner.orgs.status")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.balance")}</TableHead>
                <TableHead className="text-right">{t("x675.col.runway")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.rate")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.markup")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.users")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.callsToday")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.revenueToday")}</TableHead>
                <TableHead>{t("x675.col.health")}</TableHead>
                <TableHead className="w-[72px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ours.length > 0 && section(t("x675.section.yours"))}
              {ours.map(renderRow)}
              {clients.length > 0 && section(`${t("x675.section.clients")} ${clients.length}`)}
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
      {actions.dialogs}
    </div>
  );
}

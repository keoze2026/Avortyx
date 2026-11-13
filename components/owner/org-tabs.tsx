"use client";

/**
 * CH-675: the account page's tabs - Overview, Traffic, Numbers, Caller & TFN
 * lookup, Users, Billing. Owner only; every figure comes from
 * /api/owner/organizations/{id}/... and /api/owner/lookup (no invented
 * values: a figure the server did not send shows "—").
 */

import { useEffect, useState } from "react";
import { ArrowRight, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

import { errText } from "@/components/owner/org-actions";
import { StatTile, money, rateText, runwayText, type Health } from "@/components/owner/org-format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { formatLocalDate, formatLocalDateTime, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

type T = (k: string) => string;
const fill = (t: T, key: string, n: number | string) => t(key).replace("{count}", String(n));

// ── Overview ───────────────────────────────────────────────────────────────

export interface Overview {
  balance: string | null;
  perMinuteRate: string | null;
  markupPercent: string | null;
  runwayMinutes: number | null;
  liveNow: number;
  callsToday: number;
  tfnsWithCallsToday: number;
  revenueToday: string;
  users: number;
  flow: { fromPublishers: number; routedToBuyers: number; connected: number };
  lastCallAt: string | null;
  health: Health;
  checks: { level: "action" | "info"; code: string; title: string; detail: string }[];
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : null);

export function OverviewTab({ data }: { data: Overview | null }) {
  const { t } = useTranslation();
  if (!data) return <p className="py-10 text-center text-sm text-muted-foreground">…</p>;
  const f = data.flow;
  const forwarded = pct(f.routedToBuyers, f.fromPublishers);
  const answered = pct(f.connected, f.routedToBuyers);
  const step = (label: string, value: number, sub: string | null) => (
    <div className="min-w-0 flex-1 rounded-lg border bg-muted/30 p-4 text-center">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile
          label={t("owner.orgs.balance")}
          value={money(data.balance)}
          sub={
            data.runwayMinutes != null
              ? `${runwayText(data.runwayMinutes)} ${fill(t, "x675.ov.leftAt", rateText(data.perMinuteRate))}`
              : "—"
          }
        />
        <StatTile label={t("x675.ov.liveNow")} value={data.liveNow} sub={t("x675.ov.inProgress")} />
        <StatTile
          label={t("owner.orgs.callsToday")}
          value={data.callsToday}
          sub={fill(t, "x675.ov.tfnsLive", data.tfnsWithCallsToday)}
        />
        <StatTile
          label={t("owner.orgs.revenueToday")}
          value={money(data.revenueToday)}
          sub={data.markupPercent != null ? fill(t, "x675.ov.markup", `${Number(data.markupPercent)}%`) : "—"}
        />
        <StatTile label={t("owner.orgs.users")} value={data.users} sub={t("x675.ov.logins")} />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("x675.ov.flowTitle")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-stretch gap-2 md:flex-row md:items-center">
            {step(t("x675.ov.fromPublishers"), f.fromPublishers, null)}
            <ArrowRight aria-hidden className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />
            {step(t("x675.ov.routed"), f.routedToBuyers, forwarded != null ? fill(t, "x675.ov.forwarded", forwarded) : null)}
            <ArrowRight aria-hidden className="mx-auto h-4 w-4 shrink-0 rotate-90 text-muted-foreground md:rotate-0" />
            {step(t("x675.ov.connected"), f.connected, answered != null ? fill(t, "x675.ov.answered", answered) : null)}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("x675.ov.checksTitle")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {data.checks.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" /> {t("x675.ov.allClear")}
            </p>
          ) : (
            data.checks.map((c) => (
              <div key={c.code} className="flex items-start justify-between gap-3 rounded-lg border p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground">{c.detail}</div>
                </div>
                <Badge
                  variant="outline"
                  className={cn(
                    "shrink-0",
                    c.level === "action"
                      ? "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
                      : "text-muted-foreground",
                  )}
                >
                  {c.level === "action" ? t("x675.ov.action") : t("x675.ov.info")}
                </Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Traffic ────────────────────────────────────────────────────────────────

interface TrafficRow {
  campaign: string;
  publisher: string;
  buyer: string;
  callsIn: number;
  callsOut: number;
  connected: number;
  minutes: number;
  spend: string;
}

function todayIso() {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString().slice(0, 10);
}

export function TrafficTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [day, setDay] = useState(todayIso());
  const [rows, setRows] = useState<TrafficRow[] | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    http
      .get<{ rows: TrafficRow[] }>(`/api/owner/organizations/${orgId}/traffic?date=${day}`)
      .then((r) => live && setRows(r.rows))
      .catch((e) => {
        if (live) setRows([]);
        toast.error(errText(e));
      });
    return () => {
      live = false;
    };
  }, [orgId, day]);

  const sum = (k: "callsIn" | "callsOut" | "connected" | "minutes") => (rows ?? []).reduce((n, r) => n + r[k], 0);
  const spend = (rows ?? []).reduce((n, r) => n + Number(r.spend || 0), 0);
  const dash = (s: string) => s || "—";

  return (
    <Card>
      <CardHeader className="flex flex-col gap-2 pb-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <CardTitle className="text-sm">{t("x675.tr.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("x675.tr.subtitle")}</p>
        </div>
        <Input type="date" value={day} max={todayIso()} onChange={(e) => e.target.value && setDay(e.target.value)} className="w-[160px]" />
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("x675.tr.campaign")}</TableHead>
              <TableHead>{t("x675.tr.publisher")}</TableHead>
              <TableHead className="text-right">{t("x675.tr.callsIn")}</TableHead>
              <TableHead>{t("x675.tr.buyer")}</TableHead>
              <TableHead className="text-right">{t("x675.tr.callsOut")}</TableHead>
              <TableHead className="text-right">{t("x675.ov.connected")}</TableHead>
              <TableHead className="text-right">{t("x675.tr.minutes")}</TableHead>
              <TableHead className="text-right">{t("x675.tr.spend")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">…</TableCell>
              </TableRow>
            )}
            {rows?.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-sm text-muted-foreground">
                  {t("x675.tr.empty")}
                </TableCell>
              </TableRow>
            )}
            {rows?.map((r, i) => (
              <TableRow key={`${r.campaign}|${r.publisher}|${r.buyer}|${i}`}>
                <TableCell className="font-medium">{dash(r.campaign)}</TableCell>
                <TableCell>{dash(r.publisher)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.callsIn}</TableCell>
                <TableCell>{dash(r.buyer)}</TableCell>
                <TableCell className="text-right tabular-nums">{r.callsOut}</TableCell>
                <TableCell className="text-right tabular-nums">{r.connected}</TableCell>
                <TableCell className="text-right tabular-nums">{r.minutes}</TableCell>
                <TableCell className="text-right tabular-nums">{money(r.spend)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          {rows && rows.length > 1 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2}>{t("x675.tr.total")}</TableCell>
                <TableCell className="text-right tabular-nums">{sum("callsIn")}</TableCell>
                <TableCell />
                <TableCell className="text-right tabular-nums">{sum("callsOut")}</TableCell>
                <TableCell className="text-right tabular-nums">{sum("connected")}</TableCell>
                <TableCell className="text-right tabular-nums">{Math.round(sum("minutes") * 10) / 10}</TableCell>
                <TableCell className="text-right tabular-nums">{money(spend)}</TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Numbers ────────────────────────────────────────────────────────────────

interface NumberRow {
  id: string;
  number: string;
  source: "avortyx" | "own";
  risk: string;
  campaign: string;
  callsToday: number;
  state: "live" | "expired" | "released" | "pending" | string;
  retiredReason: string;
  added: string;
  releasedAt: string | null;
}

const RISK_KEY: Record<string, string> = { high: "x665.type.high", low: "x665.type.low" };

export function SourceBadge({ source, t }: { source: string; t: T }) {
  return source === "avortyx" ? (
    <Badge variant="outline" className="border-accent/40 bg-accent/10 text-accent">{t("x675.nu.onAvortyx")}</Badge>
  ) : (
    <Badge variant="outline" className="text-muted-foreground">{t("x675.nu.own")}</Badge>
  );
}

export function StateBadge({ state, t }: { state: string; t: T }) {
  const styles: Record<string, string> = {
    live: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    expired: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  };
  const key: Record<string, string> = {
    live: "x675.nu.live",
    expired: "x675.nu.expired",
    released: "x675.nu.released",
    pending: "x675.nu.pending",
  };
  return (
    <Badge variant="outline" className={styles[state] ?? "text-muted-foreground"}>
      {key[state] ? t(key[state]) : state}
    </Badge>
  );
}

export function NumbersTab({ orgId }: { orgId: string }) {
  const { t } = useTranslation();
  const [data, setData] = useState<{ count: number; live: number; rows: NumberRow[] } | null>(null);

  useEffect(() => {
    let live = true;
    http
      .get<{ count: number; live: number; rows: NumberRow[] }>(`/api/owner/organizations/${orgId}/numbers`)
      .then((r) => live && setData(r))
      .catch((e) => {
        if (live) setData({ count: 0, live: 0, rows: [] });
        toast.error(errText(e));
      });
    return () => {
      live = false;
    };
  }, [orgId]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-end justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-sm">{t("x675.nu.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("x675.nu.subtitle")}</p>
        </div>
        {data && (
          <span className="text-xs text-muted-foreground">
            {fill(t, "x675.nu.count", data.count)} · {fill(t, "x675.nu.liveCount", data.live)}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("x675.nu.tfn")}</TableHead>
              <TableHead>{t("x675.nu.source")}</TableHead>
              <TableHead>{t("x675.nu.risk")}</TableHead>
              <TableHead>{t("x675.tr.campaign")}</TableHead>
              <TableHead className="text-right">{t("owner.orgs.callsToday")}</TableHead>
              <TableHead>{t("owner.orgs.status")}</TableHead>
              <TableHead>{t("x675.nu.added")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data === null && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">…</TableCell>
              </TableRow>
            )}
            {data?.rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  {t("x675.nu.empty")}
                </TableCell>
              </TableRow>
            )}
            {data?.rows.map((n) => (
              <TableRow key={n.id} className={n.state === "live" ? "" : "opacity-70"}>
                <TableCell className="font-mono text-xs">{n.number}</TableCell>
                <TableCell>
                  <SourceBadge source={n.source} t={t} />
                </TableCell>
                <TableCell>{RISK_KEY[n.risk] ? t(RISK_KEY[n.risk]) : "—"}</TableCell>
                <TableCell>{n.campaign || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{n.callsToday}</TableCell>
                <TableCell>
                  <StateBadge state={n.state} t={t} />
                  {n.releasedAt && n.state !== "live" && (
                    <span className="ml-2 text-xs text-muted-foreground">{formatLocalDate(n.releasedAt)}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">{formatLocalDate(n.added)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Caller & TFN lookup ────────────────────────────────────────────────────

interface Lookup {
  number: string;
  found: boolean;
  error?: string;
  tfn: null | {
    number: string;
    account: string;
    campaign: string;
    source: string;
    risk: string;
    state: string;
    retiredReason: string;
    releasedAt: string | null;
    added: string;
    totalCalls: number;
    firstCall: string | null;
    lastCall: string | null;
  };
  caller: null | {
    totalCalls: number;
    firstCall: string | null;
    lastCall: string | null;
    byAccount: { account: string; calls: number }[];
    recent: {
      at: string;
      account: string;
      tfn: string;
      campaign: string;
      buyer: string;
      status: string;
      duration: number;
    }[];
  };
}

export function LookupTab() {
  const { t } = useTranslation();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<Lookup | null>(null);

  async function check() {
    if (!q.trim()) return;
    setBusy(true);
    try {
      setRes(await http.get<Lookup>(`/api/owner/lookup?number=${encodeURIComponent(q.trim())}`));
    } catch (e) {
      toast.error(errText(e));
    } finally {
      setBusy(false);
    }
  }

  const cell = (label: string, value: React.ReactNode) => (
    <div className="min-w-0">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="truncate text-sm font-medium">{value}</div>
    </div>
  );
  const when = (v: string | null) => (v ? formatLocalDateTime(v) : "—");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("x675.lu.title")}</CardTitle>
          <p className="text-xs text-muted-foreground">{t("x675.lu.subtitle")}</p>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void check();
            }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="+1 888 891 4875" className="pl-8" inputMode="tel" />
            </div>
            <Button type="submit" disabled={busy || !q.trim()}>
              {t("x675.lu.check")}
            </Button>
          </form>
        </CardContent>
      </Card>

      {res && !res.found && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            {res.error ?? fill(t, "x675.lu.notFound", res.number)}
          </CardContent>
        </Card>
      )}

      {res?.tfn && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="font-mono text-base">{res.tfn.number}</CardTitle>
            <div className="flex items-center gap-2">
              <SourceBadge source={res.tfn.source} t={t} />
              <StateBadge state={res.tfn.state} t={t} />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {cell(t("x675.lu.account"), res.tfn.account)}
              {cell(t("x675.tr.campaign"), res.tfn.campaign || "—")}
              {cell(t("x675.lu.totalCalls"), res.tfn.totalCalls)}
              {cell(t("x675.lu.lastSeen"), res.tfn.lastCall ? formatRelativeTime(new Date(res.tfn.lastCall).getTime()) : "—")}
            </div>
            <p className="text-xs text-muted-foreground">
              {[
                `${t("x675.lu.firstSeen")} ${when(res.tfn.firstCall)}`,
                `${t("x675.nu.added")} ${formatLocalDate(res.tfn.added)}`,
                RISK_KEY[res.tfn.risk] ? t(RISK_KEY[res.tfn.risk]) : null,
                res.tfn.releasedAt && res.tfn.state !== "live"
                  ? `${res.tfn.state === "expired" ? t("x675.nu.expired") : t("x675.nu.released")} ${formatLocalDate(res.tfn.releasedAt)}`
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </CardContent>
        </Card>
      )}

      {res?.caller && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {t("x675.lu.asCaller")} <span className="font-mono">{res.number}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {cell(t("x675.lu.totalCalls"), res.caller.totalCalls)}
              {cell(t("x675.lu.firstSeen"), when(res.caller.firstCall))}
              {cell(t("x675.lu.lastSeen"), when(res.caller.lastCall))}
              {cell(
                t("x675.lu.accounts"),
                res.caller.byAccount.map((a) => `${a.account} (${a.calls})`).join(", ") || "—",
              )}
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("x675.lu.when")}</TableHead>
                  <TableHead>{t("x675.lu.account")}</TableHead>
                  <TableHead>{t("x675.nu.tfn")}</TableHead>
                  <TableHead>{t("x675.tr.campaign")}</TableHead>
                  <TableHead>{t("x675.tr.buyer")}</TableHead>
                  <TableHead>{t("owner.orgs.status")}</TableHead>
                  <TableHead className="text-right">{t("x675.lu.seconds")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.caller.recent.map((c, i) => (
                  <TableRow key={`${c.at}-${i}`}>
                    <TableCell className="text-xs">{formatLocalDateTime(c.at)}</TableCell>
                    <TableCell>{c.account}</TableCell>
                    <TableCell className="font-mono text-xs">{c.tfn || "—"}</TableCell>
                    <TableCell>{c.campaign || "—"}</TableCell>
                    <TableCell>{c.buyer || "—"}</TableCell>
                    <TableCell className="text-xs">{c.status}</TableCell>
                    <TableCell className="text-right tabular-nums">{c.duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Users ──────────────────────────────────────────────────────────────────

export interface OrgUser {
  id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  mfaEnabled?: boolean;
  dateJoined?: string | null;
  lastLogin: string | null;
}

export function UsersTab({ users }: { users: OrgUser[] }) {
  const { t } = useTranslation();
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("x675.us.user")}</TableHead>
              <TableHead>{t("x675.us.role")}</TableHead>
              <TableHead>{t("owner.orgs.status")}</TableHead>
              <TableHead>{t("x675.us.twoFa")}</TableHead>
              <TableHead>{t("x675.us.lastLogin")}</TableHead>
              <TableHead>{t("x675.us.joined")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                  {t("x675.us.empty")}
                </TableCell>
              </TableRow>
            )}
            {users.map((u) => (
              <TableRow key={u.id} className={u.isActive ? "" : "opacity-60"}>
                <TableCell>
                  <div className="font-medium">{u.name || u.email}</div>
                  {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                </TableCell>
                <TableCell className="capitalize">{u.role}</TableCell>
                <TableCell>
                  {u.isActive ? t("owner.orgs.active") : t("x675.us.inactive")}
                </TableCell>
                <TableCell>
                  {u.mfaEnabled ? (
                    <span className="text-emerald-600 dark:text-emerald-400">{t("x675.us.on")}</span>
                  ) : (
                    <span className="text-amber-600 dark:text-amber-400">{t("x675.us.off")}</span>
                  )}
                </TableCell>
                <TableCell className="text-xs">{u.lastLogin ? formatLocalDateTime(u.lastLogin) : t("x675.us.never")}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{u.dateJoined ? formatLocalDate(u.dateJoined) : "—"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ── Billing ────────────────────────────────────────────────────────────────

interface Tx {
  id: string;
  at: string;
  type: string;
  status: string;
  amount: string;
  balanceAfter: string;
  description: string;
}

export function BillingTab({
  orgId,
  billing,
  tfnRisk,
  callLimit,
  isMain,
  onEditRates,
  onAdjust,
  reloadKey,
}: {
  orgId: string;
  billing: Record<string, string>;
  tfnRisk: string;
  callLimit: number;
  isMain: boolean;
  onEditRates: () => void;
  onAdjust: () => void;
  reloadKey: number;
}) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<Tx[] | null>(null);

  useEffect(() => {
    let live = true;
    http
      .get<{ rows: Tx[] }>(`/api/owner/organizations/${orgId}/transactions?limit=100`)
      .then((r) => live && setRows(r.rows))
      .catch((e) => {
        if (live) setRows([]);
        toast.error(errText(e));
      });
    return () => {
      live = false;
    };
  }, [orgId, reloadKey]);

  const FIELDS: [string, string, (v: string) => string][] = [
    ["perMinuteRate", "owner.orgs.fees.per_minute_rate", rateText],
    ["markupPercent", "owner.orgs.fees.markup_percent", (v) => `${Number(v)}%`],
    ["recordingFeePerMinute", "owner.orgs.fees.recording_fee_per_minute", (v) => money(v, 4)],
    ["voipShieldFeePerCall", "owner.orgs.fees.voip_shield_fee_per_call", (v) => money(v, 4)],
    ["rejectedCallFee", "owner.orgs.fees.rejected_call_fee", (v) => money(v, 4)],
    ["tfnPurchaseFee", "owner.orgs.fees.tfn_purchase_fee", (v) => money(v)],
    ["monthlyPortalFee", "owner.orgs.fees.monthly_portal_fee", (v) => money(v)],
    ["creditLimit", "owner.orgs.fees.credit_limit", (v) => money(v)],
    ["lowBalanceThreshold", "x675.bi.lowBalanceAt", (v) => money(v)],
  ];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm">{t("x675.bi.rates")}</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onEditRates}>{t("owner.orgs.editRates")}</Button>
            <Button size="sm" variant="outline" onClick={onAdjust}>{t("x675.adjustBalance")}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("owner.orgs.balance")}</dt>
              <dd className="font-medium tabular-nums">{money(billing.balance)}</dd>
            </div>
            {FIELDS.map(([k, label, fmt]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{t(label)}</dt>
                <dd className="font-medium tabular-nums">{billing[k] != null && billing[k] !== "" ? fmt(billing[k]) : "—"}</dd>
              </div>
            ))}
            {!isMain && (
              <>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("x665.owner.type")}</dt>
                  <dd className="font-medium">{RISK_KEY[tfnRisk] ? t(RISK_KEY[tfnRisk]) : t("x665.type.none")}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">{t("x655.callLimit")}</dt>
                  <dd className="font-medium tabular-nums">{callLimit || t("x675.bi.noLimit")}</dd>
                </div>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("x675.bi.transactions")}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("x675.lu.when")}</TableHead>
                <TableHead>{t("x675.bi.type")}</TableHead>
                <TableHead>{t("x675.bi.description")}</TableHead>
                <TableHead className="text-right">{t("owner.orgs.amount")}</TableHead>
                <TableHead className="text-right">{t("x675.bi.balanceAfter")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows === null && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">…</TableCell>
                </TableRow>
              )}
              {rows?.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
                    {t("x675.bi.empty")}
                  </TableCell>
                </TableRow>
              )}
              {rows?.map((r) => (
                <TableRow key={r.id} className={r.status === "completed" ? "" : "opacity-60"}>
                  <TableCell className="text-xs">{formatLocalDateTime(r.at)}</TableCell>
                  <TableCell className="text-xs capitalize">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="max-w-[360px] truncate text-xs" title={r.description}>{r.description || "—"}</TableCell>
                  <TableCell className={cn("text-right tabular-nums", Number(r.amount) < 0 && "text-red-600 dark:text-red-400")}>
                    {money(r.amount, 4)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.balanceAfter)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

/**
 * CH-675: the account page's tabs - Overview, Traffic, Numbers, Caller & TFN
 * lookup, Users, Billing. Owner only; every figure comes from
 * /api/owner/organizations/{id}/... and /api/owner/lookup (no invented
 * values: a figure the server did not send shows "—").
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";

import { errText } from "@/components/owner/org-actions";
import {
  Pill,
  SectionHead,
  StatStrip,
  StatTile,
  dateTime,
  fullDate,
  money,
  rateText,
  runwayText,
  shortDate,
  type Health,
} from "@/components/owner/org-format";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";

type T = (k: string) => string;

/** A bordered panel, as on the design. */
const BOX = "overflow-hidden rounded-xl border bg-card shadow-sm";
const TH = "text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground";
const MONO = "font-mono text-[13px] tabular-nums";
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
  const step = (label: string, value: number, sub: string | null, green?: boolean) => (
    <div className="min-w-0 flex-1 rounded-lg border bg-background/40 px-4 py-4">
      <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={cn("mt-1 font-mono text-2xl font-semibold tabular-nums", green && "text-emerald-600 dark:text-emerald-400")}>
        {value}
      </div>
      <div className="mt-0.5 text-xs text-muted-foreground">{sub ?? "\u00a0"}</div>
    </div>
  );
  const link = <div aria-hidden className="mx-auto h-4 w-px shrink-0 self-center bg-border md:h-px md:w-9" />;
  return (
    <div className="space-y-4">
      <StatStrip>
        <StatTile
          label={t("owner.orgs.balance")}
          value={money(data.balance)}
          tone="green"
          sub={
            data.runwayMinutes != null
              ? `${runwayText(data.runwayMinutes)} ${fill(t, "x675.ov.leftAt", rateText(data.perMinuteRate))}`
              : "—"
          }
        />
        <StatTile label={t("x675.ov.liveNow")} value={data.liveNow} sub={t("x675.ov.inProgress")} tone="green" />
        <StatTile
          label={t("owner.orgs.callsToday")}
          value={data.callsToday}
          sub={fill(t, "x675.ov.tfnsLive", data.tfnsWithCallsToday)}
          tone="blue"
        />
        <StatTile
          label={t("owner.orgs.revenueToday")}
          value={money(data.revenueToday)}
          sub={data.markupPercent != null ? fill(t, "x675.ov.markup", `${Number(data.markupPercent)}%`) : "—"}
        />
        <StatTile label={t("owner.orgs.users")} value={data.users} sub={t("x675.ov.logins")} />
      </StatStrip>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={BOX}>
          <SectionHead title={t("x675.ov.flowTitle")} sub={t("x675.ov.flowSub")} />
          <div className="flex flex-col items-stretch p-5 md:flex-row">
            {step(t("x675.ov.fromPublishers"), f.fromPublishers, t("x675.ov.intoTfns"))}
            {link}
            {step(t("x675.ov.routed"), f.routedToBuyers, forwarded != null ? fill(t, "x675.ov.forwarded", forwarded) : null)}
            {link}
            {step(t("x675.ov.connected"), f.connected, answered != null ? fill(t, "x675.ov.answered", answered) : null, true)}
          </div>
        </div>

        <div className={BOX}>
          <SectionHead title={t("x675.ov.checksTitle")} sub={t("x675.ov.checksSub")} />
          {data.checks.length === 0 ? (
            <p className="flex items-center gap-2 px-5 py-4 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-emerald-500" /> {t("x675.ov.allClear")}
            </p>
          ) : (
            <div className="divide-y border-b">
              {data.checks.map((c) => (
                <div key={c.code} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <div className="text-sm">{c.title}</div>
                    <div className="text-xs text-muted-foreground">{c.detail}</div>
                  </div>
                  <Pill tone={c.level === "action" ? "red" : undefined}>
                    {c.level === "action" ? t("x675.ov.action") : t("x675.ov.info")}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
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
  const [rows, setRows] = useState<TrafficRow[] | null>(null);

  useEffect(() => {
    let live = true;
    setRows(null);
    http
      .get<{ rows: TrafficRow[] }>(`/api/owner/organizations/${orgId}/traffic?date=${todayIso()}`)
      .then((r) => live && setRows(r.rows))
      .catch((e) => {
        if (live) setRows([]);
        toast.error(errText(e));
      });
    return () => {
      live = false;
    };
  }, [orgId]);

  const dash = (s: string) => s || "—";
  const cell = "py-4";

  return (
    <div className={BOX}>
      <SectionHead title={t("x675.tr.title")} sub={t("x675.tr.subtitle")} />
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(TH, "pl-5")}>{t("x675.tr.campaign")}</TableHead>
            <TableHead className={TH}>{t("x675.tr.publisher")}</TableHead>
            <TableHead className={cn(TH, "text-right")}>{t("x675.tr.callsIn")}</TableHead>
            <TableHead className={cn(TH, "pl-8")}>{t("x675.tr.buyer")}</TableHead>
            <TableHead className={cn(TH, "text-right")}>{t("x675.tr.callsOut")}</TableHead>
            <TableHead className={cn(TH, "text-right")}>{t("x675.ov.connected")}</TableHead>
            <TableHead className={cn(TH, "text-right")}>{t("x675.tr.minutes")}</TableHead>
            <TableHead className={cn(TH, "pr-5 text-right")}>{t("x675.tr.spend")}</TableHead>
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
              <TableCell className={cn("text-left", cell, MONO, "pl-5")}>{dash(r.campaign)}</TableCell>
              <TableCell className={cn("text-left", cell, MONO)}>{dash(r.publisher)}</TableCell>
              <TableCell className={cn(cell, MONO, "text-right")}>{r.callsIn}</TableCell>
              <TableCell className={cn("text-left", cell, MONO, "pl-8")}>{dash(r.buyer)}</TableCell>
              <TableCell className={cn(cell, MONO, "text-right")}>{r.callsOut}</TableCell>
              <TableCell className={cn(cell, MONO, "text-right")}>{r.connected}</TableCell>
              <TableCell className={cn(cell, MONO, "text-right")}>{r.minutes}</TableCell>
              <TableCell className={cn(cell, MONO, "pr-5 text-right")}>{money(r.spend)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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
/** "High" / "Low" - the Risk column already says Risk. */
const RISK_SHORT: Record<string, string> = { high: "x675.nu.high", low: "x675.nu.low" };

export function SourceBadge({ source, t }: { source: string; t: T }) {
  return source === "avortyx" ? <Pill tone="green">{t("x675.nu.onAvortyx")}</Pill> : <Pill>{t("x675.nu.own")}</Pill>;
}

const STATE_KEY: Record<string, string> = {
  live: "x675.nu.live",
  expired: "x675.nu.expired",
  released: "x675.nu.released",
  pending: "x675.nu.pending",
};

export function StateBadge({ state, t }: { state: string; t: T }) {
  const tone = state === "live" ? "green" : state === "expired" ? "red" : undefined;
  return <Pill tone={tone}>{STATE_KEY[state] ? t(STATE_KEY[state]) : state}</Pill>;
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

  const cell = "py-4";
  return (
    <div className={BOX}>
      <SectionHead
        title={t("x675.nu.title")}
        sub={t("x675.nu.subtitle")}
        right={
          data && (
            <span
              className="shrink-0 rounded-md border px-2.5 py-1 text-xs text-muted-foreground"
              title={fill(t, "x675.nu.liveCount", data.live)}
            >
              {fill(t, "x675.nu.count", data.count)}
            </span>
          )
        }
      />
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(TH, "pl-5")}>{t("x675.nu.tfn")}</TableHead>
            <TableHead className={TH}>{t("x675.nu.source")}</TableHead>
            <TableHead className={TH}>{t("x675.nu.risk")}</TableHead>
            <TableHead className={TH}>{t("x675.tr.campaign")}</TableHead>
            <TableHead className={cn(TH, "text-right")}>{t("owner.orgs.callsToday")}</TableHead>
            <TableHead className={cn(TH, "pl-8")}>{t("owner.orgs.status")}</TableHead>
            <TableHead className={cn(TH, "pr-5 text-right")}>{t("x675.nu.added")}</TableHead>
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
            <TableRow key={n.id}>
              <TableCell className={cn("text-left", cell, MONO, "pl-5")}>{n.number}</TableCell>
              <TableCell className={cn("text-left", cell)}>
                <SourceBadge source={n.source} t={t} />
              </TableCell>
              <TableCell className={cn("text-left", cell, "text-sm", !RISK_SHORT[n.risk] && "text-muted-foreground")}>
                {RISK_SHORT[n.risk] ? t(RISK_SHORT[n.risk]) : "—"}
              </TableCell>
              <TableCell className={cn("text-left", cell, MONO)}>{n.campaign || "—"}</TableCell>
              <TableCell className={cn(cell, MONO, "text-right")}>{n.callsToday}</TableCell>
              <TableCell className={cn("text-left", cell, "pl-8")}>
                <StateBadge state={n.state} t={t} />
              </TableCell>
              <TableCell className={cn(cell, MONO, "pr-5 text-right")}>{shortDate(n.added)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
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

  const box = (label: string, value: React.ReactNode, mono?: boolean) => (
    <div className="min-w-0 px-4 py-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("mt-0.5 truncate text-sm font-medium", mono && "font-mono tabular-nums")}>{value}</div>
    </div>
  );
  const grid = "grid grid-cols-2 border-b md:grid-cols-4 [&>*]:border-r md:[&>*:last-child]:border-r-0";

  return (
    <div className={BOX}>
      <div className="px-5 pt-4">
        <div className="text-sm font-semibold">{t("x675.lu.title")}</div>
        <div className="mt-0.5 text-xs text-muted-foreground">{t("x675.lu.subtitle")}</div>
      </div>
      <div className="space-y-3 p-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void check();
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="+18888914875" className="pl-8 font-mono" inputMode="tel" />
          </div>
          <Button type="submit" disabled={busy || !q.trim()}>
            {t("x675.lu.check")}
          </Button>
        </form>

        {res && !res.found && (
          <div className="rounded-lg border px-4 py-5 text-center text-sm text-muted-foreground">
            {res.error ?? fill(t, "x675.lu.notFound", res.number)}
          </div>
        )}

        {res?.tfn && (
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
              <div>
                <div className="text-xs text-muted-foreground">{t("x675.nu.tfn")}</div>
                <div className="mt-0.5 font-mono text-base">{res.tfn.number}</div>
              </div>
              <SourceBadge source={res.tfn.source} t={t} />
            </div>
            <div className={grid}>
              {box(t("x675.lu.account"), res.tfn.account)}
              {box(t("x675.tr.campaign"), res.tfn.campaign || "—", true)}
              {box(t("x675.lu.totalCalls"), res.tfn.totalCalls, true)}
              {box(t("x675.lu.lastSeen"), dateTime(res.tfn.lastCall), true)}
            </div>
            <p className="px-4 py-3 text-[13px] text-muted-foreground">
              {[
                <>
                  {t("x675.lu.firstSeen")} <span className="font-mono">{fullDate(res.tfn.firstCall ?? res.tfn.added)}</span>
                </>,
                res.tfn.source === "avortyx" ? t("x675.lu.stock") : t("x675.nu.own"),
                RISK_KEY[res.tfn.risk] ? t(RISK_KEY[res.tfn.risk]) : null,
                res.tfn.state === "live"
                  ? t("x675.nu.live")
                  : `${t(STATE_KEY[res.tfn.state] ?? "x675.nu.released")}${res.tfn.releasedAt ? ` ${shortDate(res.tfn.releasedAt).replace(/ 0(\d)/, " $1")}` : ""}`,
              ]
                .filter(Boolean)
                .map((x, i) => (
                  <span key={i}>
                    {i > 0 && " · "}
                    {x}
                  </span>
                ))}
            </p>
          </div>
        )}

        {res?.caller && (
          <div className="overflow-hidden rounded-lg border">
            <div className="border-b px-4 py-3">
              <div className="text-xs text-muted-foreground">{t("x675.lu.callerId")}</div>
              <div className="mt-0.5 font-mono text-base">{res.number}</div>
            </div>
            <div className={grid}>
              {box(
                t("x675.lu.accounts"),
                res.caller.byAccount.map((a) => `${a.account} (${a.calls})`).join(", ") || "—",
              )}
              {box(t("x675.lu.totalCalls"), res.caller.totalCalls, true)}
              {box(t("x675.lu.firstSeen"), dateTime(res.caller.firstCall), true)}
              {box(t("x675.lu.lastSeen"), dateTime(res.caller.lastCall), true)}
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className={cn(TH, "pl-4")}>{t("x675.lu.when")}</TableHead>
                  <TableHead className={TH}>{t("x675.lu.account")}</TableHead>
                  <TableHead className={TH}>{t("x675.nu.tfn")}</TableHead>
                  <TableHead className={TH}>{t("x675.tr.campaign")}</TableHead>
                  <TableHead className={TH}>{t("x675.tr.buyer")}</TableHead>
                  <TableHead className={TH}>{t("owner.orgs.status")}</TableHead>
                  <TableHead className={cn(TH, "pr-4 text-right")}>{t("x675.lu.seconds")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {res.caller.recent.map((c, i) => (
                  <TableRow key={`${c.at}-${i}`}>
                    <TableCell className={cn("text-left", MONO, "pl-4 text-xs")}>{dateTime(c.at)}</TableCell>
                    <TableCell className="text-left">{c.account}</TableCell>
                    <TableCell className={cn("text-left", MONO)}>{c.tfn || "—"}</TableCell>
                    <TableCell className={cn("text-left", MONO)}>{c.campaign || "—"}</TableCell>
                    <TableCell className={cn("text-left", MONO)}>{c.buyer || "—"}</TableCell>
                    <TableCell className="text-left text-xs">{c.status}</TableCell>
                    <TableCell className={cn(MONO, "pr-4 text-right")}>{c.duration}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        <p className="text-xs text-muted-foreground">{t("x675.lu.hint")}</p>
      </div>
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
    <div className={BOX}>
      <div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(TH, "pl-5")}>{t("x675.us.user")}</TableHead>
              <TableHead className={TH}>{t("x675.us.role")}</TableHead>
              <TableHead className={TH}>{t("owner.orgs.status")}</TableHead>
              <TableHead className={TH}>{t("x675.us.twoFa")}</TableHead>
              <TableHead className={TH}>{t("x675.us.lastLogin")}</TableHead>
              <TableHead className={cn(TH, "pr-5 text-right")}>{t("x675.us.joined")}</TableHead>
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
                <TableCell className="text-left py-3 pl-5">
                  <div className="font-medium">{u.name || u.email}</div>
                  {u.name && <div className="text-xs text-muted-foreground">{u.email}</div>}
                </TableCell>
                <TableCell className="text-left capitalize">{u.role}</TableCell>
                <TableCell className="text-left">
                  {u.isActive ? t("owner.orgs.active") : t("x675.us.inactive")}
                </TableCell>
                <TableCell className="text-left">
                  {u.mfaEnabled ? <Pill tone="green">{t("x675.us.on")}</Pill> : <Pill>{t("x675.us.off")}</Pill>}
                </TableCell>
                <TableCell className={cn("text-left", MONO, "text-xs")}>{u.lastLogin ? dateTime(u.lastLogin) : t("x675.us.never")}</TableCell>
                <TableCell className={cn(MONO, "pr-5 text-right text-xs")}>{shortDate(u.dateJoined)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
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
      <div className={BOX}>
        <SectionHead
          title={t("x675.bi.rates")}
          right={
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={onEditRates}>{t("owner.orgs.editRates")}</Button>
              <Button size="sm" variant="outline" onClick={onAdjust}>{t("x675.adjustBalance")}</Button>
            </div>
          }
        />
        <div className="px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm md:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{t("owner.orgs.balance")}</dt>
              <dd className="font-mono font-medium tabular-nums">{money(billing.balance)}</dd>
            </div>
            {FIELDS.map(([k, label, fmt]) => (
              <div key={k}>
                <dt className="text-xs text-muted-foreground">{t(label)}</dt>
                <dd className="font-mono font-medium tabular-nums">{billing[k] != null && billing[k] !== "" ? fmt(billing[k]) : "—"}</dd>
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
                  <dd className="font-mono font-medium tabular-nums">{callLimit || t("x675.bi.noLimit")}</dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>

      <div className={BOX}>
        <SectionHead title={t("x675.bi.transactions")} />
        <div>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className={cn(TH, "pl-5")}>{t("x675.lu.when")}</TableHead>
                <TableHead className={TH}>{t("x675.bi.type")}</TableHead>
                <TableHead className={TH}>{t("x675.bi.description")}</TableHead>
                <TableHead className={cn(TH, "text-right")}>{t("owner.orgs.amount")}</TableHead>
                <TableHead className={cn(TH, "pr-5 text-right")}>{t("x675.bi.balanceAfter")}</TableHead>
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
                  <TableCell className={cn("text-left", MONO, "pl-5 text-xs")}>{dateTime(r.at)}</TableCell>
                  <TableCell className="text-left text-xs capitalize">{r.type.replace(/_/g, " ")}</TableCell>
                  <TableCell className="text-left max-w-[360px] truncate text-xs" title={r.description}>{r.description || "—"}</TableCell>
                  <TableCell className={cn(MONO, "text-right", Number(r.amount) < 0 && "text-red-600 dark:text-red-400")}>
                    {money(r.amount, 4)}
                  </TableCell>
                  <TableCell className={cn(MONO, "pr-5 text-right")}>{money(r.balanceAfter)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

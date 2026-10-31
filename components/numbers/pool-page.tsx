"use client";

/* CH-461: the number pool page - Sir's design (header, figures, Numbers
 * table with Pull / Restore, Install card, Calls by source, Spam protection,
 * Landers and Calls tabs). Figures come from the server (CH-460). */

import * as React from "react";
import { Copy, Loader2, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Can } from "@/components/shared/can";
import {
  CAPTURE_OPTIONS,
  clock,
  NumberStatePill,
  poolSnippet,
  PoolStatusPill,
  ProtectionFields,
  useAgo,
  useSeconds,
} from "@/components/numbers/pool-design";
import { useTranslation } from "@/hooks/use-translation";
import { DEFAULT_PROTECTION, poolsService } from "@/lib/api/services/numbers.service";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { formatNumber } from "@/lib/format";
import { LocalName } from "@/lib/i18n/local-name";
import type { NumberPool, PoolCall, PoolLander, PoolNumberState, PoolProtection } from "@/lib/types";

const DASH = "—";

/* ─── Header ─────────────────────────────────────────────────────────── */

export function PoolHeader({ pool, onPause, onEdit }: { pool: NumberPool; onPause: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const secs = useSeconds();
  const d = pool.design;
  const parts = [
    pool.campaignName ? t("x461.header.campaign").replace("{name}", pool.campaignName) : t("x461.header.noCampaign"),
    pool.country || "US",
    t("x461.header.idle").replace("{v}", secs(pool.idleTimeSec ?? 300)),
    t("x461.header.closed").replace("{v}", secs(pool.closedBrowserDelaySec ?? 30)),
    t("x461.header.cooldown").replace("{v}", secs(d?.cooldownSeconds ?? 120)),
  ];
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight"><LocalName name={pool.name} /></h1>
          <PoolStatusPill status={d?.statusLabel ?? (pool.active ? "active" : "paused")} />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{parts.join(" · ")}</p>
      </div>
      <Can area="number-pools" action="edit">
        <div className="flex gap-2">
          <Button variant="outline" onClick={onPause}>{pool.active ? t("x461.pausePool") : t("x461.activatePool")}</Button>
          <Button onClick={onEdit}>{t("x461.editSettings")}</Button>
        </div>
      </Can>
    </div>
  );
}

/* ─── KPI row ────────────────────────────────────────────────────────── */

export function PoolKpis({ pool }: { pool: NumberPool }) {
  const { t } = useTranslation();
  const d = pool.design;
  const total = pool.numberCount ?? 0;
  const inUse = pool.stats?.inUse ?? 0;
  const pct = total ? Math.round((inUse / total) * 100) : 0;
  const calls = pool.stats?.callsToday ?? 0;
  const tiles: Array<{ label: string; value: string; sub: string; warn?: boolean }> = [
    { label: t("x461.kpi.inUse"), value: `${inUse} / ${total}`, sub: t("x461.kpi.inUseSub").replace("{pct}", String(pct)) },
    { label: t("x461.kpi.impressions"), value: d ? formatNumber(d.impressionsToday) : DASH, sub: t("x461.kpi.today") },
    {
      label: t("x461.kpi.calls"),
      value: formatNumber(calls),
      sub: t("x461.kpi.attributed").replace("{n}", formatNumber(d?.attributedToday ?? 0)),
    },
    {
      label: t("x461.kpi.misses"),
      value: d ? formatNumber(d.missesToday) : DASH,
      sub: t("x461.kpi.missesSub"),
      warn: (d?.missesToday ?? 0) > 0,
    },
  ];
  return (
    <Card className="grid grid-cols-2 divide-border p-0 md:grid-cols-4 md:divide-x">
      {tiles.map((x) => (
        <div key={x.label} className="px-5 py-4">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{x.label}</div>
          <div className={`mt-1.5 font-mono text-2xl tabular-nums ${x.warn ? "text-amber-500" : ""}`}>{x.value}</div>
          <div className="mt-1 text-xs text-muted-foreground">{x.sub}</div>
        </div>
      ))}
    </Card>
  );
}

/* ─── Numbers table ──────────────────────────────────────────────────── */

const FILTERS: Array<PoolNumberState | "all"> = ["all", "in_use", "available", "cooling", "quarantined"];

export function PoolNumbersCard({ pool, onChanged }: { pool: NumberPool; onChanged: () => void }) {
  const { t } = useTranslation();
  const [filter, setFilter] = React.useState<PoolNumberState | "all">("all");
  const [busy, setBusy] = React.useState("");
  const rows = pool.design?.numberRows ?? [];
  const count = (f: PoolNumberState | "all") => (f === "all" ? rows.length : rows.filter((r) => r.state === f).length);
  const shown = filter === "all" ? rows : rows.filter((r) => r.state === filter);

  const setStatus = async (numberId: string, status: "quarantined" | "available") => {
    setBusy(numberId);
    try {
      await poolsService.setNumberStatus(pool.id, numberId, status, status === "quarantined" ? t("x461.numbers.pulledByHand") : "");
      toast.success(status === "quarantined" ? t("x461.numbers.pulled") : t("x461.numbers.restored"));
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="min-w-0">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{t("x461.numbers.heading")}</h2>
        <div className="flex rounded-md border border-border p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded px-2.5 py-1 text-xs ${filter === f ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {f === "all" ? t("x461.filter.all") : t(`x461.state.${f}`)}
              <span className="ml-1 text-muted-foreground">{count(f)}</span>
            </button>
          ))}
        </div>
      </div>
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 text-left">{t("x461.col.number")}</TableHead>
                <TableHead className="text-left">{t("x461.col.state")}</TableHead>
                <TableHead className="text-left">{t("x461.col.shownTo")}</TableHead>
                <TableHead className="text-left">{t("x461.col.heldFor")}</TableHead>
                <TableHead className="text-right">{t("x461.col.callsToday")}</TableHead>
                <TableHead className="pr-4 text-right">{t("x461.col.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">
                    {rows.length === 0 ? t("x456.empty") : t("trafficUI.common.noData")}
                  </TableCell>
                </TableRow>
              ) : (
                shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="pl-4 text-left font-mono text-xs tabular-nums">{r.display}</TableCell>
                    <TableCell className="text-left"><NumberStatePill state={r.state} /></TableCell>
                    <TableCell className="text-left text-xs">{r.shownTo || DASH}</TableCell>
                    <TableCell className="text-left font-mono text-xs tabular-nums text-muted-foreground">{clock(r.heldForSec)}</TableCell>
                    <TableCell className="text-right font-mono text-xs tabular-nums">{r.callsToday}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <Can area="number-pools" action="edit">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-7 px-2.5 text-xs"
                          disabled={busy === r.id}
                          onClick={() => setStatus(r.id, r.state === "quarantined" ? "available" : "quarantined")}
                        >
                          {r.state === "quarantined" ? t("x461.numbers.restore") : t("x461.numbers.pull")}
                        </Button>
                      </Can>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

/* ─── Right column ───────────────────────────────────────────────────── */

export function InstallCard({ pool }: { pool: NumberPool }) {
  const { t } = useTranslation();
  const ago = useAgo();
  const key = pool.design?.publicKey ?? "";
  const snippet = key ? poolSnippet(key) : "";
  const seen = pool.design?.snippetSeenAt;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("x461.install.onPage")}</h3>
        <Button
          variant="outline"
          size="sm"
          className="h-7 px-2.5 text-xs"
          disabled={!snippet}
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(snippet);
              toast.success(t("x461.snippetCopied"));
            } catch {
              toast.error(t("trafficUI.common.copyFailed"));
            }
          }}
        >
          <Copy className="mr-1.5 h-3 w-3" />
          {t("trafficUI.common.copy")}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{t("x461.install.paste")}</p>
      <pre className="mt-3 overflow-auto whitespace-pre-wrap break-all rounded-md border border-border bg-secondary/30 p-3 font-mono text-[11px]">
        {snippet || DASH}
      </pre>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${seen ? "bg-emerald-500" : "bg-amber-500"}`} />
        {seen
          ? t("x461.install.seen").replace("{host}", pool.design?.snippetSeenHost || "").replace("{ago}", ago(seen))
          : t("x461.install.waiting")}
      </div>
    </Card>
  );
}

export function CallsBySourceCard({ pool }: { pool: NumberPool }) {
  const { t } = useTranslation();
  const rows = pool.design?.callsBySource ?? [];
  const max = Math.max(1, ...rows.map((r) => r.calls));
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold">{t("x461.bySource.title")}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">{t("x461.bySource.none")}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((r) => (
            <div key={r.source}>
              <div className="flex justify-between text-xs">
                <span>{r.source === "Not attributed" ? t("x461.bySource.notAttributed") : r.source}</span>
                <span className="font-mono tabular-nums">{r.calls}</span>
              </div>
              <div className="mt-1 h-1 rounded-full bg-muted">
                <div
                  className={`h-1 rounded-full ${r.source === "Not attributed" ? "bg-muted-foreground" : "bg-foreground"}`}
                  style={{ width: `${Math.round((r.calls / max) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export function SpamCard({ pool, onEdit }: { pool: NumberPool; onEdit: () => void }) {
  const { t } = useTranslation();
  const s = pool.design?.spam;
  const line = (label: string, n: number | undefined, warn = false) => (
    <div className="flex justify-between py-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-mono tabular-nums ${warn && (n ?? 0) > 0 ? "text-amber-500" : ""}`}>{n ?? 0}</span>
    </div>
  );
  return (
    <Card className="p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t("x461.spam.title")}</h3>
        <Can area="number-pools" action="edit">
          <button type="button" onClick={onEdit} className="text-xs text-muted-foreground hover:text-foreground">
            {t("x461.edit")}
          </button>
        </Can>
      </div>
      {line(t("x461.spam.repeat"), s?.repeatCallersBlocked)}
      {line(t("x461.spam.silent"), s?.silentCallersBlocked)}
      {line(t("x461.spam.flood"), s?.numbersPulledForFlooding, true)}
      {line(t("x461.spam.complaints"), s?.complaints)}
    </Card>
  );
}

/* ─── Landers tab ────────────────────────────────────────────────────── */

export function LandersPanel({ pool, onChanged }: { pool: NumberPool; onChanged: () => void }) {
  const { t } = useTranslation();
  const ago = useAgo();
  const [landers, setLanders] = React.useState<PoolLander[]>(pool.design?.landers ?? []);
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState("");

  const load = React.useCallback(async () => {
    try {
      setLanders(await poolsService.landers(pool.id));
    } catch {
      /* keep the list */
    }
  }, [pool.id]);
  React.useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      await load();
      onChanged();
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="space-y-4">
      <Can area="number-pools" action="edit">
        <div className="flex gap-2">
          <Input placeholder="https://bing-landing.com/offer" value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button
            disabled={!url.trim() || busy === "add"}
            onClick={() => run("add", async () => {
              await poolsService.addLander(pool.id, url.trim());
              setUrl("");
            })}
          >
            {busy === "add" && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t("x461.lander.addScan")}
          </Button>
        </div>
      </Can>
      {landers.length === 0 && <p className="text-xs text-muted-foreground">{t("x461.lander.noneYet")}</p>}
      {landers.map((l) => (
        <Card key={l.id} className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
            <div className="min-w-0">
              <div className="truncate font-mono text-xs">{l.url}</div>
              <div className="mt-0.5 text-[11px] text-muted-foreground">
                {l.scanError
                  ? l.scanError
                  : t("x461.lander.foundCount").replace("{n}", String(l.found.length))}
                {" · "}
                {l.snippetSeenAt ? t("x461.lander.seenAgo").replace("{ago}", ago(l.snippetSeenAt)) : t("x461.lander.notSeen")}
              </div>
            </div>
            <Can area="number-pools" action="edit">
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="h-7 px-2.5 text-xs" disabled={busy === l.id}
                  onClick={() => run(l.id, () => poolsService.rescanLander(l.id))}>
                  <RefreshCw className="mr-1.5 h-3 w-3" />
                  {t("x461.lander.rescan")}
                </Button>
                <Can area="number-pools" action="delete">
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    aria-label={t("x461.remove")}
                    onClick={() => run(l.id, () => poolsService.removeLander(l.id))}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </Can>
              </div>
            </Can>
          </div>
          {l.found.map((f, i) => (
            <label key={`${f.number}-${i}`} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
              <Checkbox
                checked={l.swap.includes(f.number)}
                onCheckedChange={() => {
                  const swap = l.swap.includes(f.number) ? l.swap.filter((x) => x !== f.number) : [...l.swap, f.number];
                  void run(l.id, () => poolsService.setLanderSwap(l.id, swap));
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm">{t(`x461.where.${f.label.replace(/\s+/g, "")}`)}</div>
                <div className="truncate font-mono text-[11px] text-muted-foreground">{f.where}</div>
              </div>
              <span className="font-mono text-xs tabular-nums">{f.display}</span>
            </label>
          ))}
        </Card>
      ))}
      <p className="text-[11px] text-muted-foreground">{t("x461.lander.checkedNote")}</p>
    </div>
  );
}

/* ─── Calls tab ──────────────────────────────────────────────────────── */

export function CallsPanel({ poolId }: { poolId: string }) {
  const { t } = useTranslation();
  const [rows, setRows] = React.useState<PoolCall[] | null>(null);
  React.useEffect(() => {
    let stop = false;
    poolsService.calls(poolId, 200).then((r) => !stop && setRows(r)).catch(() => !stop && setRows([]));
    return () => {
      stop = true;
    };
  }, [poolId]);
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-4 text-left">{t("x461.calls.time")}</TableHead>
              <TableHead className="text-left">{t("x461.calls.caller")}</TableHead>
              <TableHead className="text-left">{t("x461.col.number")}</TableHead>
              <TableHead className="text-left">{t("x461.calls.source")}</TableHead>
              <TableHead className="text-right">{t("x461.calls.duration")}</TableHead>
              <TableHead className="pr-4 text-left">{t("x461.calls.result")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows === null ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-muted-foreground" /></TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={6} className="py-8 text-center text-xs text-muted-foreground">{t("x461.calls.none")}</TableCell>
              </TableRow>
            ) : (
              rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="pl-4 text-left font-mono text-xs tabular-nums">{new Date(c.startedAt).toLocaleString()}</TableCell>
                  <TableCell className="text-left font-mono text-xs tabular-nums">{c.caller || t("x461.calls.anonymous")}</TableCell>
                  <TableCell className="text-left font-mono text-xs tabular-nums">{c.number}</TableCell>
                  <TableCell className="text-left text-xs">{c.source || t("x461.bySource.notAttributed")}</TableCell>
                  <TableCell className="text-right font-mono text-xs tabular-nums">{c.durationSec === null ? DASH : clock(c.durationSec)}</TableCell>
                  <TableCell className="pr-4 text-left text-xs">
                    {c.blockedReason
                      ? <span className="text-amber-500">{t(`x461.blocked.${c.blockedReason}`)}</span>
                      : t("x461.calls.routed")}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ─── Settings tab: cool-down, captured parameters, spam rules ───────── */

export function DesignSettingsCard({ pool, onSaved }: { pool: NumberPool; onSaved: (p: NumberPool) => void }) {
  const { t } = useTranslation();
  const d = pool.design;
  const [cooldown, setCooldown] = React.useState(d?.cooldownSeconds ?? 120);
  const [capture, setCapture] = React.useState<string[]>(d?.captureParams ?? []);
  const [protection, setProtection] = React.useState<PoolProtection>(d?.protection ?? { ...DEFAULT_PROTECTION });
  const [saving, setSaving] = React.useState(false);
  const key = d?.publicKey;
  React.useEffect(() => {
    if (!d) return;
    setCooldown(d.cooldownSeconds);
    setCapture(d.captureParams);
    setProtection(d.protection);
    // Only when another pool's figures arrive, not on every 30 s refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  if (!d) return null;

  const save = async () => {
    setSaving(true);
    try {
      onSaved(await poolsService.updateDesign(pool.id, { cooldownSeconds: cooldown, captureParams: capture, protection }));
      toast.success(t("x461.saved"));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-foreground">{t("x461.settings.title")}</h3>
      <div className="my-4 h-px w-full bg-border" />
      <div className="flex items-start justify-between gap-4 pb-3">
        <div>
          <div className="text-sm">{t("x461.routing.cooldown")}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">{t("x461.routing.cooldownHint")}</div>
        </div>
        <div className="flex items-center gap-2">
          <Input type="number" min={0} max={3600} className="h-8 w-24 text-right font-mono tabular-nums"
            value={String(cooldown)} onChange={(e) => setCooldown(Math.max(0, Math.min(3600, Number(e.target.value) || 0)))} />
          <span className="w-8 text-xs text-muted-foreground">{t("x461.unit.secShort")}</span>
        </div>
      </div>
      <div className="border-t border-border py-3">
        <div className="text-sm">{t("x461.capture.title")}</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {CAPTURE_OPTIONS.map((c) => {
            const on = capture.includes(c);
            return (
              <button key={c} type="button" onClick={() => setCapture(on ? capture.filter((x) => x !== c) : [...capture, c])}
                className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${on ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}>
                {c}
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">{t("x461.capture.hint")}</p>
      </div>
      <div className="border-t border-border pt-1">
        <div className="pt-3 text-sm font-medium">{t("x461.protection.title")}</div>
        <ProtectionFields value={protection} onChange={setProtection} />
      </div>
      <Can area="number-pools" action="edit">
        <div className="mt-3 flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            {t("x461.save")}
          </Button>
        </div>
      </Can>
    </Card>
  );
}

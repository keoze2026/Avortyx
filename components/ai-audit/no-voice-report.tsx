"use client";

/**
 * CH-650 (Sir, 9 Nov: "Under AI audit push this one, with correct data"): the
 * No Voice report on the AI Audit page, in Sir's layout.
 *
 *  - A headline: who sent the most No Voice calls and their share of all No
 *    Voice, and which rows are above 25% with real volume - with a button that
 *    downloads that row's evidence file.
 *  - Four figures: No Voice today, most No Voice calls, rows above 25%, the
 *    main No Voice type.
 *  - The table per publisher / campaign / buyer / TFN / hour: checked, No Voice,
 *    No Voice %, share of all No Voice, the three No Voice types, Voicemail /
 *    IVR, Robocall, Valid and a status. Robocall is new: those calls were
 *    counted in "checked" but in no column, so the columns did not add up.
 *    Status: above 25% -> "Send evidence" (10+ calls checked) or "Low volume";
 *    10-25% -> "Watch"; below -> "OK".
 *  - Repeat callers, with how many publishers sent them, their No Voice rate,
 *    and buttons to see their calls or block them.
 *  - The evidence file, with one-click files for every publisher above 25%.
 *
 * Every figure comes from /api/ai-audit (breakdown, repeat-callers, evidence).
 */

import * as React from "react";
import { Ban, Download, List, Loader2 } from "lucide-react";
import { toast } from "sonner";

import { DateRangePicker } from "@/components/shared/date-range-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/use-translation";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { downloadRows, type ExportColumn } from "@/lib/export";
import { calendarDayKey, dayKeyToLocalDate } from "@/lib/format";
import { useBlockedNumbersStore } from "@/lib/store/blocked-numbers-store";
import { usePublishersStore } from "@/lib/store/publishers-store";
import { cn } from "@/lib/utils";

export type ReportBy = "publisher" | "campaign" | "buyer" | "tfn" | "hour";
/** A row of the report (or a caller) whose calls the page's list should show. */
export interface CallsScope {
  by: ReportBy | "caller";
  key: string;
  name: string;
}

interface BreakdownRow {
  name: string;
  key: string;
  checked: number;
  noVoice: number;
  noVoicePct: number | null;
  deadCaller: number;
  agentOnly: number;
  agentBeep: number;
  ivr: number;
  robocall: number;
  valid: number;
}

interface RepeatCaller {
  caller: string;
  noVoice: number;
  calls: number;
  publishers: string[];
  campaigns: string[];
  lastCall: string | null;
}

interface EvidenceRow {
  startedAt: string;
  caller: string;
  campaign: string;
  publisher: string;
  buyer: string;
  destination: string;
  talkSeconds: number;
  label: string;
  audioFault: boolean;
  confidence: number | null;
  callerSpeech: number | null;
  agentSpeech: number | null;
  beepSeconds: number | null;
  comment: string;
  recordingUrl: string;
  callId: string;
}

const EVIDENCE_COLUMNS: ExportColumn<EvidenceRow>[] = [
  { label: "Call time (EST)", value: (r) => r.startedAt },
  { label: "Caller ID", value: (r) => r.caller },
  { label: "Campaign", value: (r) => r.campaign },
  { label: "Publisher", value: (r) => r.publisher },
  { label: "Buyer", value: (r) => r.buyer },
  { label: "Destination", value: (r) => r.destination },
  { label: "Talk (s)", value: (r) => r.talkSeconds },
  { label: "AI label", value: (r) => (r.audioFault ? `${r.label} (Possible audio fault)` : r.label) },
  { label: "Confidence %", value: (r) => r.confidence ?? "" },
  { label: "Caller speech (s)", value: (r) => r.callerSpeech ?? "" },
  { label: "Agent speech (s)", value: (r) => r.agentSpeech ?? "" },
  { label: "Beeping (s)", value: (r) => r.beepSeconds ?? "" },
  { label: "AI comment", value: (r) => r.comment },
  { label: "Recording", value: (r) => r.recordingUrl },
  { label: "Call ID", value: (r) => r.callId },
];

/** Above this No Voice %, a row needs evidence; between WATCH and this, watch it. */
const SEND_PCT = 25;
const WATCH_PCT = 10;
/** Fewer calls checked than this: a high % is not yet a pattern. */
const REAL_VOLUME = 10;

type Status = "send" | "low" | "watch" | "ok";
function statusOf(r: BreakdownRow): Status {
  const pct = r.noVoicePct ?? 0;
  if (pct >= SEND_PCT) return r.checked >= REAL_VOLUME ? "send" : "low";
  if (pct >= WATCH_PCT) return "watch";
  return "ok";
}

function pct1(v: number | null | undefined): string {
  return v === null || v === undefined ? "—" : `${v.toFixed(1)}%`;
}

function dayLabel(day: string): string {
  return dayKeyToLocalDate(day).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function timeEst(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

/** Downloads one row's No Voice calls (or all) as the evidence spreadsheet. */
async function downloadEvidence(
  t: (k: string) => string,
  q: { by?: ReportBy; key?: string; name: string; from: string; to: string },
) {
  const r = await http.get<{ count: number; items: EvidenceRow[] }>("/api/ai-audit/evidence", {
    query: { by: q.by || undefined, key: q.by ? q.key : undefined, dateFrom: q.from, dateTo: q.to },
  });
  if (r.count === 0) {
    toast.info(t("x546.evidenceNone"));
    return;
  }
  const stem = `no-voice-evidence-${q.name.replace(/[^A-Za-z0-9-]+/g, "_")}-${q.from}${q.to !== q.from ? `-to-${q.to}` : ""}`;
  downloadRows("xlsx", EVIDENCE_COLUMNS, r.items, stem, "No Voice evidence", {
    boldHeader: true,
    linkColumns: ["Recording"],
  });
  toast.success(t("x546.evidenceDone").replace("{count}", String(r.count)));
}

function useBreakdown(date: string, by: ReportBy) {
  const [items, setItems] = React.useState<BreakdownRow[] | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    http
      .get<{ items: BreakdownRow[] }>("/api/ai-audit/breakdown", { query: { dateFrom: date, dateTo: date, by } })
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [date, by]);
  return items;
}

/* ─── The report ──────────────────────────────────────────────────────── */

export function NoVoiceReport({ date, onCalls }: { date: string; onCalls: (s: CallsScope) => void }) {
  const { t } = useTranslation();
  const [by, setBy] = React.useState<ReportBy>("publisher");
  const [pick, setPick] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const items = useBreakdown(date, by);
  React.useEffect(() => setPick(""), [date, by]);

  const shown = React.useMemo(() => (items && pick ? items.filter((r) => r.name === pick) : items), [items, pick]);

  const sums = React.useMemo(() => {
    const s = { checked: 0, noVoice: 0, dead: 0, agentOnly: 0, agentBeep: 0, ivr: 0, robocall: 0, valid: 0 };
    for (const r of items ?? []) {
      s.checked += r.checked;
      s.noVoice += r.noVoice;
      s.dead += r.deadCaller;
      s.agentOnly += r.agentOnly;
      s.agentBeep += r.agentBeep;
      s.ivr += r.ivr;
      s.robocall += r.robocall;
      s.valid += r.valid;
    }
    return s;
  }, [items]);

  const share = (n: number) => (sums.noVoice ? Math.round((100 * n) / sums.noVoice) : 0);
  const top = React.useMemo(
    () => (items ?? []).filter((r) => r.noVoice > 0).sort((a, b) => b.noVoice - a.noVoice || b.checked - a.checked)[0],
    [items],
  );
  const above = (items ?? []).filter((r) => (r.noVoicePct ?? 0) >= SEND_PCT);
  const toSend = above.filter((r) => r.checked >= REAL_VOLUME);
  const types = [
    { key: "agent_only", n: sums.agentOnly },
    { key: "dead_caller", n: sums.dead },
    { key: "agent_beep", n: sums.agentBeep },
  ].sort((a, b) => b.n - a.n);

  const evidence = async (r: BreakdownRow) => {
    setBusy(r.key || r.name);
    try {
      await downloadEvidence(t, { by, key: r.key, name: r.name, from: date, to: date });
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const tag = (s: Status) => (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap text-xs",
        s === "send" && "text-destructive",
        s === "watch" && "text-foreground",
        (s === "low" || s === "ok") && "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          s === "send" && "bg-destructive",
          s === "watch" && "bg-foreground",
          s === "low" && "border border-muted-foreground",
          s === "ok" && "bg-muted-foreground/60",
        )}
      />
      {t(`x650.status.${s}`)}
    </span>
  );

  const th = "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
  const td = "px-3 py-2.5 tabular-nums";

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        {/* CH-651 (Sir, 9 Nov 11:25 PM: "the bar should be on the right not bottom"):
            the bar keeps a fixed width and stays right of the title on wide
            screens - a long name in the list no longer pushes it below. */}
        <div className="flex flex-col gap-3 px-4 pt-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            {/* Sir, 9 Nov 10:48 PM: "Green header - add as well". */}
            <span className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {t("x650.live").replace("{date}", dayLabel(date))}
            </span>
            <div className="text-lg font-semibold">{t("x557.title")}</div>
            <div className="text-[13px] text-muted-foreground">{t("x650.desc").replace("{date}", dayLabel(date))}</div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5 self-start rounded-lg border p-1">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              aria-label={t("x613.filter")}
              className="h-7 w-24 truncate rounded-md bg-transparent px-2 text-[13px] text-muted-foreground hover:text-foreground focus:outline-none"
            >
              <option value="">{t("x613.all")}</option>
              {(items ?? []).map((r) => (
                <option key={r.key || r.name} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
            <>
              {(["publisher", "campaign", "buyer", "tfn", "hour"] as const).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBy(b)}
                  className={cn(
                    "whitespace-nowrap rounded-md px-3 py-1 text-[13px]",
                    by === b ? "bg-foreground font-medium text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t(`x557.by.${b}`)}
                </button>
              ))}
            </>
          </div>
        </div>

        {/* Headline */}
        {top && (
          <div className="mx-4 mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-destructive" />
              <span>
                <b>
                  {t("x650.headline")
                    .replace("{name}", top.name)
                    .replace("{n}", String(top.noVoice))
                    .replace("{share}", String(share(top.noVoice)))}
                </b>{" "}
                {toSend.length > 0 && (
                  <span className="text-muted-foreground">
                    {t("x650.headlineAbove").replace("{names}", toSend.map((r) => r.name).join(", "))}
                  </span>
                )}
              </span>
            </div>
            <Button
              size="sm"
              className="shrink-0 bg-foreground text-background hover:bg-foreground/90"
              disabled={busy !== null}
              onClick={() => void evidence(top)}
            >
              {busy === (top.key || top.name) ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {t("x650.sendTo").replace("{name}", top.name)} →
            </Button>
          </div>
        )}

        {/* Four figures */}
        <div className="mt-3 grid grid-cols-2 border-y md:grid-cols-4">
          <div className="border-r px-4 py-3">
            <div className="text-[12px] text-muted-foreground">{t("x650.today")}</div>
            <div className="font-mono text-xl font-semibold">{items ? sums.noVoice : "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              {t("x650.ofChecked").replace("{n}", sums.checked.toLocaleString()).replace(
                "{pct}",
                pct1(sums.checked ? (100 * sums.noVoice) / sums.checked : null),
              )}
            </div>
          </div>
          <div className="border-r px-4 py-3">
            <div className="text-[12px] text-muted-foreground">{t("x650.most")}</div>
            <div className="font-mono text-xl font-semibold">{top?.name ?? "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              {top ? `${t("x650.calls").replace("{n}", String(top.noVoice))} · ${pct1(top.noVoicePct)}` : ""}
            </div>
          </div>
          <div className="border-r px-4 py-3">
            <div className="text-[12px] text-muted-foreground">{t(`x650.above.${by}`)}</div>
            <div className={cn("font-mono text-xl font-semibold", above.length > 0 && "text-destructive")}>
              {items ? above.length : "—"}
            </div>
            <div className="truncate text-[11px] text-muted-foreground">{above.map((r) => r.name).join(" · ")}</div>
          </div>
          <div className="px-4 py-3">
            <div className="text-[12px] text-muted-foreground">{t("x650.mainType")}</div>
            <div className="text-xl font-semibold">{sums.noVoice ? t(`x650.type.${types[0].key}`) : "—"}</div>
            <div className="text-[11px] text-muted-foreground">
              {sums.noVoice ? t("x650.ofNoVoice").replace("{n}", String(types[0].n)).replace("{total}", String(sums.noVoice)) : ""}
            </div>
          </div>
        </div>

        {/* Table */}
        {shown === null ? (
          <div className="p-4">
            <Skeleton className="h-5 w-full" />
          </div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("x557.none")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th rowSpan={2} className={cn(th, "pl-4 text-left")}>{t(`x557.by.${by}`)}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x557.checked")}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x546.noVoice")}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x546.noVoicePct")}</th>
                  <th rowSpan={2} className={cn(th, "border-r text-right")}>{t("x650.share")}</th>
                  <th colSpan={3} className={cn(th, "border-b border-r text-center")}>{t("x650.typeGroup")}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x650.ivr")}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x543.label.robocall")}</th>
                  <th rowSpan={2} className={cn(th, "text-right")}>{t("x543.label.valid")}</th>
                  <th rowSpan={2} className={cn(th, "text-left")}>{t("x650.status")}</th>
                  <th rowSpan={2} className={cn(th, "pr-4")} />
                </tr>
                <tr className="border-b">
                  <th className={cn(th, "text-right")}>{t("x650.type.dead_caller")}</th>
                  <th className={cn(th, "text-right")}>{t("x650.type.agent_only")}</th>
                  <th className={cn(th, "border-r text-right")}>{t("x650.type.agent_beep")}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const s = statusOf(r);
                  const hot = (r.noVoicePct ?? 0) >= SEND_PCT;
                  return (
                    <tr
                      key={r.key || r.name}
                      className={cn("border-b last:border-b-0", hot && "bg-destructive/5 shadow-[inset_2px_0_0_hsl(var(--destructive))]")}
                    >
                      <td className={cn(td, "pl-4 font-mono font-medium")}>{r.name}</td>
                      <td className={cn(td, "text-right")}>{r.checked.toLocaleString()}</td>
                      <td className={cn(td, "text-right", r.noVoice > 0 ? "text-destructive" : "text-muted-foreground")}>
                        {r.noVoice}
                      </td>
                      <td className={td}>
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1 w-14 overflow-hidden rounded bg-muted">
                            <div
                              className={cn("h-full", hot ? "bg-destructive" : "bg-muted-foreground/60")}
                              style={{ width: `${Math.min(100, r.noVoicePct ?? 0)}%` }}
                            />
                          </div>
                          <span className={cn("w-14 text-right", hot && "text-destructive")}>{pct1(r.noVoicePct)}</span>
                        </div>
                      </td>
                      <td className={cn(td, "border-r text-right", !r.noVoice && "text-muted-foreground")}>
                        {share(r.noVoice)}%
                      </td>
                      <td className={cn(td, "text-right", !r.deadCaller && "text-muted-foreground")}>{r.deadCaller}</td>
                      <td className={cn(td, "text-right", !r.agentOnly && "text-muted-foreground")}>{r.agentOnly}</td>
                      <td className={cn(td, "border-r text-right", !r.agentBeep && "text-muted-foreground")}>{r.agentBeep}</td>
                      <td className={cn(td, "text-right", !r.ivr && "text-muted-foreground")}>{r.ivr}</td>
                      <td className={cn(td, "text-right", !r.robocall && "text-muted-foreground")}>{r.robocall}</td>
                      <td className={cn(td, "text-right")}>{r.valid}</td>
                      <td className={td}>
                        {s === "send" ? (
                          <button type="button" onClick={() => void evidence(r)} disabled={busy !== null}>
                            {tag(s)}
                          </button>
                        ) : (
                          tag(s)
                        )}
                      </td>
                      <td className={cn(td, "pr-4")}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            title={t("x650.seeCalls")}
                            aria-label={t("x650.seeCalls")}
                            onClick={() => onCalls({ by, key: r.key, name: r.name })}
                          >
                            <List className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            title={t("x650.evidence")}
                            aria-label={t("x650.evidence")}
                            disabled={busy !== null || r.noVoice === 0}
                            onClick={() => void evidence(r)}
                          >
                            {busy === (r.key || r.name) ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Download className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              {!pick && (
                <tfoot>
                  <tr className="border-t font-semibold">
                    <td className={cn(td, "pl-4")}>{t("x650.total")}</td>
                    <td className={cn(td, "text-right")}>{sums.checked.toLocaleString()}</td>
                    <td className={cn(td, "text-right")}>{sums.noVoice}</td>
                    <td className={cn(td, "text-right")}>
                      {pct1(sums.checked ? (100 * sums.noVoice) / sums.checked : null)}
                    </td>
                    <td className={cn(td, "border-r text-right")}>{sums.noVoice ? "100%" : "0%"}</td>
                    <td className={cn(td, "text-right")}>{sums.dead}</td>
                    <td className={cn(td, "text-right")}>{sums.agentOnly}</td>
                    <td className={cn(td, "border-r text-right")}>{sums.agentBeep}</td>
                    <td className={cn(td, "text-right")}>{sums.ivr}</td>
                    <td className={cn(td, "text-right")}>{sums.robocall}</td>
                    <td className={cn(td, "text-right")}>{sums.valid}</td>
                    <td className={td} />
                    <td className={cn(td, "pr-4")} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Repeat callers ──────────────────────────────────────────────────── */

export function RepeatCallersReport({ date, onCalls }: { date: string; onCalls: (s: CallsScope) => void }) {
  const { t } = useTranslation();
  const [items, setItems] = React.useState<RepeatCaller[] | null>(null);
  const [confirm, setConfirm] = React.useState<string | null>(null);
  const [blocking, setBlocking] = React.useState<string | null>(null);
  const [blocked, setBlocked] = React.useState<Set<string>>(new Set());
  const addBlocked = useBlockedNumbersStore((s) => s.add);

  React.useEffect(() => {
    let cancelled = false;
    setItems(null);
    http
      .get<{ items: RepeatCaller[] }>("/api/ai-audit/repeat-callers", { query: { dateFrom: date, dateTo: date } })
      .then((r) => !cancelled && setItems(r.items))
      .catch(() => !cancelled && setItems([]));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const block = async (caller: string) => {
    if (confirm !== caller) {
      setConfirm(caller);
      return;
    }
    setBlocking(caller);
    try {
      await addBlocked({ number: caller, scope: "number" });
      setBlocked((s) => new Set(s).add(caller));
      toast.success(t("x650.blocked").replace("{number}", caller));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBlocking(null);
      setConfirm(null);
    }
  };

  const th = "px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
  const td = "px-3 py-2.5 tabular-nums";

  return (
    <Card className="mt-4">
      <CardContent className="p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <div className="text-sm font-semibold">{t("x546.repeatTitle")}</div>
            <div className="text-[13px] text-muted-foreground">{t("x650.repeatDesc").replace("{date}", dayLabel(date))}</div>
          </div>
          {items && (
            <span className="rounded-md border px-3 py-1 text-[13px]">
              {t("x650.callers").replace("{n}", String(items.length))}
            </span>
          )}
        </div>
        {items === null ? (
          <div className="p-4">
            <Skeleton className="h-5 w-full" />
          </div>
        ) : items.length === 0 ? (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">{t("x546.repeatNone")}</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className={cn(th, "pl-4 text-left")}>{t("x543.col.caller")}</th>
                  <th className={cn(th, "text-right")}>{t("x546.noVoice")}</th>
                  <th className={cn(th, "text-right")}>{t("x546.allCalls")}</th>
                  <th className={cn(th, "text-right")}>{t("x650.rate")}</th>
                  <th className={cn(th, "text-left")}>{t("x546.publishers")}</th>
                  <th className={cn(th, "text-left")}>{t("x546.campaigns")}</th>
                  <th className={cn(th, "text-right")}>{t("x546.lastCall")}</th>
                  <th className={cn(th, "pr-4")} />
                </tr>
              </thead>
              <tbody>
                {items.map((r) => {
                  const pubs = r.publishers.filter((p) => p !== "-");
                  return (
                    <tr key={r.caller} className="border-b last:border-b-0">
                      <td className={cn(td, "pl-4 font-mono")}>
                        <span className="inline-flex items-center gap-2">
                          {r.caller}
                          {pubs.length > 1 && (
                            <span className="rounded border border-destructive/40 px-1.5 text-[11px] text-destructive">
                              {t("x650.nPublishers").replace("{n}", String(pubs.length))}
                            </span>
                          )}
                        </span>
                      </td>
                      <td className={cn(td, "text-right text-destructive")}>{r.noVoice}</td>
                      <td className={cn(td, "text-right")}>{r.calls}</td>
                      <td className={cn(td, "text-right text-muted-foreground")}>
                        {r.calls ? `${Math.round((100 * r.noVoice) / r.calls)}%` : "—"}
                      </td>
                      <td className={cn(td, "font-mono")}>{r.publishers.join(", ")}</td>
                      <td className={cn(td, "font-mono")}>{r.campaigns.join(", ")}</td>
                      <td className={cn(td, "text-right")}>{r.lastCall ? timeEst(r.lastCall) : "—"}</td>
                      <td className={cn(td, "pr-4")}>
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon"
                            variant="outline"
                            className="h-7 w-7"
                            title={t("x650.seeCalls")}
                            aria-label={t("x650.seeCalls")}
                            onClick={() => onCalls({ by: "caller", key: r.caller, name: r.caller })}
                          >
                            <List className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size={confirm === r.caller ? "sm" : "icon"}
                            variant="outline"
                            className={cn("h-7 text-destructive", confirm === r.caller ? "px-2" : "w-7")}
                            title={t("x650.block")}
                            aria-label={t("x650.block")}
                            disabled={blocking !== null || blocked.has(r.caller)}
                            onClick={() => void block(r.caller)}
                            onBlur={() => confirm === r.caller && blocking === null && setConfirm(null)}
                          >
                            {blocking === r.caller ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : confirm === r.caller ? (
                              t("x650.blockConfirm")
                            ) : (
                              <Ban className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ─── Evidence export ─────────────────────────────────────────────────── */

export function EvidenceExportReport({ date, todayKey }: { date: string; todayKey: string }) {
  const { t } = useTranslation();
  const publishers = usePublishersStore((s) => s.publishers);
  const [publisherId, setPublisherId] = React.useState("");
  const [from, setFrom] = React.useState(date);
  const [to, setTo] = React.useState(date);
  const [busy, setBusy] = React.useState<string | null>(null);
  const byPublisher = useBreakdown(date, "publisher");
  React.useEffect(() => {
    setFrom(date);
    setTo(date);
  }, [date]);
  const sorted = React.useMemo(() => [...publishers].sort((a, b) => a.name.localeCompare(b.name)), [publishers]);
  const quick = (byPublisher ?? []).filter((r) => (r.noVoicePct ?? 0) >= SEND_PCT && r.key);

  const run = async (id: string, name: string, f: string, tt: string) => {
    setBusy(id || "all");
    try {
      await downloadEvidence(t, id ? { by: "publisher", key: id, name, from: f, to: tt } : { name, from: f, to: tt });
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="mt-4">
      <CardContent className="space-y-3 py-4 text-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="mr-auto">
            <div className="font-semibold">{t("x546.evidenceTitle")}</div>
            <div className="text-[13px] text-muted-foreground">{t("x546.evidenceDesc")}</div>
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("x546.publisher")}</span>
            <select
              value={publisherId}
              onChange={(e) => setPublisherId(e.target.value)}
              className="h-8 rounded-md border bg-background px-2"
            >
              <option value="">{t("x546.allPublishers")}</option>
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {t("x546.from")} ~ {t("x546.to")}
            </span>
            <DateRangePicker
              value={{ from: dayKeyToLocalDate(from), to: dayKeyToLocalDate(to) }}
              onChange={(r) => {
                if (!r?.from) return;
                setFrom(calendarDayKey(r.from));
                setTo(calendarDayKey(r.to ?? r.from));
              }}
              today={dayKeyToLocalDate(todayKey)}
              className="hover:bg-muted hover:text-foreground dark:hover:bg-muted/70"
            />
          </div>
          <Button
            size="sm"
            disabled={busy !== null}
            onClick={() =>
              void run(publisherId, sorted.find((p) => p.id === publisherId)?.name ?? "all-publishers", from, to)
            }
          >
            {busy && busy === (publisherId || "all") ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {t("x546.evidenceButton")}
          </Button>
        </div>
        {quick.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">
            <span>{t("x650.quick")}</span>
            {quick.map((r) => (
              <button
                key={r.key}
                type="button"
                disabled={busy !== null}
                onClick={() => void run(r.key, r.name, date, date)}
                className="rounded-md border px-2 py-0.5 font-mono text-foreground hover:bg-muted"
              >
                {r.name} <span className="text-destructive">{r.noVoice}</span>
              </button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

"use client";

/**
 * AI Audit (CH-543, Sir 4 Nov - AI audit upgrade). Main account only: the
 * menu entry is staff-only and the backend (/api/ai-audit/) refuses every
 * buyer and publisher login.
 *
 * One day's answered calls (Eastern), each with:
 *   - "Pending AI check" until our server has listened to it, then Sir's
 *     label: Valid Call / No Voice | Dead Caller / No Voice | No Beep or
 *     Customer / No Voice | Only Agent + Beeping (+ "Possible audio fault"),
 *     with its confidence;
 *   - what each side did: caller and agent speech seconds (recorded apart),
 *     when the caller first spoke, beeping on the caller's line;
 *   - Listen, and Correct / Wrong for the audit team (Wrong asks for the
 *     right label). The AI's accuracy % is worked out from those verdicts.
 *     CH-616 (Sir, 6 Nov: "Only put audit under no voice calls, rest leave
 *     it"): the buttons are on No Voice calls only, and the accuracy % is the
 *     No Voice calls' only. A verdict given earlier on another call still shows.
 *     CH-643 (8 Nov): Valid and Caller spoke calls get the buttons too (the
 *     server's `auditable`), so a No Voice call the AI missed can be marked;
 *     the % counts them and "missed" shows how many.
 * The page updates by itself when a call is checked (live connection, CH-538).
 */

import * as React from "react";
import { Check, Download, Loader2, RefreshCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import {
  EvidenceExportReport,
  NoVoiceReport,
  RepeatCallersReport,
  type CallsScope,
} from "@/components/ai-audit/no-voice-report";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { PageHeader } from "@/components/shared/page-header";
import { RecordingDialog, type RecordingToPlay } from "@/components/reports/recording-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import { http } from "@/lib/api/http";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { calendarDayKey, dayKeyToLocalDate, uiLocaleTag } from "@/lib/format";
import { tFor } from "@/lib/i18n";
import { downloadRows, type ExportColumn } from "@/lib/export";
import { onReportChanged } from "@/lib/report-events";
import { useLocaleStore } from "@/lib/store/locale-store";
import { cn } from "@/lib/utils";

/** Labels a reviewer can pick (Sir's four, Voicemail / IVR - CH-553, and
 *  Robocall / Caller spoke, no issue - CH-555). */
const LABELS = ["valid", "caller_ok", "dead_caller", "agent_only", "agent_beep", "ivr", "robocall"] as const;
type Label = (typeof LABELS)[number];
/** CH-616: the labels the audit team marks Correct / Wrong (No Voice only). */
const AUDIT_LABELS: readonly string[] = ["dead_caller", "agent_only", "agent_beep"];
const FILTERS = [
  "",
  "pending",
  "no_voice",
  "dead_caller",
  "agent_only",
  "agent_beep",
  "ivr",
  "robocall",
  "valid",
  "caller_ok",
  "fault",
  "reviewed",
  "wrong",
] as const;
type Filter = (typeof FILTERS)[number];
const PAGE_SIZE = 50;
const ET = "America/New_York";

interface Row {
  id: string;
  startedAt: string;
  caller: string;
  campaign: string;
  publisher: string;
  buyer: string;
  destination: string;
  duration: number;
  recordingUrl: string;
  aiStatus: "pending" | "checked" | "missing";
  aiLabel: string;
  aiConfidence: number | null;
  aiComment: string;
  /** CH-555: the LLM's one line and the transcript it read. */
  summary?: string;
  transcript?: string;
  audioFault: boolean;
  channels: number | null;
  callerSpeech: number | null;
  agentSpeech: number | null;
  callerFirst: number | null;
  beepSeconds: number | null;
  speech: number | null;
  reviewLabel: string;
  reviewCorrect: boolean | null;
  reviewNote: string;
  reviewedBy: string;
  /** CH-616: true on No Voice calls - the only ones the audit team marks. */
  auditable?: boolean;
}

type Counts = Record<
  "total" | "pending" | "noVoice" | "deadCaller" | "agentOnly" | "agentBeep" | "ivr" | "robocall" | "callerOk" | "valid" | "mixed" | "fault" | "reviewed" | "wrong",
  number
>;

interface Page {
  date: string;
  counts: Counts;
  total: number;
  page: number;
  items: Row[];
}

interface Status {
  accuracy: { reviewed: number; correct: number; percent: number | null; days: number; missed?: number };
  pending: number;
  minSpeechSeconds: number;
  minBeepSeconds: number;
  telegram: boolean;
}

const FILTER_COUNT: Record<Filter, keyof Counts> = {
  "": "total",
  pending: "pending",
  no_voice: "noVoice",
  dead_caller: "deadCaller",
  agent_only: "agentOnly",
  agent_beep: "agentBeep",
  ivr: "ivr",
  robocall: "robocall",
  caller_ok: "callerOk",
  valid: "valid",
  fault: "fault",
  reviewed: "reviewed",
  wrong: "wrong",
};

function todayEst(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ET, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

// CH-656: in the reader's language (下午3:18:34, 15:18:34 ...), not always "PM".
function timeEst(iso: string): string {
  return new Intl.DateTimeFormat(uiLocaleTag(), {
    timeZone: ET,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function mmss(s: number): string {
  const n = Math.max(0, Math.round(s));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}`;
}

// CH-656: the seconds unit in the reader's language too (12.5s, 12,5 с, 12.5秒).
function sec(v: number | null | undefined): string {
  if (typeof v !== "number") return "—";
  return tFor(useLocaleStore.getState().locale, "x656.seconds").replace("{n}", v.toFixed(1));
}

function labelVariant(l: string): React.ComponentProps<typeof Badge>["variant"] {
  if (l === "dead_caller" || l === "agent_only" || l === "agent_beep") return "destructive";
  if (l === "valid") return "default";
  return "secondary";
}

export default function AiAuditPage() {
  const { t } = useTranslation();
  const [date, setDate] = React.useState(todayEst);
  const [filter, setFilter] = React.useState<Filter>("");
  const [page, setPage] = React.useState(1);
  // CH-664: search by caller ID (any part of the number), on the chosen day.
  const [search, setSearch] = React.useState("");
  const [q, setQ] = React.useState("");
  React.useEffect(() => {
    const id = window.setTimeout(() => {
      setQ(search.replace(/\D/g, "").length >= 3 ? search.trim() : "");
      setPage(1);
    }, 400);
    return () => window.clearTimeout(id);
  }, [search]);
  const [data, setData] = React.useState<Page | null>(null);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [wrong, setWrong] = React.useState<{ row: Row; label: Label; note: string; saving: boolean } | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);
  // CH-650: a No Voice report row (or a repeat caller) whose calls the list shows.
  const [scope, setScope] = React.useState<CallsScope | null>(null);
  const listRef = React.useRef<HTMLDivElement>(null);
  const showCalls = React.useCallback((s: CallsScope) => {
    setScope(s);
    setFilter(s.by === "caller" ? "" : "no_voice");
    setPage(1);
    listRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const labelText = React.useCallback((l: string) => t(`x543.label.${l}`), [t]);

  // CH-656: the AI's comment on each call (written in English) in the
  // reader's language, asked for the calls on screen once and remembered.
  // Until it arrives, or if it cannot be had, the English shows.
  const locale = useLocaleStore((st) => st.locale);
  const [comments, setComments] = React.useState<Record<string, string>>({});
  // CH-666: Listen opens the recording in a pop-up (back / forward, speed).
  const [listen, setListen] = React.useState<RecordingToPlay | null>(null);
  React.useEffect(() => setComments({}), [locale]);
  React.useEffect(() => {
    if (locale === "en" || !data) return;
    const ids = data.items.filter((r) => r.summary && !(r.id in comments)).map((r) => r.id);
    if (ids.length === 0) return;
    let cancelled = false;
    http
      .post<{ items: Record<string, string> }>("/api/ai-audit/translate", { body: { lang: locale, ids } })
      .then((res) => {
        if (cancelled) return;
        // Keep a miss as the English, so it is not asked again on every refresh.
        setComments((c) => ({ ...c, ...Object.fromEntries(ids.map((id) => [id, res.items[id] ?? ""])) }));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, locale]);

  // CH-613 (Sir, 6 Nov: "give an option to download this file in Excel with
  // comment like we do reporting"): every call of the day under the tile
  // picked (All, No Voice, ...), not only the page on screen, with the AI's
  // comment, each side's seconds, the team's verdict and the recording link.
  const [exporting, setExporting] = React.useState(false);
  const exportCalls = async () => {
    setExporting(true);
    try {
      const all: Row[] = [];
      for (let p = 1; p <= 100; p++) {
        const r = await http.get<Page>("/api/ai-audit/calls", {
          query: { date, label: filter, page: p, pageSize: 200, by: scope?.by, key: scope?.key, q: q || undefined },
        });
        all.push(...r.items);
        if (r.items.length === 0 || all.length >= r.total) break;
      }
      if (all.length === 0) {
        toast.info(t("x613.none"));
        return;
      }
      const label = (r: Row) =>
        r.aiStatus === "checked"
          ? labelText(r.aiLabel) + (r.audioFault ? ` (${t("x613.fault")})` : "")
          : r.aiStatus === "pending" ? t("x543.pending") : t("x543.noFile");
      const audit = (r: Row) =>
        r.reviewCorrect === true ? t("x613.correct")
          : r.reviewCorrect === false ? `${t("x613.wrong")}: ${labelText(r.reviewLabel)}` : "";
      const columns: ExportColumn<Row>[] = [
        { label: "DATE (EST)", value: (r) => `${date} ${timeEst(r.startedAt)}` },
        { label: "CALLER ID", value: (r) => r.caller },
        { label: "CAMPAIGN", value: (r) => r.campaign },
        { label: "PUBLISHER", value: (r) => r.publisher },
        { label: "BUYER", value: (r) => r.buyer },
        { label: "DESTINATION", value: (r) => r.destination },
        { label: "TALK", value: (r) => mmss(r.duration) },
        { label: "AI LABEL", value: label },
        { label: "CONFIDENCE %", value: (r) => (r.aiStatus === "checked" ? r.aiConfidence ?? "" : "") },
        { label: "AI COMMENT", value: (r) => r.summary || r.aiComment || "" },
        { label: "CALLER SPEECH (S)", value: (r) => r.callerSpeech ?? "" },
        { label: "CALLER FIRST WORD AFTER (S)", value: (r) => r.callerFirst ?? "" },
        { label: "AGENT SPEECH (S)", value: (r) => r.agentSpeech ?? "" },
        { label: "BEEPING (S)", value: (r) => r.beepSeconds ?? "" },
        { label: "AUDIT", value: audit },
        { label: "AUDIT NOTE", value: (r) => r.reviewNote || "" },
        { label: "REVIEWED BY", value: (r) => r.reviewedBy || "" },
        { label: "RECORDING", value: (r) => r.recordingUrl || "" },
        { label: "CALL ID", value: (r) => r.id },
      ];
      downloadRows("xlsx", columns, all, `ai-audit-${date}${filter ? `-${filter}` : ""}${scope ? `-${scope.name.replace(/[^A-Za-z0-9-]+/g, "_")}` : ""}`, "AI Audit", {
        boldHeader: true,
        linkColumns: ["RECORDING"],
      });
      toast.success(t("x613.done").replace("{count}", String(all.length)));
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setExporting(false);
    }
  };

  const load = React.useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const [p, s] = await Promise.all([
          http.get<Page>("/api/ai-audit/calls", {
            query: { date, label: filter, page, pageSize: PAGE_SIZE, by: scope?.by, key: scope?.key, q: q || undefined },
          }),
          http.get<Status>("/api/ai-audit/status"),
        ]);
        setData(p);
        setStatus(s);
      } catch (e) {
        if (!quiet) toast.error(t("x543.loadFailed"), { description: friendlyErrorMessage(e) });
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [date, filter, page, scope, q, t],
  );

  React.useEffect(() => {
    void load();
  }, [load]);

  // "Pending AI check" turns into the label by itself: the server pushes
  // "ai.checked" (and call events) on the live connection.
  React.useEffect(
    () =>
      onReportChanged((events) => {
        if (events.has("ai.checked") || events.has("call.ended")) void load(true);
      }),
    [load],
  );

  const replaceRow = (updated: Row) =>
    setData((d) => (d ? { ...d, items: d.items.map((r) => (r.id === updated.id ? updated : r)) } : d));

  const markCorrect = async (row: Row) => {
    setSaving(row.id);
    try {
      replaceRow(await http.post<Row>(`/api/ai-audit/calls/${row.id}/review`, { body: { correct: true } }));
      void load(true);
    } catch (e) {
      toast.error(friendlyErrorMessage(e));
    } finally {
      setSaving(null);
    }
  };

  const saveWrong = async () => {
    if (!wrong) return;
    setWrong({ ...wrong, saving: true });
    try {
      replaceRow(
        await http.post<Row>(`/api/ai-audit/calls/${wrong.row.id}/review`, {
          body: { correct: false, label: wrong.label, note: wrong.note },
        }),
      );
      setWrong(null);
      toast.success(t("x543.saved"));
      void load(true);
    } catch (e) {
      setWrong((w) => (w ? { ...w, saving: false } : w));
      toast.error(friendlyErrorMessage(e));
    }
  };

  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const acc = status?.accuracy;

  return (
    <>
      <RecordingDialog recording={listen} onClose={() => setListen(null)} />
      <PageHeader
        title={t("x543.title")}
        description={t("x543.desc")}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void exportCalls()} disabled={exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {t("x613.download")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {t("x543.refresh")}
            </Button>
          </div>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4 text-sm">
          {status ? (
            <>
              <div>
                <div className="text-[13px] text-muted-foreground">{t("x543.accuracy")}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {acc?.percent != null ? `${acc.percent}%` : "—"}
                </div>
                <div className="text-[13px] text-muted-foreground">
                  {t("x616.accuracyBase")
                    .replace("{correct}", String(acc?.correct ?? 0))
                    .replace("{reviewed}", String(acc?.reviewed ?? 0))
                    .replace("{days}", String(acc?.days ?? 30))}
                </div>
                {/* CH-643: Valid calls the team marked No Voice - what the AI missed. */}
                {(acc?.missed ?? 0) > 0 && (
                  <div className="text-[13px] text-destructive">
                    {t("x643.missed").replace("{missed}", String(acc?.missed ?? 0))}
                  </div>
                )}
              </div>
              <div>
                <div className="text-[13px] text-muted-foreground">{t("x543.pendingNow")}</div>
                <div className="text-lg font-semibold tabular-nums">{status.pending}</div>
              </div>
              <div className="text-[13px] text-muted-foreground">
                {t("x543.rules")
                  .replace("{speech}", String(status.minSpeechSeconds))
                  .replace("{beep}", String(status.minBeepSeconds))}
                <br />
                {status.telegram ? t("x543.telegramOn") : t("x543.telegramOff")}
              </div>
            </>
          ) : (
            <Skeleton className="h-10 w-80" />
          )}
          {/* CH-603: the Reports date picker, one day at a time. */}
          <div className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">{t("x543.date")}</span>
            <DateRangePicker
              singleDay
              value={{ from: dayKeyToLocalDate(date), to: dayKeyToLocalDate(date) }}
              onChange={(r) => {
                if (!r?.from) return;
                setDate(calendarDayKey(r.from));
                setScope(null);
                setPage(1);
              }}
              today={dayKeyToLocalDate(todayEst())}
              className="hover:bg-muted hover:text-foreground dark:hover:bg-muted/70"
            />
          </div>
        </CardContent>
      </Card>

      {/* CH-557 (Sir, 5 Nov): the filter boxes all the same size, in an even grid.
          CH-664 (11 Nov): small - name and count on one line. */}
      <div className="mb-3 grid grid-cols-2 gap-1.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-7">
        {FILTERS.map((f) => (
          <button
            key={f || "all"}
            type="button"
            aria-pressed={filter === f}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
            className={cn(
              "flex min-h-[34px] items-center justify-between gap-2 rounded-md border px-2.5 py-1 text-left transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              filter === f ? "border-accent bg-accent/10" : "border-border bg-card hover:bg-muted/50",
            )}
          >
            <span className="truncate text-[12px] font-medium leading-tight text-muted-foreground">{t(`x543.f.${f || "all"}`)}</span>
            <span className="text-sm font-semibold tabular-nums">{data ? data.counts[FILTER_COUNT[f]] ?? 0 : "—"}</span>
          </button>
        ))}
      </div>

      {/* CH-664: search by caller ID. */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("x664.search")}
            aria-label={t("x664.search")}
            inputMode="tel"
            className="h-8 pl-8 pr-8 text-sm"
          />
          {search && (
            <button
              type="button"
              aria-label={t("x664.clear")}
              title={t("x664.clear")}
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">{t("x664.hint")}</span>
      </div>

      {scope && (
        <div className="mb-2 flex items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1">
            {t("x650.showing").replace("{name}", scope.name)}
            <button
              type="button"
              aria-label={t("x650.clear")}
              title={t("x650.clear")}
              onClick={() => {
                setScope(null);
                setPage(1);
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        </div>
      )}
      <Card ref={listRef} className="scroll-mt-20">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="text-sm">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">{t("x543.col.time")}</TableHead>
                  <TableHead>{t("x543.col.caller")}</TableHead>
                  <TableHead>{t("x543.col.route")}</TableHead>
                  <TableHead className="text-right">{t("x543.col.talk")}</TableHead>
                  <TableHead>{t("x543.col.ai")}</TableHead>
                  <TableHead>{t("x543.col.sides")}</TableHead>
                  <TableHead className="pr-4">{t("x543.col.review")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data
                  ? Array.from({ length: 6 }).map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7} className="pl-4">
                          <Skeleton className="h-5 w-full" />
                        </TableCell>
                      </TableRow>
                    ))
                  : (data?.items ?? []).map((r) => (
                      <TableRow key={r.id} className={cn(loading && "opacity-60")}>
                        <TableCell className="whitespace-nowrap pl-4 tabular-nums">{timeEst(r.startedAt)}</TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{r.caller}</TableCell>
                        <TableCell className="whitespace-nowrap">
                          {r.campaign || "—"} · {r.publisher || "—"} &gt; {r.buyer || "—"}
                          <div className="text-[13px] text-muted-foreground tabular-nums">{r.destination}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{mmss(r.duration)}</TableCell>
                        <TableCell>
                          {/* CH-602 (5 Nov: "this looks ugly ... well aligned ... remove those
                              comments"): every row the same - one 20em box (the label, Pending AI
                              check or No file) and its % in a fixed slot - so the column lines up
                              and every row is one line high.
                              CH-606 (Sir: "Comments centers and organized"): the comment is back,
                              in the label's own column - exactly as wide as the label and centred
                              on it - at most four lines, the whole text on hover. w-0 min-w-full
                              keeps it from widening the column. */}
                          <div className="inline-grid grid-cols-[auto_2.5rem] items-center gap-x-2">
                            {r.aiStatus === "checked" ? (
                              <Badge
                                variant={labelVariant(r.aiLabel)}
                                // CH-561: wide enough for the longest label at any text size.
                                className="w-[20em] justify-center overflow-visible whitespace-nowrap px-3 py-1 text-[13px]"
                              >
                                {labelText(r.aiLabel)}
                              </Badge>
                            ) : (
                              <span className="inline-flex w-[20em] items-center justify-center gap-1.5 rounded-md border border-dashed px-3 py-1 text-[13px] text-muted-foreground">
                                {r.aiStatus === "pending" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                {r.aiStatus === "pending" ? t("x543.pending") : t("x543.noFile")}
                              </span>
                            )}
                            <span className="w-10 text-left text-[13px] text-muted-foreground tabular-nums">
                              {r.aiStatus === "checked" && r.aiConfidence != null ? `${r.aiConfidence}%` : ""}
                            </span>
                            {r.aiStatus === "checked" && r.summary && (
                              <div
                                className="col-start-1 mt-1 line-clamp-4 w-0 min-w-full whitespace-normal text-center text-[12px] leading-snug text-muted-foreground [text-wrap:balance]"
                                title={r.summary}
                              >
                                {comments[r.id] || r.summary}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-[13px] tabular-nums">
                          {/* CH-602: names in one column, seconds in the next - the numbers line
                              up row to row instead of each line being centred on its own. */}
                          {r.channels === 2 ? (
                            <div className="mx-auto grid w-fit grid-cols-[auto_auto] gap-x-2 text-left">
                              <span className="text-muted-foreground">{t("x543.callerSide")}</span>
                              <span>
                                {sec(r.callerSpeech)}
                                {r.callerFirst != null && (
                                  <span className="text-muted-foreground">
                                    {` · ${t("x543.firstWord").replace("{s}", r.callerFirst.toFixed(0))}`}
                                  </span>
                                )}
                              </span>
                              <span className="text-muted-foreground">{t("x543.agentSide")}</span>
                              <span>{sec(r.agentSpeech)}</span>
                              {(r.beepSeconds ?? 0) > 0 && (
                                <>
                                  <span className="text-muted-foreground">{t("x543.beep")}</span>
                                  <span>{sec(r.beepSeconds)}</span>
                                </>
                              )}
                            </div>
                          ) : r.aiStatus === "checked" ? (
                            <span className="text-muted-foreground">
                              {t("x543.oneChannel").replace("{s}", sec(r.speech))}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                          {r.recordingUrl && (
                            <div className="mt-1">
                              <button
                                type="button"
                                onClick={() => setListen({ url: r.recordingUrl, subtitle: r.destination ? `${r.caller} → ${r.destination}` : r.caller })}
                                className="text-accent underline-offset-2 hover:underline"
                              >
                                {t("x543.listen")}
                              </button>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-4">
                          {r.aiStatus !== "checked" ||
                          r.aiLabel === "mixed" ||
                          (!r.reviewLabel && !(r.auditable ?? AUDIT_LABELS.includes(r.aiLabel))) ? (
                            <span className="text-muted-foreground">—</span>
                          ) : r.reviewLabel ? (
                            <div className="text-[13px]">
                              {r.reviewCorrect ? (
                                <span className="text-[color:var(--success)]">{t("x543.markedCorrect")}</span>
                              ) : (
                                <span className="text-destructive">
                                  {t("x543.markedWrong").replace("{label}", labelText(r.reviewLabel))}
                                </span>
                              )}
                              <div className="text-muted-foreground">{r.reviewedBy}</div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={saving === r.id}
                                onClick={() => void markCorrect(r)}
                              >
                                <Check className="h-3.5 w-3.5" />
                                {t("x543.correct")}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={saving === r.id}
                                onClick={() =>
                                  setWrong({
                                    row: r,
                                    label: (LABELS.find((l) => l !== r.aiLabel) ?? "valid") as Label,
                                    note: "",
                                    saving: false,
                                  })
                                }
                              >
                                <X className="h-3.5 w-3.5" />
                                {t("x543.wrong")}
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                {!loading && data && data.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                      {t("x543.noCalls")}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data && data.total > PAGE_SIZE && (
            <div className="flex items-center justify-end gap-3 border-t px-4 py-3 text-sm">
              <span className="text-muted-foreground">
                {t("x543.page").replace("{p}", String(page)).replace("{n}", String(pages))}
              </span>
              <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
                {t("x543.prev")}
              </Button>
              <Button variant="outline" size="sm" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>
                {t("x543.next")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CH-650: Sir's No Voice report (9 Nov). */}
      <NoVoiceReport date={date} onCalls={showCalls} />
      <RepeatCallersReport date={date} onCalls={showCalls} />
      <EvidenceExportReport date={date} todayKey={todayEst()} />

      <Dialog open={wrong !== null} onOpenChange={(o) => !o && !wrong?.saving && setWrong(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("x543.wrongTitle")}</DialogTitle>
            <DialogDescription>
              {wrong &&
                t("x543.wrongDesc").replace("{label}", labelText(wrong.row.aiLabel))}
            </DialogDescription>
          </DialogHeader>
          {wrong && (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {LABELS.filter((l) => l !== wrong.row.aiLabel).map((l) => (
                  <Button
                    key={l}
                    size="sm"
                    variant={wrong.label === l ? "default" : "outline"}
                    onClick={() => setWrong({ ...wrong, label: l })}
                  >
                    {labelText(l)}
                  </Button>
                ))}
              </div>
              <div>
                <div className="mb-1.5 text-sm font-medium">{t("x543.note")}</div>
                <Input
                  value={wrong.note}
                  maxLength={300}
                  onChange={(e) => setWrong({ ...wrong, note: e.target.value })}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setWrong(null)} disabled={wrong?.saving}>
              {t("x543.cancel")}
            </Button>
            <Button size="sm" onClick={() => void saveWrong()} disabled={wrong?.saving}>
              {wrong?.saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t("x543.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

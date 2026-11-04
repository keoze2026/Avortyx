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
 * The page updates by itself when a call is checked (live connection, CH-538).
 */

import * as React from "react";
import { Check, Loader2, RefreshCw, X } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
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
import { onReportChanged } from "@/lib/report-events";
import { cn } from "@/lib/utils";

/** Labels a reviewer can pick (Sir's four). */
const LABELS = ["valid", "dead_caller", "agent_only", "agent_beep"] as const;
type Label = (typeof LABELS)[number];
const FILTERS = [
  "",
  "pending",
  "no_voice",
  "dead_caller",
  "agent_only",
  "agent_beep",
  "valid",
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
}

type Counts = Record<
  "total" | "pending" | "noVoice" | "deadCaller" | "agentOnly" | "agentBeep" | "valid" | "mixed" | "fault" | "reviewed" | "wrong",
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
  accuracy: { reviewed: number; correct: number; percent: number | null; days: number };
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

function timeEst(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
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

function sec(v: number | null | undefined): string {
  return typeof v === "number" ? `${v.toFixed(1)}s` : "—";
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
  const [data, setData] = React.useState<Page | null>(null);
  const [status, setStatus] = React.useState<Status | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [wrong, setWrong] = React.useState<{ row: Row; label: Label; note: string; saving: boolean } | null>(null);
  const [saving, setSaving] = React.useState<string | null>(null);

  const labelText = React.useCallback((l: string) => t(`x543.label.${l}`), [t]);

  const load = React.useCallback(
    async (quiet = false) => {
      if (!quiet) setLoading(true);
      try {
        const [p, s] = await Promise.all([
          http.get<Page>("/api/ai-audit/calls", { query: { date, label: filter, page, pageSize: PAGE_SIZE } }),
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
    [date, filter, page, t],
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
      <PageHeader
        title={t("x543.title")}
        description={t("x543.desc")}
        actions={
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            {t("x543.refresh")}
          </Button>
        }
      />

      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-x-8 gap-y-3 py-4 text-sm">
          {status ? (
            <>
              <div>
                <div className="text-xs text-muted-foreground">{t("x543.accuracy")}</div>
                <div className="text-lg font-semibold tabular-nums">
                  {acc?.percent != null ? `${acc.percent}%` : "—"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {t("x543.accuracyBase")
                    .replace("{correct}", String(acc?.correct ?? 0))
                    .replace("{reviewed}", String(acc?.reviewed ?? 0))
                    .replace("{days}", String(acc?.days ?? 30))}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">{t("x543.pendingNow")}</div>
                <div className="text-lg font-semibold tabular-nums">{status.pending}</div>
              </div>
              <div className="text-xs text-muted-foreground">
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
          <label className="ml-auto flex items-center gap-2">
            <span className="text-muted-foreground">{t("x543.date")}</span>
            <Input
              type="date"
              value={date}
              max={todayEst()}
              onChange={(e) => {
                if (!e.target.value) return;
                setDate(e.target.value);
                setPage(1);
              }}
              className="h-8 w-40"
            />
          </label>
        </CardContent>
      </Card>

      <div className="mb-3 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Button
            key={f || "all"}
            size="sm"
            variant={filter === f ? "default" : "outline"}
            onClick={() => {
              setFilter(f);
              setPage(1);
            }}
          >
            {t(`x543.f.${f || "all"}`)}
            {data && <span className="ml-1.5 tabular-nums opacity-70">{data.counts[FILTER_COUNT[f]]}</span>}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
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
                          <div className="text-xs text-muted-foreground tabular-nums">{r.destination}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{mmss(r.duration)}</TableCell>
                        <TableCell className="min-w-[220px]">
                          {r.aiStatus === "pending" ? (
                            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              {t("x543.pending")}
                            </span>
                          ) : r.aiStatus === "missing" ? (
                            <span className="text-muted-foreground">{t("x543.noFile")}</span>
                          ) : (
                            <>
                              <Badge variant={labelVariant(r.aiLabel)}>{labelText(r.aiLabel)}</Badge>
                              {r.aiConfidence != null && (
                                <span className="ml-1.5 text-xs text-muted-foreground tabular-nums">
                                  {r.aiConfidence}%
                                </span>
                              )}
                              {r.audioFault && (
                                <div className="mt-1 text-xs font-medium text-destructive">{t("x543.fault")}</div>
                              )}
                            </>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs tabular-nums">
                          {r.channels === 2 ? (
                            <>
                              <div>
                                {t("x543.callerSide")} {sec(r.callerSpeech)}
                                {r.callerFirst != null &&
                                  ` · ${t("x543.firstWord").replace("{s}", r.callerFirst.toFixed(0))}`}
                              </div>
                              <div>
                                {t("x543.agentSide")} {sec(r.agentSpeech)}
                              </div>
                              {(r.beepSeconds ?? 0) > 0 && (
                                <div>
                                  {t("x543.beep")} {sec(r.beepSeconds)}
                                </div>
                              )}
                            </>
                          ) : r.aiStatus === "checked" ? (
                            <span className="text-muted-foreground">
                              {t("x543.oneChannel").replace("{s}", sec(r.speech))}
                            </span>
                          ) : (
                            "—"
                          )}
                          {r.recordingUrl && (
                            <div className="mt-1">
                              <a
                                href={r.recordingUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-accent underline-offset-2 hover:underline"
                              >
                                {t("x543.listen")}
                              </a>
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="whitespace-nowrap pr-4">
                          {r.aiStatus !== "checked" || r.aiLabel === "mixed" ? (
                            <span className="text-muted-foreground">—</span>
                          ) : r.reviewLabel ? (
                            <div className="text-xs">
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

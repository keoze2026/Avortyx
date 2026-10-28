"use client";

/**
 * The TFN Check panel (CH-214), shared by the portal page and the public
 * link page: paste numbers, press Check, see each number's status.
 *
 * On the portal each number has a Test call button (CH-239): the call starts
 * inside our own phone system and the row shows each step as it happens -
 * placed, reached our phone system, number live, campaign active, routing
 * ready - then passed or failed. Nothing goes to the carrier. The public page
 * never places calls.
 */
import * as React from "react";
import {
  CheckCircle2,
  ClipboardCopy,
  Loader2,
  PhoneCall,
  RotateCw,
  Search,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/errors";
import {
  TFN_STATUS_ORDER,
  type TfnCheckResponse,
  type TfnStatus,
  type TfnTestCall,
  type TfnTestStep,
} from "@/lib/api/services/tfn-check.service";
import { formatLocalDateTime, formatRelativeTime, uiLocaleTag } from "@/lib/format";
import { tfnDetail, tfnStepText, tfnWhy } from "@/lib/i18n/server-text";
import { cn } from "@/lib/utils";

/** Colour per status: green works, red does not, amber needs attention. */
export const TFN_STATUS_TONE: Record<TfnStatus, string> = {
  working: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  active: "border-accent/40 bg-accent/10 text-accent",
  not_ready: "border-destructive/40 bg-destructive/10 text-destructive",
  not_working: "border-destructive/40 bg-destructive/10 text-destructive",
  not_in_service: "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
  paused: "border-border bg-muted/50 text-muted-foreground",
  expired: "border-destructive/30 bg-destructive/5 text-destructive/80",
  not_found: "border-border bg-muted/30 text-muted-foreground",
};

/** A running test call is read again this often, for this long at most. */
const TEST_POLL_MS = 1_000;
/** CH-348: the test now rings the buyer too (up to 30 s) - wait long enough. */
const TEST_GIVE_UP_MS = 100_000;
/** Steps in the order the call goes through them; the backend may record two
 *  at the same instant in either order. */
const STEP_ORDER = ["placed", "carrier", "reached", "number", "campaign", "routing", "buyer_ringing", "buyer"];
/** Statuses a test call cannot help with: the number is not ours any more. */
const UNTESTABLE = new Set<TfnStatus>(["not_found", "expired"]);

type TestState = TfnTestCall & { gaveUp?: boolean };

function orderedSteps(steps: TfnTestStep[]): TfnTestStep[] {
  const rank = (k: string) => {
    const i = STEP_ORDER.indexOf(k);
    return i < 0 ? STEP_ORDER.length : i;
  };
  return [...steps].sort((a, b) => rank(a.key) - rank(b.key));
}

function clock(iso: string | null | undefined): string {
  return iso ? new Date(iso).toLocaleTimeString(uiLocaleTag(), { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "";
}

export function TfnStatusChip({ status, label }: { status: TfnStatus; label?: string }) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium",
        TFN_STATUS_TONE[status],
      )}
    >
      {label ?? t(`tfnCheck.status.${status}`)}
    </span>
  );
}

export function TfnCheckPanel({
  onCheck,
  onStartTest,
  onGetTest,
  onTestDone,
  disabled = false,
}: {
  onCheck: (numbers: string, test: boolean) => Promise<TfnCheckResponse>;
  /** Portal only: start a test call for one number (CH-239). */
  onStartTest?: (number: string) => Promise<TfnTestCall>;
  onGetTest?: (id: string) => Promise<TfnTestCall>;
  /** Called when a test call passes or fails, e.g. to refresh today's history (CH-341). */
  onTestDone?: () => void;
  disabled?: boolean;
}) {
  const { t, locale } = useTranslation();
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<TfnCheckResponse | null>(null);
  const [filter, setFilter] = React.useState<TfnStatus | null>(null);
  const [tests, setTests] = React.useState<Record<string, TestState>>({});
  const [starting, setStarting] = React.useState<Record<string, boolean>>({});
  const lastChecked = React.useRef("");
  const timers = React.useRef<Record<string, number>>({});
  const canTest = Boolean(onStartTest && onGetTest);

  React.useEffect(
    () => () => Object.values(timers.current).forEach((id) => window.clearTimeout(id)),
    [],
  );

  /** Read a running test again every second until it passes or fails. */
  const follow = React.useCallback(
    (number: string, id: string, since: number) => {
      if (!onGetTest) return;
      timers.current[number] = window.setTimeout(async () => {
        try {
          const next = await onGetTest(id);
          setTests((m) => ({ ...m, [number]: next }));
          if (next.status === "passed" || next.status === "failed") {
            onTestDone?.();
            return;
          }
        } catch {
          // A missed read is retried on the next tick.
        }
        if (Date.now() - since > TEST_GIVE_UP_MS) {
          setTests((m) => (m[number] ? { ...m, [number]: { ...m[number], gaveUp: true } } : m));
          return;
        }
        follow(number, id, since);
      }, TEST_POLL_MS);
    },
    [onGetTest, onTestDone],
  );

  const startTest = async (number: string) => {
    if (!onStartTest) return;
    window.clearTimeout(timers.current[number]);
    setStarting((m) => ({ ...m, [number]: true }));
    try {
      const test = await onStartTest(number);
      setTests((m) => ({ ...m, [number]: test }));
      follow(number, test.id, Date.now());
    } catch (e) {
      toast.error(e instanceof ApiError ? e.friendlyMessage : t("tfnCheck.test.failed"));
    } finally {
      setStarting((m) => ({ ...m, [number]: false }));
    }
  };

  const run = React.useCallback(
    async (numbers: string, quiet = false) => {
      if (!numbers.trim()) {
        if (!quiet) toast.error(t("tfnCheck.errors.empty"));
        return;
      }
      setBusy(true);
      try {
        const res = await onCheck(numbers, false);
        lastChecked.current = numbers;
        setResult(res);
        setFilter(null);
        // A new Check starts clean: an earlier test call's result described
        // the number as it was then (Sir, 24 Oct: a test failed before the
        // number was added to a campaign and still showed afterwards).
        if (!quiet) {
          Object.values(timers.current).forEach((id) => window.clearTimeout(id));
          timers.current = {};
          setTests({});
        }
      } catch (e) {
        if (!quiet) {
          toast.error(e instanceof ApiError ? e.friendlyMessage : t("tfnCheck.errors.failed"));
        }
      } finally {
        setBusy(false);
      }
    },
    [onCheck, t],
  );

  const shown = React.useMemo(
    () => (result ? result.results.filter((r) => !filter || r.status === filter) : []),
    [result, filter],
  );

  const copyResults = async () => {
    if (!result) return;
    const lines = [
      [t("tfnCheck.table.number"), t("tfnCheck.table.status"), t("tfnCheck.table.detail")].join("\t"),
      ...shown.map((r) => [r.number, t(`tfnCheck.status.${r.status}`), tfnDetail(t, locale, r)].join("\t")),
    ];
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      toast.success(t("tfnCheck.copied"));
    } catch {
      toast.error(t("tfnCheck.copyFailed"));
    }
  };

  return (
    <div className="space-y-4">
      <Card className="space-y-3 p-4 sm:p-5">
        <Label htmlFor="tfn-check-input" className="text-xs font-medium">
          {t("tfnCheck.inputLabel")}
        </Label>
        <Textarea
          id="tfn-check-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("tfnCheck.placeholder")}
          rows={6}
          className="font-mono text-xs"
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(text);
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">{t("tfnCheck.hint")}</span>
          <div className="flex shrink-0 gap-2">
            {text && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setText("");
                  setResult(null);
                }}
                disabled={busy}
              >
                <X className="h-4 w-4" /> {t("tfnCheck.clear")}
              </Button>
            )}
            <Button size="sm" onClick={() => void run(text)} disabled={busy || disabled}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              {t("tfnCheck.check")}
            </Button>
          </div>
        </div>
      </Card>

      {result && (
        <Card className="overflow-hidden p-0">
          <div className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-5">
            <div className="flex flex-wrap gap-1.5">
              {TFN_STATUS_ORDER.filter((s) => (result.summary[s] ?? 0) > 0).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilter((f) => (f === s ? null : s))}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-opacity",
                    TFN_STATUS_TONE[s],
                    filter && filter !== s && "opacity-40",
                  )}
                  aria-pressed={filter === s}
                >
                  {t(`tfnCheck.status.${s}`)}
                  <span className="tabular-nums">{result.summary[s]}</span>
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void run(lastChecked.current)}
                disabled={busy}
                title={t("tfnCheck.refresh")}
              >
                <RotateCw className={cn("h-4 w-4", busy && "animate-spin")} />
              </Button>
              <Button variant="outline" size="sm" onClick={() => void copyResults()}>
                <ClipboardCopy className="h-4 w-4" /> {t("tfnCheck.copy")}
              </Button>
            </div>
          </div>

          {(result.invalid.length > 0 || result.truncated) && (
            <div className="space-y-1 border-b border-border bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground sm:px-5">
              {result.truncated && (
                <div>{t("tfnCheck.truncated").replace("{max}", String(result.maxNumbers))}</div>
              )}
              {result.invalid.length > 0 && (
                <div>
                  {t("tfnCheck.invalid")}{" "}
                  <span className="font-mono">{result.invalid.slice(0, 10).join(", ")}</span>
                  {result.invalid.length > 10 && ` +${result.invalid.length - 10}`}
                </div>
              )}
            </div>
          )}

          {result.results.length === 0 ? (
            <div className="px-5 py-8 text-center text-xs text-muted-foreground">{t("tfnCheck.noNumbers")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="pl-5 text-[10px] uppercase tracking-wider">{t("tfnCheck.table.number")}</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">{t("tfnCheck.table.status")}</TableHead>
                    <TableHead className="text-[10px] uppercase tracking-wider">{t("tfnCheck.table.detail")}</TableHead>
                    <TableHead className={cn("text-right text-[10px] uppercase tracking-wider", !canTest && "pr-5")}>{t("tfnCheck.table.lastCall")}</TableHead>
                    {canTest && (
                      <TableHead className="pr-5 text-right text-[10px] uppercase tracking-wider">{t("tfnCheck.table.test")}</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => {
                    const test = tests[r.number];
                    const running = Boolean(starting[r.number])
                      || (test && (test.status === "queued" || test.status === "running") && !test.gaveUp);
                    return (
                    <React.Fragment key={r.number}>
                    <TableRow className={cn(test && "border-b-0")}>
                      <TableCell className="whitespace-nowrap pl-5 font-mono text-xs">{r.number}</TableCell>
                      <TableCell>
                        <TfnStatusChip status={r.status} />
                      </TableCell>
                      <TableCell className="min-w-[220px] text-xs text-muted-foreground">
                        {tfnDetail(t, locale, r)}
                        {/* CH-358: the team sees why calls would not go through. */}
                        {r.why && <div className="mt-0.5 text-[11px] font-medium text-destructive">{tfnWhy(t, r.why)}</div>}
                        {r.lastTestPassed === true && (
                          <CheckCircle2 className="ml-1 inline h-3 w-3 text-[color:var(--success)]" />
                        )}
                        {(r.testsToday ?? 0) > 0 && (
                          <div className="mt-0.5 text-[10px]">
                            {t("tfnCheck.today.rowCount")
                              .replace("{count}", String(r.testsToday))
                              .replace("{passed}", String(r.testsTodayPassed ?? 0))
                              .replace("{failed}", String(r.testsTodayFailed ?? 0))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className={cn("whitespace-nowrap text-right text-xs tabular-nums text-muted-foreground", !canTest && "pr-5")}>
                        {r.lastCallAt ? formatRelativeTime(new Date(r.lastCallAt).getTime()) : "—"}
                      </TableCell>
                      {canTest && (
                        <TableCell className="whitespace-nowrap pr-5 text-right">
                          {!UNTESTABLE.has(r.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1.5 px-2.5 text-[11px]"
                              onClick={() => void startTest(r.number)}
                              disabled={running || disabled}
                            >
                              {running ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <PhoneCall className="h-3.5 w-3.5" />
                              )}
                              {running
                                ? t("tfnCheck.test.calling")
                                : test
                                  ? t("tfnCheck.test.again")
                                  : t("tfnCheck.test.button")}
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                    {test && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={canTest ? 5 : 4} className="bg-muted/20 px-5 pb-3 pt-1">
                          <TestSteps test={test} running={Boolean(running)} />
                        </TableCell>
                      </TableRow>
                    )}
                    </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground sm:px-5">
            {t("tfnCheck.checkedAt").replace("{time}", formatLocalDateTime(result.checkedAt))}
          </div>
        </Card>
      )}
    </div>
  );
}

/** The steps of one test call, ticked off as they happen (CH-239). */
function TestSteps({ test, running }: { test: TestState; running: boolean }) {
  const { t, locale } = useTranslation();
  const steps = orderedSteps(test.steps);
  const done = test.status === "passed" || test.status === "failed";
  return (
    <div className="space-y-1 text-[11px]" aria-live="polite">
      {steps.map((s, i) => (
        <div key={`${s.key}-${i}`} className="flex items-center gap-2">
          {s.ok ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[color:var(--success)]" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />
          )}
          <span className={cn(s.ok ? "text-foreground" : "text-destructive")}>{tfnStepText(t, locale, s)}</span>
          <span className="ml-auto tabular-nums text-muted-foreground">{clock(s.at)}</span>
        </div>
      ))}
      {running && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
          {t("tfnCheck.test.calling")}
        </div>
      )}
      {done && (
        <div
          className={cn(
            "flex items-center gap-2 pt-0.5 font-semibold",
            test.status === "passed" ? "text-[color:var(--success)]" : "text-destructive",
          )}
        >
          {test.status === "passed" ? (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <XCircle className="h-3.5 w-3.5 shrink-0" />
          )}
          {test.status === "passed" ? t("tfnCheck.test.passed") : t("tfnCheck.test.failed")}
          <span className="ml-auto font-normal tabular-nums text-muted-foreground">{clock(test.finishedAt)}</span>
        </div>
      )}
      {!done && test.gaveUp && <div className="text-muted-foreground">{t("tfnCheck.test.timeout")}</div>}
      <div className="pt-1 text-[10px] text-muted-foreground">{t("x348.test.note")}</div>
      {/* CH-313: the test call is also a row in Reports, caller ID "TFN Test" (CH-344). */}
      {test.steps.some((st) => st.key === "reached") && (
        <div className="text-[10px] text-muted-foreground">{t("tfnCheck.test.inReports")}</div>
      )}
    </div>
  );
}

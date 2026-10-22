"use client";

/**
 * The TFN Check panel (CH-214), shared by the portal page and the public
 * link page: paste numbers, press Check, see each number's status.
 *
 * The portal can also queue a real test call per live number; while those
 * run the panel checks again by itself so their results appear without a
 * click. The public page never places calls.
 */
import * as React from "react";
import { CheckCircle2, ClipboardCopy, Loader2, RotateCw, Search, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { ApiError } from "@/lib/api/errors";
import {
  TFN_STATUS_ORDER,
  type TfnCheckResponse,
  type TfnStatus,
} from "@/lib/api/services/tfn-check.service";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

/** Colour per status: green works, red does not, amber needs attention. */
export const TFN_STATUS_TONE: Record<TfnStatus, string> = {
  working: "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
  active: "border-accent/40 bg-accent/10 text-accent",
  not_working: "border-destructive/40 bg-destructive/10 text-destructive",
  not_in_service: "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
  paused: "border-border bg-muted/50 text-muted-foreground",
  expired: "border-destructive/30 bg-destructive/5 text-destructive/80",
  not_found: "border-border bg-muted/30 text-muted-foreground",
};

/** How long after queuing test calls the panel checks again by itself. */
const RECHECK_AFTER_MS = [40_000, 80_000];

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
  allowTests = false,
  disabled = false,
}: {
  onCheck: (numbers: string, test: boolean) => Promise<TfnCheckResponse>;
  /** Portal only: offer "also place a test call". */
  allowTests?: boolean;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const [text, setText] = React.useState("");
  const [withTests, setWithTests] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<TfnCheckResponse | null>(null);
  const [filter, setFilter] = React.useState<TfnStatus | null>(null);
  const [testsRunning, setTestsRunning] = React.useState(0);
  const lastChecked = React.useRef("");
  const timers = React.useRef<number[]>([]);

  React.useEffect(() => () => timers.current.forEach((id) => window.clearTimeout(id)), []);

  const run = React.useCallback(
    async (numbers: string, test: boolean, quiet = false) => {
      if (!numbers.trim()) {
        if (!quiet) toast.error(t("tfnCheck.errors.empty"));
        return;
      }
      setBusy(true);
      try {
        const res = await onCheck(numbers, test);
        lastChecked.current = numbers;
        setResult(res);
        setFilter(null);
        if (test) {
          const queued = res.testsQueued ?? 0;
          setTestsRunning(queued);
          timers.current.forEach((id) => window.clearTimeout(id));
          timers.current = [];
          if (queued > 0) {
            toast.success(t("tfnCheck.testsQueued").replace("{count}", String(queued)));
            RECHECK_AFTER_MS.forEach((ms, i) => {
              timers.current.push(
                window.setTimeout(() => {
                  void run(numbers, false, true);
                  if (i === RECHECK_AFTER_MS.length - 1) setTestsRunning(0);
                }, ms),
              );
            });
          } else {
            toast.message(t("tfnCheck.noTestsQueued"));
          }
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
      ...shown.map((r) => [r.number, t(`tfnCheck.status.${r.status}`), r.detail].join("\t")),
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
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void run(text, allowTests && withTests);
          }}
        />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {allowTests ? (
            <label className="flex cursor-pointer items-start gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={withTests}
                onCheckedChange={(v) => setWithTests(v === true)}
                disabled={disabled}
                className="mt-0.5"
              />
              <span>{t("tfnCheck.withTests")}</span>
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">{t("tfnCheck.hint")}</span>
          )}
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
            <Button size="sm" onClick={() => void run(text, allowTests && withTests)} disabled={busy || disabled}>
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
              {testsRunning > 0 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {t("tfnCheck.testsRunning")}
                </span>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => void run(lastChecked.current, false)}
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
                    <TableHead className="pr-5 text-right text-[10px] uppercase tracking-wider">{t("tfnCheck.table.lastCall")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {shown.map((r) => (
                    <TableRow key={r.number}>
                      <TableCell className="whitespace-nowrap pl-5 font-mono text-xs">{r.number}</TableCell>
                      <TableCell>
                        <TfnStatusChip status={r.status} />
                      </TableCell>
                      <TableCell className="min-w-[220px] text-xs text-muted-foreground">
                        {r.detail}
                        {r.lastTestPassed === true && (
                          <CheckCircle2 className="ml-1 inline h-3 w-3 text-[color:var(--success)]" />
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-5 text-right text-xs tabular-nums text-muted-foreground">
                        {r.lastCallAt ? formatRelativeTime(new Date(r.lastCallAt).getTime()) : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="border-t border-border px-4 py-2 text-[10px] text-muted-foreground sm:px-5">
            {t("tfnCheck.checkedAt").replace("{time}", new Date(result.checkedAt).toLocaleString())}
          </div>
        </Card>
      )}
    </div>
  );
}

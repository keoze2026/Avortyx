"use client";

/**
 * TFN Check: today's test calls (CH-341, Sir 28 Oct). Every test call since
 * 12 AM Eastern stays listed until the next Eastern midnight, so anyone can
 * see how many times each TFN was tested today and how each test went. A
 * publisher login sees its own numbers only (the backend scopes it).
 *
 * CH-342: the checks too - how many times each number was checked today and
 * its last result - and the same card on the share-link page, where a partner
 * sees only the numbers that link checked.
 */
import * as React from "react";
import { CheckCircle2, ChevronDown, ChevronRight, Loader2, RotateCw, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useTranslation } from "@/hooks/use-translation";
import {
  tfnCheckService,
  type TfnRunnerType,
  type TfnTestHistoryRow,
  type TfnTestsToday,
} from "@/lib/api/services/tfn-check.service";
import { tfnStepText } from "@/lib/i18n/server-text";
import { cn } from "@/lib/utils";
import { TfnStatusChip } from "./tfn-check-panel";

const REFRESH_MS = 30_000;

function easternTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

function Result({ status }: { status: TfnTestHistoryRow["status"] | null }) {
  const { t } = useTranslation();
  if (!status) return <span className="text-muted-foreground">—</span>;
  if (status === "passed")
    return (
      <span className="inline-flex items-center gap-1 text-[color:var(--success)]">
        <CheckCircle2 className="h-3.5 w-3.5" /> {t("tfnCheck.today.passed")}
      </span>
    );
  if (status === "failed")
    return (
      <span className="inline-flex items-center gap-1 text-destructive">
        <XCircle className="h-3.5 w-3.5" /> {t("tfnCheck.today.failed")}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {t("tfnCheck.today.running")}
    </span>
  );
}

export function TestsTodayCard({
  refreshKey = 0,
  load: loadToday = tfnCheckService.testsToday,
}: {
  refreshKey?: number;
  /** The share-link page reads its own list (CH-342). */
  load?: () => Promise<TfnTestsToday>;
}) {
  const { t, locale } = useTranslation();
  const [data, setData] = React.useState<TfnTestsToday | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [open, setOpen] = React.useState<Set<string>>(new Set());

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      setData(await loadToday());
    } catch {
      // Shown again on the next refresh.
    } finally {
      setLoading(false);
    }
  }, [loadToday]);

  React.useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(id);
  }, [load, refreshKey]);

  const byNumber = React.useMemo(() => {
    const m: Record<string, TfnTestHistoryRow[]> = {};
    for (const row of data?.tests ?? []) (m[row.number] ??= []).push(row);
    return m;
  }, [data]);

  const toggle = (n: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n);
      else next.add(n);
      return next;
    });

  const byText = (by: string) =>
    ({ You: t("tfnCheck.today.byYou"), Avortyx: "Avortyx", Morning: t("tfnCheck.today.byMorning"), Automatic: t("tfnCheck.today.byAuto"), Publisher: t("x343.by.publisher") })[by] ?? by;

  /** CH-343: who ran it - "Main account · Sir", "Team · Evans",
   *  "Publisher · Crug", "Automatic test". */
  const Runner = ({ type, by }: { type: TfnRunnerType | null; by: string | null }) => {
    if (!type && !by) return <span className="text-muted-foreground">—</span>;
    const kind = type && type !== "unknown" ? t(`x343.by.${type}`) : "";
    const name = by ? byText(by) : "";
    const showName = name && name !== kind && type !== "auto" && type !== "morning";
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {kind && (
          <span
            className={cn(
              "rounded border px-1.5 py-0.5 text-[10px] font-medium",
              type === "main" && "border-accent/40 bg-accent/10 text-accent",
              type === "team" && "border-border bg-muted/50 text-foreground",
              type === "publisher" && "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
              type === "buyer" && "border-border bg-muted/30 text-muted-foreground",
              (type === "auto" || type === "morning") && "border-border bg-muted/30 text-muted-foreground",
            )}
          >
            {kind}
          </span>
        )}
        {showName && <span className="text-muted-foreground">{name}</span>}
      </span>
    );
  };

  const failedStep = (row: TfnTestHistoryRow) => {
    const s = row.steps.find((x) => !x.ok);
    return s ? tfnStepText(t, locale, s) : "";
  };

  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-5">
        <div>
          <div className="text-sm font-semibold">{t("x342.today.title")}</div>
          <div className="text-[11px] text-muted-foreground">{t("x342.today.subtitle")}</div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">
            {t("x342.today.totals")
              .replace("{checks}", String(data?.totalChecks ?? 0))
              .replace("{tests}", String(data?.total ?? 0))}
          </span>
          <Button variant="ghost" size="sm" onClick={() => void load()} disabled={loading} title={t("tfnCheck.refresh")}>
            <RotateCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {(data?.numbers.length ?? 0) === 0 ? (
        <div className="px-5 py-8 text-center text-xs text-muted-foreground">{t("x342.today.empty")}</div>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-5 text-[10px] uppercase tracking-wider">{t("tfnCheck.table.number")}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">{t("x343.by.header")}</TableHead>
                <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("x342.today.checked")}</TableHead>
                <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("x342.today.lastResult")}</TableHead>
                <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("tfnCheck.today.tests")}</TableHead>
                <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("tfnCheck.today.passed")}</TableHead>
                <TableHead className="text-center text-[10px] uppercase tracking-wider">{t("tfnCheck.today.failed")}</TableHead>
                <TableHead className="text-[10px] uppercase tracking-wider">{t("x342.today.testResult")}</TableHead>
                <TableHead className="pr-5 text-right text-[10px] uppercase tracking-wider">{t("x342.today.lastAt")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data!.numbers.map((n) => {
                const isOpen = open.has(n.number);
                return (
                  <React.Fragment key={n.number}>
                    <TableRow className="cursor-pointer" onClick={() => toggle(n.number)}>
                      <TableCell className="whitespace-nowrap pl-5 font-mono text-xs">
                        <span className="inline-flex items-center gap-1.5">
                          {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                          {n.number}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs">
                        <Runner type={n.lastByType} by={n.lastBy} />
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{n.checks}</TableCell>
                      <TableCell className="text-center">
                        {n.lastResult ? <TfnStatusChip status={n.lastResult} /> : <span className="text-xs text-muted-foreground">—</span>}
                      </TableCell>
                      <TableCell className="text-center text-xs font-semibold tabular-nums">{n.tests}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums text-[color:var(--success)]">{n.passed}</TableCell>
                      <TableCell className="text-center text-xs tabular-nums text-destructive">{n.failed}</TableCell>
                      <TableCell className="text-xs">
                        <Result status={n.lastStatus} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap pr-5 text-right text-xs tabular-nums text-muted-foreground">
                        {easternTime(n.lastAt)} EST
                      </TableCell>
                    </TableRow>
                    {isOpen && (
                      <TableRow className="hover:bg-transparent">
                        <TableCell colSpan={9} className="bg-muted/20 px-5 py-2">
                          <div className="space-y-1">
                            {n.lastCheckedAt && (
                              <div className="text-[11px] text-muted-foreground">
                                {t("x342.today.lastChecked")
                                  .replace("{time}", `${easternTime(n.lastCheckedAt)} EST`)
                                  .replace("{count}", String(n.checks))}
                              </div>
                            )}
                            {(byNumber[n.number] ?? []).length === 0 && (
                              <div className="text-[11px] text-muted-foreground">{t("x342.today.noTests")}</div>
                            )}
                            {(byNumber[n.number] ?? []).map((row) => (
                              <div key={row.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px]">
                                <span className="w-24 tabular-nums text-muted-foreground">{easternTime(row.createdAt)} EST</span>
                                <span className="w-28">
                                  <Result status={row.status} />
                                </span>
                                {(row.by || row.byType) && <Runner type={row.byType} by={row.by} />}
                                {row.status === "failed" && failedStep(row) && (
                                  <span className="text-destructive">{failedStep(row)}</span>
                                )}
                              </div>
                            ))}
                          </div>
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
    </Card>
  );
}

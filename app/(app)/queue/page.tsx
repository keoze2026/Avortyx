"use client";

/**
 * Call Queue — calls currently held by the routing engine because no
 * destination is available, the buyer's cap is hit, or schedule rules
 * haven't matched. Refreshes every 4s while the page is visible.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2, PhoneIncoming, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { queueService, type QueuedCall } from "@/lib/api/services/queue.service";
import { formatCallerId, formatRelativeTime, toE164 } from "@/lib/format";
import { useTranslation } from "@/hooks/use-translation";

function formatWait(sec: number, t: (key: string) => string): string {
  if (sec < 60) return t("common.secondsShort").replace("{n}", String(sec));
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return t("x1.queue.waitMinSec").replace("{m}", String(m)).replace("{s}", s.toString().padStart(2, "0"));
}

export default function QueuePage() {
  const { t } = useTranslation();
  const [calls, setCalls] = useState<QueuedCall[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const items = await queueService.list();
      setCalls(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("x1.queue.loadError"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Initial + 4-second poll, paused when the tab is hidden so we don't
  // hammer the API in background tabs.
  useEffect(() => {
    void refresh();
    const tick = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 4_000);
    return () => window.clearInterval(tick);
  }, [refresh]);

  return (
    <>
      <PageHeader
        title={t("nav.callQueue")}
        description={t("x1.queue.description")}
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void refresh();
              toast.success(t("x1.queue.refreshed"));
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {t("common.refresh")}
          </Button>
        }
      />

      {error && (
        <Card className="border-destructive/40">
          <CardContent className="py-3 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {calls.length === 0 && !loading && !error ? (
        <EmptyState
          icon={PhoneIncoming}
          tone="cyan"
          title={t("x1.queue.emptyTitle")}
          description={t("x1.queue.emptyDescription")}
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>{t("toolsUI.callLogs.columns.caller")}</TableHead>
                  <TableHead>{t("dashboard.columns.destination")}</TableHead>
                  <TableHead>{t("dashboard.columns.campaign")}</TableHead>
                  <TableHead>{t("common.status")}</TableHead>
                  <TableHead className="text-right">{t("x1.queue.wait")}</TableHead>
                  <TableHead className="text-right">{t("x1.queue.enqueued")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {calls.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-mono text-xs">{formatCallerId(c.callerNumber)}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {c.destinationNumber ? toE164(c.destinationNumber) : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{c.campaignName ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
                        {c.status === "waiting" ? t("liveUI.routing.state.waiting") : c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-xs">
                      {formatWait(c.waitTimeSec, t)}
                    </TableCell>
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {formatRelativeTime(c.enqueuedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </>
  );
}

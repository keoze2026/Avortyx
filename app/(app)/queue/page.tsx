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

function formatWait(sec: number): string {
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function QueuePage() {
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
      setError(e instanceof Error ? e.message : "Couldn't load queue");
    } finally {
      setLoading(false);
    }
  }, []);

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
        title="Call Queue"
        description="Calls currently held by the routing engine waiting for a destination."
        actions={
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              void refresh();
              toast.success("Queue refreshed");
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            Refresh
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
          title="Queue is clear"
          description="No calls are currently waiting. Held calls appear here when destinations are at capacity or schedule rules block routing."
        />
      ) : (
        <Card className="overflow-hidden p-0">
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Caller</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Wait</TableHead>
                  <TableHead className="text-right">Enqueued</TableHead>
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
                        {c.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums text-xs">
                      {formatWait(c.waitTimeSec)}
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

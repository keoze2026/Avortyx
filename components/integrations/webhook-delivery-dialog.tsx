"use client";

/**
 * Webhook delivery log dialog — opened from a webhook's row in the
 * integrations page. Pages against GET /api/webhooks/{id}/deliveries, shows
 * one row per delivery attempt with event / status / HTTP code / response
 * time.
 */

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  webhooksService,
  type WebhookDelivery,
} from "@/lib/api/services/webhooks.service";
import { useTranslation } from "@/hooks/use-translation";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhookId: string | null;
  webhookName?: string;
}

const PAGE_SIZE = 25;

/** Delivery statuses the server sends, shown in the chosen language. */
const STATUS_KEY: Record<string, string> = {
  delivered: "toolsUI.integrations.webhooks.deliveryLog.delivered",
  failed: "toolsUI.integrations.webhooks.deliveryLog.failed",
  retrying: "toolsUI.integrations.webhooks.deliveryLog.retrying",
};

export function WebhookDeliveryDialog({ open, onOpenChange, webhookId, webhookName }: Props) {
  const { t } = useTranslation();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetPage = page) => {
    if (!webhookId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await webhooksService.deliveries(webhookId, { page: targetPage, pageSize: PAGE_SIZE });
      setDeliveries(res.items);
      setTotal(res.total);
      setPage(targetPage);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("x5.webhookDeliveries.loadFailed"));
    } finally {
      setLoading(false);
    }
  };

  // Reset + fetch whenever the dialog opens on a new webhook.
  useEffect(() => {
    if (!open || !webhookId) return;
    setDeliveries([]);
    setTotal(0);
    setPage(1);
    void load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, webhookId]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle>{t("x5.webhookDeliveries.title")}</DialogTitle>
              <DialogDescription>
                {webhookName
                  ? t("x5.webhookDeliveries.recentFor").replace("{name}", webhookName)
                  : t("x5.webhookDeliveries.recent")}
              </DialogDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => void load(page)} disabled={loading}>
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              {t("common.refresh")}
            </Button>
          </div>
        </DialogHeader>

        {error && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        {loading && deliveries.length === 0 ? (
          <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("x5.webhookDeliveries.loading")}
          </div>
        ) : deliveries.length === 0 && !error ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            {t("x5.webhookDeliveries.empty")}
          </div>
        ) : (
          <ul className="max-h-[60vh] divide-y divide-border/60 overflow-y-auto rounded-md border border-border/60">
            {deliveries.map((d) => {
              const ok = d.status.toLowerCase() === "delivered" || (d.statusCode !== undefined && d.statusCode >= 200 && d.statusCode < 300);
              const failing = d.status.toLowerCase() === "failed" || (d.statusCode !== undefined && d.statusCode >= 400);
              const Icon = ok ? CheckCircle2 : failing ? XCircle : Loader2;
              const tone = ok
                ? "text-[color:var(--success)]"
                : failing
                  ? "text-destructive"
                  : "text-[color:var(--warning)]";
              return (
                <li
                  key={d.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-xs"
                >
                  <Icon className={cn("h-3.5 w-3.5 shrink-0", tone, !ok && !failing && "animate-spin")} />
                  <div className="min-w-0">
                    <div className="font-mono text-foreground">{d.event}</div>
                    <div className="mt-0.5 text-[10px] text-muted-foreground">
                      {d.statusCode ?? "—"} · {d.responseTimeMs ?? "—"}ms · {formatRelativeTime(d.createdAt)}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[10px] uppercase tracking-wider",
                      ok && "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
                      failing && "border-destructive/40 bg-destructive/10 text-destructive",
                    )}
                  >
                    {STATUS_KEY[d.status.toLowerCase()] ? t(STATUS_KEY[d.status.toLowerCase()]) : d.status}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}

        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border/60 pt-3 text-xs">
            <span className="text-muted-foreground">
              {t("x5.webhookDeliveries.pageOf")
                .replace("{page}", String(page))
                .replace("{pages}", String(totalPages))
                .replace("{total}", String(total))}
            </span>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load(page - 1)}
                disabled={page <= 1 || loading}
              >
                {t("trafficUI.common.previous")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => void load(page + 1)}
                disabled={page >= totalPages || loading}
              >
                {t("trafficUI.common.next")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

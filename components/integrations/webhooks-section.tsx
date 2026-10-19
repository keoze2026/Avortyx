"use client";

/**
 * Webhook endpoints + their last-24h delivery log.
 * Each webhook gets its own card with the URL, event list, status, success rate,
 * and a peek at recent deliveries.
 *
 * Backed by `useWebhooksStore` (which calls /api/webhooks/*). The store hydrates
 * on app boot via StoreHydrator; this component is read-only on hydration and
 * goes through the store for every create/edit/delete/test action.
 */

import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, History, Loader2, MoreVertical, Plug2, Plus, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";

import { WebhookDialog, type WebhookDraft } from "./webhook-dialog";
import { WebhookDeliveryDialog } from "./webhook-delivery-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatPercent, formatRelativeTime } from "@/lib/format";
import { useWebhooksStore } from "@/lib/store/webhooks-store";
import type { Webhook, WebhookStatus } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";
import { Can } from "@/components/shared/can";
import { usePermissions } from "@/lib/my-permissions";

const STATUS_VARIANT: Record<WebhookStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  active: "success",
  paused: "outline",
  failing: "destructive",
};

const STATUS_LABEL_KEYS: Record<WebhookStatus, string> = {
  active: "toolsUI.integrations.webhooks.statusActive",
  paused: "toolsUI.integrations.webhooks.statusPaused",
  failing: "toolsUI.integrations.webhooks.statusFailing",
};

export function WebhooksSection() {
  const { t } = useTranslation();
  const { can } = usePermissions();
  const hooks = useWebhooksStore((s) => s.webhooks);
  const createHook = useWebhooksStore((s) => s.create);
  const updateHook = useWebhooksStore((s) => s.update);
  const removeHook = useWebhooksStore((s) => s.remove);
  const sendTest = useWebhooksStore((s) => s.sendTest);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Webhook | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<Webhook | null>(null);

  const remove = async (id: string) => {
    try {
      await removeHook(id);
      toast.success(t("toolsUI.integrations.webhooks.toastRemoved"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't remove webhook");
    }
  };

  const onSendTest = async (id: string) => {
    try {
      await sendTest(id);
      toast.success(t("toolsUI.integrations.webhooks.toastTestSent"));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test delivery failed");
    }
  };

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (h: Webhook) => {
    setEditing(h);
    setEditorOpen(true);
  };

  // The dialog stores headers as `{k, v}`; the backend / store expect
  // `{key, value}`. Convert once at the boundary.
  const onSave = async (draft: WebhookDraft, originalId?: string) => {
    const headers = draft.headers
      .filter((h) => h.k.trim() && h.v.trim())
      .map((h) => ({ key: h.k.trim(), value: h.v.trim() }));
    try {
      if (originalId) {
        await updateHook(originalId, {
          name: draft.name,
          url: draft.url,
          events: draft.events,
          // Only send secret if the user actually changed it — preserves the
          // existing one when they just tweak the URL/events.
          ...(draft.secret ? { secret: draft.secret } : {}),
          headers,
        });
      } else {
        await createHook({
          name: draft.name,
          url: draft.url,
          events: draft.events,
          // Empty string → backend auto-generates. Non-empty → use what the
          // user picked / our suggested value.
          ...(draft.secret ? { secret: draft.secret } : {}),
          headers,
        });
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't save webhook");
    }
  };

  return (
    <section className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-sans text-base font-semibold">{t("toolsUI.integrations.webhooks.title")}</h3>
          <p className="text-[11px] text-muted-foreground">
            {t("toolsUI.integrations.webhooks.summary")
              .replace("{active}", String(hooks.filter((h) => h.status === "active").length))
              .replace("{failing}", String(hooks.filter((h) => h.status === "failing").length))}
          </p>
        </div>
        <Can area="integrations" action="edit"><Button size="sm" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> {t("toolsUI.integrations.webhooks.addWebhook")}
        </Button></Can>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {hooks.map((h, i) => (
          <motion.div
            key={h.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.04, duration: 0.22 }}
          >
            <Card
              className={cn(
                "overflow-hidden transition-all hover:border-accent/40",
                h.status === "failing" && "border-destructive/40 shadow-md shadow-destructive/10",
              )}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "inline-flex h-9 w-9 items-center justify-center rounded-lg",
                        h.status === "failing"
                          ? "bg-destructive/15 text-destructive"
                          : "bg-accent/10 text-accent",
                      )}
                    >
                      <Plug2 className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="truncate text-sm font-semibold">{h.name}</h4>
                        <Badge variant={STATUS_VARIANT[h.status]}>{t(STATUS_LABEL_KEYS[h.status])}</Badge>
                      </div>
                      <code className="mt-1 block truncate font-mono text-[11px] text-muted-foreground">
                        {h.url}
                      </code>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={t("toolsUI.integrations.webhooks.actionsAria")}>
                        <MoreVertical className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {can("integrations", "edit") && (<DropdownMenuItem onSelect={() => onSendTest(h.id)}>
                        {t("toolsUI.integrations.webhooks.sendTest")}
                      </DropdownMenuItem>)}
                      <DropdownMenuItem onSelect={() => setDeliveriesFor(h)}>
                        <History className="h-4 w-4" /> View deliveries
                      </DropdownMenuItem>
                      {can("integrations", "edit") && (<DropdownMenuItem onSelect={() => openEdit(h)}>
                        {t("toolsUI.integrations.webhooks.configure")}
                      </DropdownMenuItem>)}
                      {can("integrations", "delete") && (<DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={() => remove(h.id)}
                      >
                        <Trash2 className="h-4 w-4" /> {t("toolsUI.integrations.webhooks.remove")}
                      </DropdownMenuItem>)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Subscribed events */}
                <div className="mt-3 flex flex-wrap gap-1">
                  {h.events.map((ev) => (
                    <span
                      key={ev}
                      className="rounded-md border border-border bg-secondary/40 px-1.5 py-0.5 font-mono text-[10px]"
                    >
                      {ev}
                    </span>
                  ))}
                </div>

                {/* Stats row */}
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border/40 pt-3 text-center">
                  <Stat label={t("toolsUI.integrations.webhooks.stats.success")} value={formatPercent(h.successRate24h * 100, 1)} />
                  <Stat label={t("toolsUI.integrations.webhooks.stats.events")} value={h.events.length.toString()} />
                  <Stat label={t("toolsUI.integrations.webhooks.stats.lastDelivery")} value={h.lastDeliveryAt ? formatRelativeTime(h.lastDeliveryAt) : "—"} />
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Delivery log */}
      <DeliveryLog />

      <WebhookDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        initial={editing}
        onSave={onSave}
      />

      <WebhookDeliveryDialog
        open={!!deliveriesFor}
        onOpenChange={(v) => !v && setDeliveriesFor(null)}
        webhookId={deliveriesFor?.id ?? null}
        webhookName={deliveriesFor?.name}
      />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="font-mono text-xs font-semibold">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}

const DELIVERY_ICON = {
  delivered: CheckCircle2,
  retrying: Loader2,
  failed: XCircle,
} as const;

function DeliveryLog() {
  const { t } = useTranslation();
  const allDeliveries = useWebhooksStore((s) => s.deliveries);
  const allHooks = useWebhooksStore((s) => s.webhooks);
  const deliveries = useMemo(() => allDeliveries.slice(0, 14), [allDeliveries]);
  const hooksById = useMemo(
    () => new Map(allHooks.map((h) => [h.id, h])),
    [allHooks],
  );

  return (
    <Card className="mt-3">
      <CardContent className="p-0">
        <div className="border-b border-border/60 bg-secondary/30 px-4 py-2.5">
          <h4 className="text-sm font-semibold">{t("toolsUI.integrations.webhooks.deliveryLog.title")}</h4>
          <p className="text-[10px] text-muted-foreground">{t("toolsUI.integrations.webhooks.deliveryLog.subtitle")}</p>
        </div>
        <ul className="divide-y divide-border/60">
          {deliveries.map((d, i) => {
            const Icon = DELIVERY_ICON[d.status];
            const hook = hooksById.get(d.webhookId);
            const tone =
              d.status === "delivered"
                ? "text-[color:var(--success)]"
                : d.status === "retrying"
                  ? "text-[color:var(--warning)]"
                  : "text-destructive";
            return (
              <motion.li
                key={d.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02, duration: 0.2 }}
                className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-xs"
              >
                <Icon
                  className={cn(
                    "h-3.5 w-3.5",
                    tone,
                    d.status === "retrying" && "animate-spin",
                  )}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{d.event}</span>
                    {hook && (
                      <span className="text-muted-foreground/60">→ {hook.name}</span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-muted-foreground/80">
                    {d.responseCode ?? "—"} · {d.responseTimeMs}ms · {formatRelativeTime(d.at)}
                  </div>
                </div>
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider",
                    d.status === "delivered" && "border-[color:var(--success)]/40 bg-[color:var(--success)]/10 text-[color:var(--success)]",
                    d.status === "retrying" && "border-[color:var(--warning)]/40 bg-[color:var(--warning)]/10 text-[color:var(--warning)]",
                    d.status === "failed" && "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  {d.status === "delivered"
                    ? t("toolsUI.integrations.webhooks.deliveryLog.delivered")
                    : d.status === "retrying"
                      ? t("toolsUI.integrations.webhooks.deliveryLog.retrying")
                      : t("toolsUI.integrations.webhooks.deliveryLog.failed")}
                </span>
              </motion.li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

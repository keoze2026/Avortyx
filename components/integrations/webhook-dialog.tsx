"use client";

/**
 * Add / edit a webhook endpoint.
 * Used by both the "Add webhook" header button and the per-webhook
 * "Configure" menu item.
 */

import { useEffect, useMemo, useState } from "react";
import { Copy, Loader2, Plus, RefreshCw, Trash2, Webhook as WebhookIcon, Zap } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { friendlyErrorMessage } from "@/lib/api/errors";
import { webhooksService } from "@/lib/api/services/webhooks.service";
import { useWebhooksStore } from "@/lib/store/webhooks-store";
import type { Webhook } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";
import { cn } from "@/lib/utils";

const EVENT_CATALOG: Array<{ key: string; descriptionKey: string }> = [
  { key: "call.completed", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.completed" },
  { key: "call.qualified", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.qualified" },
  { key: "call.rejected", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.rejected" },
  { key: "buyer.capped", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.capped" },
  { key: "publisher.spike", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.spike" },
  { key: "bid.placed", descriptionKey: "toolsUI.integrations.webhooks.eventCatalog.bidPlaced" },
];

export interface WebhookDraft {
  name: string;
  url: string;
  events: string[];
  secret: string;
  headers: Array<{ k: string; v: string }>;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing webhook to edit; omit / null for "create new". */
  initial?: Webhook | null;
  onSave: (input: WebhookDraft, originalId?: string) => void;
}

function randomSecret() {
  const b64 = (s: string) =>
    typeof window === "undefined"
      ? Buffer.from(s).toString("hex")
      : Array.from(crypto.getRandomValues(new Uint8Array(24)))
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("");
  return `whsec_${b64("seed").slice(0, 32)}`;
}

export function WebhookDialog({ open, onOpenChange, initial, onSave }: Props) {
  const { t } = useTranslation();
  const sendTest = useWebhooksStore((s) => s.sendTest);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [headers, setHeaders] = useState<Array<{ k: string; v: string }>>([]);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Seed defaults each time we open. Existing webhooks restore their saved
  // secret + headers; brand-new ones get a fresh client-suggested secret so
  // the user can copy it before saving (backend will auto-generate one
  // server-side if we send an empty string, but providing one here keeps
  // the "Copy secret" button useful even before the first save).
  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setUrl(initial?.url ?? "");
    setSecret(initial?.secret ?? randomSecret());
    setSelectedEvents(new Set(initial?.events ?? ["call.completed"]));
    setHeaders(
      (initial?.headers ?? []).map((h) => ({ k: h.key, v: h.value })),
    );
    setTesting(false);
    setSaving(false);
  }, [open, initial]);

  const isEdit = !!initial;
  const canSubmit = useMemo(() => {
    if (!name.trim() || !url.trim() || selectedEvents.size === 0) return false;
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, [name, url, selectedEvents]);

  const toggleEvent = (k: string) =>
    setSelectedEvents((curr) => {
      const next = new Set(curr);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  const onTest = async () => {
    if (!canSubmit) {
      toast.error(t("toolsUI.integrations.webhooks.dialog.errorInvalid"));
      return;
    }
    setTesting(true);
    try {
      if (initial?.id) {
        // Editing an existing row — exercise the saved configuration.
        await sendTest(initial.id);
        toast.success(t("toolsUI.integrations.webhooks.dialog.toastTestDelivered"), {
          description: t("toolsUI.integrations.webhooks.dialog.toastTestDeliveredDesc")
            .replace("{url}", url)
            .replace("{ms}", "live"),
        });
      } else {
        // Creating — test the in-form values directly via the dedicated
        // test-before-save endpoint (`POST /api/webhooks/test-url`).
        const headersToSend = headers
          .filter((h) => h.k.trim() && h.v.trim())
          .map((h) => ({ key: h.k.trim(), value: h.v.trim() }));
        const res = await webhooksService.testUrl({
          url: url.trim(),
          secret: secret || undefined,
          headers: headersToSend.length > 0 ? headersToSend : undefined,
          event: "call.completed",
        });
        if (res.ok) {
          toast.success(t("toolsUI.integrations.webhooks.dialog.toastTestDelivered"), {
            description: t("toolsUI.integrations.webhooks.dialog.toastTestDeliveredDesc")
              .replace("{url}", url)
              .replace("{ms}", String(res.latencyMs ?? "—")),
          });
        } else {
          toast.error(
            res.error
              ? t("x5.webhook.testFailedWith")
                  .replace("{status}", String(res.statusCode ?? "?"))
                  .replace("{error}", res.error)
              : t("x5.webhook.testFailedStatus").replace("{status}", String(res.statusCode ?? "?")),
          );
        }
      }
    } catch (e) {
      toast.error(friendlyErrorMessage(e, t("x5.webhook.testFailed")));
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) return;
    setSaving(true);
    // Removed the cosmetic setTimeout(300) — the real save happens via the
    // parent's onSave -> webhooksService.create/update which has its own
    // round-trip latency. No need to fake an extra delay on top.
    onSave(
      {
        name: name.trim(),
        url: url.trim(),
        events: [...selectedEvents],
        secret,
        headers: headers.filter((h) => h.k.trim() && h.v.trim()),
      },
      initial?.id,
    );
    setSaving(false);
    toast.success(isEdit ? t("toolsUI.integrations.webhooks.dialog.toastUpdated") : t("toolsUI.integrations.webhooks.dialog.toastCreated"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-accent/15 text-accent">
              <WebhookIcon className="h-4 w-4" />
            </span>
            <div>
              <DialogTitle>{isEdit ? t("toolsUI.integrations.webhooks.dialog.editTitle") : t("toolsUI.integrations.webhooks.dialog.createTitle")}</DialogTitle>
              <DialogDescription>
                {t("toolsUI.integrations.webhooks.dialog.description")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_2fr]">
            <div className="space-y-2">
              <Label htmlFor="wh-name">{t("toolsUI.integrations.webhooks.dialog.nameLabel")}</Label>
              <Input
                id="wh-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("toolsUI.integrations.webhooks.dialog.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="wh-url">{t("toolsUI.integrations.webhooks.dialog.urlLabel")}</Label>
              <Input
                id="wh-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder={t("toolsUI.integrations.webhooks.dialog.urlPlaceholder")}
                className="font-mono"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t("toolsUI.integrations.webhooks.dialog.eventsLabel")}</Label>
            <div className="grid gap-1.5">
              {EVENT_CATALOG.map((e) => {
                const on = selectedEvents.has(e.key);
                return (
                  <button
                    key={e.key}
                    type="button"
                    onClick={() => toggleEvent(e.key)}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-xs transition-colors",
                      on
                        ? "border-accent/40 bg-accent/8 text-foreground"
                        : "border-border bg-secondary/30 text-muted-foreground hover:border-accent/30",
                    )}
                  >
                    <div className="min-w-0">
                      <div className="font-mono">{e.key}</div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{t(e.descriptionKey)}</div>
                    </div>
                    <span
                      className={cn(
                        "inline-flex h-4 w-4 items-center justify-center rounded-sm border",
                        on ? "border-accent bg-accent/30 text-accent" : "border-border",
                      )}
                    >
                      {on && "✓"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="wh-secret">{t("toolsUI.integrations.webhooks.dialog.secretLabel")}</Label>
            <div className="flex gap-2">
              <Input id="wh-secret" value={secret} readOnly className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                aria-label={t("toolsUI.integrations.webhooks.dialog.copySecretAria")}
                onClick={() => {
                  navigator.clipboard?.writeText(secret).then(() => toast.success(t("toolsUI.integrations.webhooks.dialog.toastSecretCopied")));
                }}
              >
                <Copy className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label={t("toolsUI.integrations.webhooks.dialog.regenSecretAria")}
                onClick={() => setSecret(randomSecret())}
              >
                <RefreshCw className="h-3 w-3" />
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {t("toolsUI.integrations.webhooks.dialog.secretHintBefore")}<span className="font-mono text-foreground">X-Avortyx-Signature</span>{t("toolsUI.integrations.webhooks.dialog.secretHintMid")}
            </p>
          </div>

          {/* Optional headers */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("toolsUI.integrations.webhooks.dialog.customHeaders")}</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setHeaders((h) => [...h, { k: "", v: "" }])}
              >
                <Plus className="h-3 w-3" /> {t("toolsUI.integrations.webhooks.dialog.addHeader")}
              </Button>
            </div>
            {headers.length === 0 ? (
              <p className="rounded-md border border-dashed border-border/60 bg-secondary/30 px-2 py-1.5 text-[10px] text-muted-foreground">
                {t("toolsUI.integrations.webhooks.dialog.noHeaders")}
              </p>
            ) : (
              <div className="space-y-1.5">
                {headers.map((h, i) => (
                  <div key={i} className="grid grid-cols-[1fr_2fr_auto] gap-2">
                    <Input
                      placeholder={t("toolsUI.integrations.webhooks.dialog.headerPlaceholder")}
                      value={h.k}
                      onChange={(e) =>
                        setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))
                      }
                      className="font-mono text-xs"
                    />
                    <Input
                      placeholder={t("toolsUI.integrations.webhooks.dialog.valuePlaceholder")}
                      value={h.v}
                      onChange={(e) =>
                        setHeaders((hs) => hs.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))
                      }
                      className="font-mono text-xs"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-destructive"
                      onClick={() => setHeaders((hs) => hs.filter((_, j) => j !== i))}
                      aria-label={t("toolsUI.integrations.webhooks.dialog.removeHeaderAria")}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="!justify-between">
          <Button variant="outline" size="sm" onClick={onTest} disabled={testing || !canSubmit}>
            {testing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" /> {t("toolsUI.integrations.webhooks.dialog.testing")}
              </>
            ) : (
              <>
                <Zap className="h-3 w-3" /> {t("toolsUI.integrations.webhooks.dialog.testSendCta")}
              </>
            )}
          </Button>

          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              {t("toolsUI.integrations.webhooks.dialog.cancel")}
            </Button>
            <Button onClick={onSubmit} disabled={!canSubmit || saving}>
              {saving ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" /> {t("toolsUI.integrations.webhooks.dialog.saving")}
                </>
              ) : isEdit ? (
                t("toolsUI.integrations.webhooks.dialog.saveCta")
              ) : (
                t("toolsUI.integrations.webhooks.dialog.createCta")
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

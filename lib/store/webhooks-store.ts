/**
 * Webhooks store — backed by /api/webhooks/*.
 *
 * The store holds the workspace's webhook endpoints plus a flat, time-sorted
 * feed of their recent deliveries for the cross-webhook "Delivery Log" card.
 * Per-webhook delivery drilldowns still hit the API directly via
 * `webhooksService.deliveries` (used by WebhookDeliveryDialog) — that path
 * doesn't go through the store.
 *
 * Wire shape (service) ↔ frontend shape (lib/types/integrations) differ:
 *   - service uses `failed` for the failing status enum; FE uses `failing`
 *   - service has no `lastDeliveryAt` / `successRate24h` — both are computed
 *     here by reducing the delivery feed grouped by webhook id
 *   - delivery wire has `statusCode` / `createdAt`; FE has `responseCode` / `at`
 */

"use client";

import { create } from "zustand";

import {
  webhooksService,
  type Webhook as WireWebhook,
  type WebhookDelivery as WireDelivery,
  type WebhookStatus as WireStatus,
} from "@/lib/api/services/webhooks.service";
import type {
  DeliveryStatus,
  Webhook,
  WebhookDelivery,
  WebhookHeader,
  WebhookStatus,
} from "@/lib/types";
import { friendlyErrorMessage } from "@/lib/api/errors";

const PER_WEBHOOK_DELIVERY_PAGE_SIZE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

interface WebhooksState {
  webhooks: Webhook[];
  /** Aggregated recent deliveries across every webhook, newest first. */
  deliveries: WebhookDelivery[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  create: (input: {
    name: string;
    url: string;
    events: string[];
    maxRetries?: number;
    timeoutSeconds?: number;
    secret?: string;
    headers?: WebhookHeader[];
  }) => Promise<Webhook>;
  update: (id: string, patch: Partial<Webhook>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  sendTest: (id: string) => Promise<void>;
  /** Mint a fresh signing secret. Returns the plaintext for one-time reveal. */
  rotateSecret: (id: string) => Promise<string>;
}

/* ─── Wire ↔ FE mappers ─────────────────────────────────────────────────── */

function statusFromWire(s: WireStatus): WebhookStatus {
  if (s === "paused") return "paused";
  if (s === "failed") return "failing";
  return "active";
}

function statusToWire(s: WebhookStatus): WireStatus {
  if (s === "paused") return "paused";
  if (s === "failing") return "failed";
  return "active";
}

function deliveryStatusFromWire(raw: string): DeliveryStatus {
  const s = raw.toLowerCase();
  if (s === "delivered" || s === "success" || s === "ok") return "delivered";
  if (s === "retrying" || s === "pending" || s === "in_progress") return "retrying";
  return "failed";
}

function wireToDelivery(w: WireDelivery): WebhookDelivery {
  return {
    id: w.id,
    webhookId: w.webhookId,
    event: w.event,
    status: deliveryStatusFromWire(w.status),
    responseCode: w.statusCode,
    responseTimeMs: w.responseTimeMs ?? 0,
    at: w.createdAt,
  };
}

/**
 * Convert the service shape to the FE shape, synthesizing the two missing
 * fields (`lastDeliveryAt`, `successRate24h`) from the supplied delivery
 * feed. The trailing-24h window is computed from the per-webhook subset of
 * `deliveries`; 100% is the default when the webhook has no recent rows.
 */
function wireToWebhook(w: WireWebhook, deliveries: WebhookDelivery[]): Webhook {
  const mine = deliveries.filter((d) => d.webhookId === w.id);
  const last = mine[0];
  const since = Date.now() - DAY_MS;
  const recent = mine.filter((d) => d.at >= since);
  const delivered = recent.filter((d) => d.status === "delivered").length;
  const successRate24h = recent.length === 0 ? 1 : delivered / recent.length;
  return {
    id: w.id,
    name: w.name,
    url: w.url,
    events: Array.isArray(w.events) ? w.events : [],
    status: statusFromWire(w.status),
    createdAt: w.createdAt,
    lastDeliveryAt: last?.at,
    successRate24h,
    secret: w.secret,
    headers: w.headers,
  };
}

/* ─── Store ─────────────────────────────────────────────────────────────── */

export const useWebhooksStore = create<WebhooksState>()((set, get) => ({
  webhooks: [],
  deliveries: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const page = await webhooksService.list({ page: 1, pageSize: 100 });
      // Fan-out deliveries fetches per webhook so the cross-webhook log has
      // real data. Each subarray is independent; failure of one doesn't lose
      // the others.
      const deliveryPages = await Promise.all(
        page.items.map((w) =>
          webhooksService
            .deliveries(w.id, { page: 1, pageSize: PER_WEBHOOK_DELIVERY_PAGE_SIZE })
            .then((p) => p.items)
            .catch(() => [] as WireDelivery[]),
        ),
      );
      const deliveries = deliveryPages
        .flat()
        .map(wireToDelivery)
        .sort((a, b) => b.at - a.at);
      const webhooks = page.items.map((w) => wireToWebhook(w, deliveries));
      set({ webhooks, deliveries, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  create: async (input) => {
    const created = await webhooksService.create(input);
    const wh = wireToWebhook(created, get().deliveries);
    set((s) => ({ webhooks: [wh, ...s.webhooks] }));
    return wh;
  },

  update: async (id, patch) => {
    const prev = get().webhooks;
    set((s) => ({
      webhooks: s.webhooks.map((x) => (x.id === id ? { ...x, ...patch } : x)),
    }));
    try {
      // Translate the FE-shaped patch into the wire shape — only the
      // service-supported fields survive.
      const body: Partial<WireWebhook> = {};
      if (patch.name !== undefined) body.name = patch.name;
      if (patch.url !== undefined) body.url = patch.url;
      if (patch.events !== undefined) body.events = patch.events;
      if (patch.status !== undefined) body.status = statusToWire(patch.status);
      if (patch.secret !== undefined) body.secret = patch.secret;
      if (patch.headers !== undefined) body.headers = patch.headers;
      const fresh = await webhooksService.update(id, body as Partial<WireWebhook>);
      set((s) => ({
        webhooks: s.webhooks.map((x) =>
          x.id === id ? wireToWebhook(fresh, s.deliveries) : x,
        ),
      }));
    } catch (e) {
      set({ webhooks: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().webhooks;
    set((s) => ({ webhooks: s.webhooks.filter((x) => x.id !== id) }));
    try {
      await webhooksService.remove(id);
    } catch (e) {
      set({ webhooks: prev, error: messageFromError(e) });
      throw e;
    }
  },

  sendTest: async (id) => {
    await webhooksService.test(id);
  },

  rotateSecret: async (id) => {
    const { secret } = await webhooksService.rotateSecret(id);
    set((s) => ({
      webhooks: s.webhooks.map((x) => (x.id === id ? { ...x, secret } : x)),
    }));
    return secret;
  },
}));

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}

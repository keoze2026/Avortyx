/**
 * Publishers store — backed by /api/publishers/*.
 *
 * Mirrors the buyers + campaigns store pattern. Payout history is fetched
 * per-publisher on demand (lazy, on detail-tab mount) and cached under
 * `payoutsByPublisher[id]` so revisiting the tab is instant. The list/CRUD
 * endpoints hydrate at app boot via StoreHydrator.
 */

"use client";

import { create } from "zustand";

import {
  publishersService,
  type PayoutWire,
} from "@/lib/api/services/publishers.service";
import { forgetPartner, markInvited } from "@/lib/partner-access";
import type { PayoutRecord, PayoutStatus, Publisher, PublisherStatus } from "@/lib/types";

interface PublishersState {
  publishers: Publisher[];
  /** Per-publisher payout cache. Empty until `fetchPayouts(id)` resolves. */
  payoutsByPublisher: Record<string, PayoutRecord[]>;
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  fetchPayouts: (publisherId: string) => Promise<void>;
  getById: (id: string) => Publisher | undefined;
  payoutsFor: (publisherId: string) => PayoutRecord[];
  add: (input: Omit<Publisher, "id" | "createdAt">) => Promise<Publisher>;
  update: (id: string, patch: Partial<Publisher>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: PublisherStatus) => Promise<void>;
}

/* ─── Wire ↔ FE payout mapping ─────────────────────────────────────────── */

function toNum(v: string | number | undefined, fallback = 0): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toTs(v: string | null | undefined): number | undefined {
  if (!v) return undefined;
  const t = Date.parse(v);
  return Number.isFinite(t) ? t : undefined;
}

function normalizeStatus(raw: string | undefined): PayoutStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paid" || s === "pending" || s === "processing" || s === "failed") return s;
  return "pending";
}

function wireToPayout(w: PayoutWire, publisherId: string, idx: number): PayoutRecord {
  const period =
    w.period && w.period.trim()
      ? w.period
      : w.periodStart && w.periodEnd
        ? `${w.periodStart} → ${w.periodEnd}`
        : "—";
  return {
    // Synthesize a stable id when the backend omits one so React keys
    // don't collide across the rendered list.
    id: w.id ?? `${publisherId}:${idx}`,
    publisherId,
    amount: toNum(w.amount),
    callsCount: w.callsCount ?? 0,
    status: normalizeStatus(w.status),
    period,
    paidAt: toTs(w.paidAt),
    scheduledFor: toTs(w.scheduledFor) ?? toTs(w.createdAt) ?? Date.now(),
  };
}

/* ─── Store ─────────────────────────────────────────────────────────────── */

export const usePublishersStore = create<PublishersState>()((set, get) => ({
  publishers: [],
  payoutsByPublisher: {},
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const page = await publishersService.list({ page: 1, pageSize: 200 });
      set({ publishers: page.items, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  fetchPayouts: async (publisherId) => {
    try {
      const rows = await publishersService.payouts(publisherId);
      const mapped = rows.map((w, i) => wireToPayout(w, publisherId, i));
      set((s) => ({
        payoutsByPublisher: { ...s.payoutsByPublisher, [publisherId]: mapped },
      }));
    } catch (e) {
      set({ error: messageFromError(e) });
    }
  },

  getById: (id) => get().publishers.find((p) => p.id === id),

  payoutsFor: (publisherId) =>
    (get().payoutsByPublisher[publisherId] ?? []).slice().sort(
      (a, b) => b.scheduledFor - a.scheduledFor,
    ),

  add: async (input) => {
    const created = await publishersService.create(input);
    set((s) => ({ publishers: [created, ...s.publishers] }));
    // The server invites the contact email when the publisher is created. If that
    // email was used before (say, by a deleted publisher), this is still a NEW
    // invitation: forget anything this browser learned about it.
    markInvited([created.email ?? (input as { email?: string }).email]);
    return created;
  },

  update: async (id, patch) => {
    const prev = get().publishers;
    set((s) => ({
      publishers: s.publishers.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    try {
      const fresh = await publishersService.update(id, patch);
      set((s) => ({
        publishers: s.publishers.map((p) => (p.id === id ? fresh : p)),
      }));
    } catch (e) {
      set({ publishers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().publishers;
    const removed = prev.find((x) => x.id === id);
    set((s) => ({ publishers: s.publishers.filter((p) => p.id !== id) }));
    try {
      await publishersService.remove(id);
    } catch (e) {
      set({ publishers: prev, error: messageFromError(e) });
      throw e;
    }
    // Deleted: everything this browser kept about its people goes too, so the
    // same email invited again later starts from scratch.
    forgetPartner("publisher", id, removed?.email);
  },

  setStatus: async (id, status) => {
    const prev = get().publishers;
    set((s) => ({
      publishers: s.publishers.map((p) => (p.id === id ? { ...p, status } : p)),
    }));
    try {
      await publishersService.setStatus(id, status);
    } catch (e) {
      set({ publishers: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Publishers request failed";
}

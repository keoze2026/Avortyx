/**
 * Buyers store — backed by /api/buyers/*.
 *
 * Hydrates on first `fetch()`. Mutations (`add`/`update`/`remove`/`setStatus`)
 * call the backend and then sync local state. The store still exposes
 * synchronous reads (`buyers`, `getById`) so existing components don't change.
 */

"use client";

import { create } from "zustand";

import { buyersService } from "@/lib/api/services/buyers.service";
import { forgetPartner, markInvited } from "@/lib/partner-access";
import type { Buyer, BuyerStatus } from "@/lib/types";

/**
 * Per-buyer /stats requests, a few at a time.
 *
 * The Buyers page asks for every buyer's counters as soon as the list loads.
 * Sent all at once (60+ requests) the server's rate limit kicked in, and its
 * "slow down" replies carry no CORS header - so the browser reported EVERY
 * request on the page (snapshot, numbers, analytics...) as a CORS error.
 * Now: at most STATS_CONCURRENCY at a time, the same buyer is never asked
 * twice at once, and if the endpoint itself is failing (5xx) the rest of the
 * queue is dropped for a minute instead of hammering it.
 */
const STATS_CONCURRENCY = 4;
const STATS_PAUSE_MS = 60_000;
const statsQueue: Array<() => Promise<void>> = [];
const statsPending = new Set<string>();
let statsRunning = 0;
let statsPausedUntil = 0;

function runStatsQueue() {
  while (statsRunning < STATS_CONCURRENCY && statsQueue.length) {
    const job = statsQueue.shift()!;
    statsRunning += 1;
    void job().finally(() => {
      statsRunning -= 1;
      runStatsQueue();
    });
  }
}

interface BuyersState {
  buyers: Buyer[];
  loading: boolean;
  error: string | null;
  /** True after the first successful fetch. */
  hydrated: boolean;

  fetch: () => Promise<void>;
  /** Refresh one buyer's usage counters from `GET /api/buyers/{id}/stats`
   *  and merge them into the cached record. Silent on failure — the list
   *  row keeps whatever it had (the stats are nice-to-have, the buyer isn't). */
  fetchStats: (id: string) => Promise<void>;
  getById: (id: string) => Buyer | undefined;
  add: (input: Omit<Buyer, "id" | "createdAt">) => Promise<Buyer>;
  update: (id: string, patch: Partial<Buyer>) => Promise<void>;
  /** Persist daily/monthly/concurrency caps via the dedicated
   *  `PATCH /api/buyers/{id}/cap` endpoint. Separate from `update` because
   *  the main update body doesn't accept cap fields. */
  updateCap: (
    id: string,
    cap: { daily?: number; monthly?: number; concurrency?: number },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: BuyerStatus) => Promise<void>;
  /** Save the buyer's CC limit (0 = unlimited) where routing reads it.
   *  Only that field changes locally - the row keeps its counters. */
  setConcurrency: (id: string, maxConcurrency: number) => Promise<void>;
}

export const useBuyersStore = create<BuyersState>()((set, get) => ({
  buyers: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      // Pull the first 200 — Phase 2 will add proper pagination plumbing
      // for tables that need to page past this.
      const page = await buyersService.list({ page: 1, pageSize: 200 });
      set({ buyers: page.items, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  fetchStats: (id) => {
    // Already queued or on its way, or the endpoint is failing: nothing to do.
    if (statsPending.has(id) || Date.now() < statsPausedUntil) return Promise.resolve();
    statsPending.add(id);
    return new Promise<void>((resolve) => {
      statsQueue.push(async () => {
        try {
          if (Date.now() < statsPausedUntil) return;
          const stats = await buyersService.getStats(id);
          set((s) => ({
            buyers: s.buyers.map((b) => (b.id === id ? { ...b, ...stats } : b)),
          }));
        } catch (e) {
          // Keep the cached counters; don't surface an error for a side-panel stat.
          // The server itself failing (500...): stop asking for a minute.
          const status = (e as { status?: number })?.status ?? 0;
          if (status >= 500) {
            // The jobs still queued see the pause and finish without a request.
            statsPausedUntil = Date.now() + STATS_PAUSE_MS;
          }
        } finally {
          statsPending.delete(id);
          resolve();
        }
      });
      runStatsQueue();
    });
  },

  getById: (id) => get().buyers.find((b) => b.id === id),

  add: async (input) => {
    const created = await buyersService.create(input);
    set((s) => ({ buyers: [created, ...s.buyers] }));
    // The server invites the contact email when the buyer is created. If that
    // email was used before (say, by a deleted buyer), this is still a NEW
    // invitation: forget anything this browser learned about it.
    markInvited([created.email ?? (input as { email?: string }).email]);
    return created;
  },

  update: async (id, patch) => {
    const prev = get().buyers;
    // Optimistic mutation so the UI flips immediately.
    set((s) => ({
      buyers: s.buyers.map((b) => (b.id === id ? { ...b, ...patch } : b)),
    }));
    try {
      const fresh = await buyersService.update(id, patch);
      set((s) => ({
        buyers: s.buyers.map((b) => (b.id === id ? fresh : b)),
      }));
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().buyers;
    const removed = prev.find((x) => x.id === id);
    set((s) => ({ buyers: s.buyers.filter((b) => b.id !== id) }));
    try {
      await buyersService.remove(id);
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
    // Deleted: everything this browser kept about its people goes too, so the
    // same email invited again later starts from scratch.
    forgetPartner("buyer", id, removed?.email);
  },

  updateCap: async (id, cap) => {
    const prev = get().buyers;
    // Optimistic — flip the cap fields locally so the form responds before
    // the round-trip completes.
    set((s) => ({
      buyers: s.buyers.map((b) =>
        b.id === id
          ? {
              ...b,
              ...(cap.daily !== undefined ? { dailyCap: cap.daily } : {}),
              ...(cap.monthly !== undefined ? { monthlyCap: cap.monthly } : {}),
              ...(cap.concurrency !== undefined ? { concurrencyCap: cap.concurrency } : {}),
            }
          : b,
      ),
    }));
    try {
      await buyersService.updateCap(id, cap);
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setConcurrency: async (id, maxConcurrency) => {
    const prev = get().buyers;
    set((s) => ({
      buyers: s.buyers.map((b) =>
        b.id === id ? { ...b, concurrencyCap: maxConcurrency, concurrencyKnown: true } : b,
      ),
    }));
    try {
      const saved = await buyersService.setConcurrency(id, maxConcurrency);
      set((s) => ({
        buyers: s.buyers.map((b) => (b.id === id ? { ...b, concurrencyCap: saved, concurrencyKnown: true } : b)),
      }));
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setStatus: async (id, status) => {
    const prev = get().buyers;
    set((s) => ({
      buyers: s.buyers.map((b) => (b.id === id ? { ...b, status } : b)),
    }));
    try {
      await buyersService.setStatus(id, status);
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Buyers request failed";
}
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
import type { Buyer, BuyerStatus } from "@/lib/types";

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

  fetchStats: async (id) => {
    try {
      const stats = await buyersService.getStats(id);
      set((s) => ({
        buyers: s.buyers.map((b) => (b.id === id ? { ...b, ...stats } : b)),
      }));
    } catch {
      // Keep the cached counters; don't surface an error for a side-panel stat.
    }
  },

  getById: (id) => get().buyers.find((b) => b.id === id),

  add: async (input) => {
    const created = await buyersService.create(input);
    set((s) => ({ buyers: [created, ...s.buyers] }));
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
    set((s) => ({ buyers: s.buyers.filter((b) => b.id !== id) }));
    try {
      await buyersService.remove(id);
    } catch (e) {
      set({ buyers: prev, error: messageFromError(e) });
      throw e;
    }
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

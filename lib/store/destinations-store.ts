/**
 * Destinations store — backed by /api/destinations/*.
 *
 * Mirrors the buyers / campaigns store pattern: optimistic mutations against
 * the in-memory cache, with rollback on backend failure. Loads the full list
 * on first `fetch()` (the page does its own pagination + filtering client-
 * side against the cache). Header stats come from a separate endpoint.
 */

"use client";

import { create } from "zustand";

import {
  destinationsService,
  type DestinationStats,
} from "@/lib/api/services/destinations.service";
import type { Destination } from "@/lib/types";
import { useUIStore } from "@/lib/store/ui-store";

/** The time zone selected in the portal (same one Reports and the Dashboard
 *  use). Sent with the destinations list and stats so Daily and Monthly
 *  reset at the user's midnight, not UTC midnight. */
const portalTimezone = () => useUIStore.getState().reportTimezone;

interface DestinationsState {
  destinations: Destination[];
  stats: DestinationStats | null;
  loading: boolean;
  statsLoading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  fetchStats: () => Promise<void>;

  getById: (id: string) => Destination | undefined;
  add: (input: Omit<Destination, "id">) => Promise<Destination>;
  update: (id: string, patch: Partial<Destination>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setEnabled: (id: string, enabled: boolean) => Promise<void>;
}

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Destinations request failed";
}

export const useDestinationsStore = create<DestinationsState>()((set, get) => ({
  destinations: [],
  stats: null,
  loading: false,
  statsLoading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      // 500 page size matches our other "fetch the world" calls (numbers,
      // blocked-numbers). For tenants with > 500 destinations we'll need to
      // teach the page to ask the backend for filters; not yet a problem.
      const page = await destinationsService.list({ page: 1, pageSize: 500, timezone: portalTimezone() });
      set({ destinations: page.items, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e), hydrated: true });
    }
  },

  fetchStats: async () => {
    set({ statsLoading: true });
    try {
      const stats = await destinationsService.stats(portalTimezone());
      set({ stats, statsLoading: false });
    } catch {
      // Stats are nice-to-have; fall back to client-side computation in the
      // page if the endpoint is unavailable.
      set({ statsLoading: false });
    }
  },

  getById: (id) => get().destinations.find((d) => d.id === id),

  add: async (input) => {
    const created = await destinationsService.create(input);
    set((s) => ({ destinations: [created, ...s.destinations] }));
    // Header stats need a refresh — a new destination changes CC + TFN counts.
    void get().fetchStats();
    return created;
  },

  update: async (id, patch) => {
    const prev = get().destinations;
    const current = prev.find((d) => d.id === id);
    if (!current) return;
    const optimistic: Destination = { ...current, ...patch };
    set((s) => ({
      destinations: s.destinations.map((d) => (d.id === id ? optimistic : d)),
    }));
    try {
      const fresh = await destinationsService.update(id, patch);
      set((s) => ({
        destinations: s.destinations.map((d) => (d.id === id ? fresh : d)),
      }));
      void get().fetchStats();
    } catch (e) {
      set({ destinations: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().destinations;
    set((s) => ({ destinations: s.destinations.filter((d) => d.id !== id) }));
    try {
      await destinationsService.remove(id);
      void get().fetchStats();
    } catch (e) {
      set({ destinations: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setEnabled: async (id, enabled) => {
    const prev = get().destinations;
    set((s) => ({
      destinations: s.destinations.map((d) => (d.id === id ? { ...d, enabled } : d)),
    }));
    try {
      const fresh = await destinationsService.setEnabled(id, enabled);
      set((s) => ({
        destinations: s.destinations.map((d) => (d.id === id ? fresh : d)),
      }));
      void get().fetchStats();
    } catch (e) {
      set({ destinations: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));
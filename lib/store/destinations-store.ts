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
import { cloneName } from "../api/services/clone";

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
  /**
   * Play / pause several destinations (the bulk bar). One at a time, so the
   * server's "one live destination per number / per buyer" check sees each
   * change in turn; a refused one is put back on its own and reported, the
   * others keep their new state.
   */
  setEnabledMany: (
    ids: string[],
    enabled: boolean,
  ) => Promise<{ ok: string[]; failed: { id: string; message: string }[] }>;
  /**
   * Create a copy of a destination named "<name> (Clone)" with the same buyer,
   * number, caps, ring time, filters, business hours and time zone. The copy
   * starts switched OFF: the backend refuses two live destinations on one
   * number and more than one live destination per buyer.
   */
  clone: (id: string) => Promise<Destination>;
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

  clone: async (id) => {
    // Read the full destination from the server rather than trusting the
    // (possibly aggregate-shaped) copy in the list.
    const source = await destinationsService.get(id);
    return get().add({
      ...source,
      name: cloneName(source.name),
      enabled: false,
    } as Omit<Destination, "id">);
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
    // Remember only THIS destination's state: putting the whole list back on
    // a failure used to undo every other change made in the meantime.
    const before = get().destinations.find((d) => d.id === id)?.enabled;
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
      set((s) => ({
        destinations: s.destinations.map((d) => (d.id === id && before !== undefined ? { ...d, enabled: before } : d)),
        error: messageFromError(e),
      }));
      throw e;
    }
  },

  setEnabledMany: async (ids, enabled) => {
    const ok: string[] = [];
    const failed: { id: string; message: string }[] = [];
    for (const id of ids) {
      const current = get().destinations.find((d) => d.id === id);
      if (!current) continue;
      if (current.enabled === enabled) {
        ok.push(id); // already in that state - nothing to ask the server
        continue;
      }
      set((s) => ({ destinations: s.destinations.map((d) => (d.id === id ? { ...d, enabled } : d)) }));
      try {
        const fresh = await destinationsService.setEnabled(id, enabled);
        set((s) => ({ destinations: s.destinations.map((d) => (d.id === id ? fresh : d)) }));
        ok.push(id);
      } catch (e) {
        set((s) => ({
          destinations: s.destinations.map((d) => (d.id === id ? { ...d, enabled: current.enabled } : d)),
        }));
        failed.push({ id, message: messageFromError(e) });
      }
    }
    void get().fetchStats();
    return { ok, failed };
  },
}));
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
   * Play / pause several destinations (the bulk bar) in ONE request to
   * /api/destinations/bulk-enable (falls back to one request per TFN if that
   * endpoint is not there). A buyer may have many live TFNs; only two live
   * destinations on the SAME number are refused. A refused one is put back on
   * its own and reported, the others keep their new state.
   */
  setEnabledMany: (
    ids: string[],
    enabled: boolean,
  ) => Promise<{
    ok: string[];
    failed: { id: string; message: string }[];
    /** Selected, but another selected destination with the same number went live instead. */
    skipped: string[];
    /** Live destinations that were switched off to make room. */
    switchedOff: Destination[];
  }>;
  /**
   * Switch a destination ON. A buyer can have many live TFNs (calls rotate
   * across them), but one number can be live on only one destination, so a
   * live destination on the SAME number is switched OFF first - what the
   * server's own message asks the user to do by hand. Returns those it
   * switched off (usually none).
   */
  enableExclusive: (id: string) => Promise<Destination[]>;
  /**
   * Create a copy of a destination named "<name> (Clone)" with the same buyer,
   * number, caps, ring time, filters, business hours and time zone. The copy
   * starts switched OFF: the backend refuses two live destinations on one
   * number, and the copy has the same number as the original.
   */
  clone: (id: string) => Promise<Destination>;
}

/** A number's last 10 digits; an incomplete number only ever matches itself. */
function numberKey(tfn: string): string {
  const digits = (tfn ?? "").replace(/\D/g, "");
  return digits.length >= 10 ? digits.slice(-10) : `raw:${tfn ?? ""}`;
}

/** The bulk endpoint takes at most this many ids per request. */
const BULK_LIMIT = 500;

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
        destinations: s.destinations.map((d) => (d.id === id ? { ...fresh, enabled } : d)),
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

  enableExclusive: async (id) => {
    const target = get().destinations.find((d) => d.id === id);
    if (!target) return [];
    const sameNumber = (a: string, b: string) => numberKey(a) === numberKey(b);
    const blockers = () =>
      get().destinations.filter(
        // A buyer may have several live destinations (calls rotate across
        // them); only one may be live on the SAME number.
        (d) => d.id !== id && d.enabled && sameNumber(d.tfn, target.tfn),
      );
    const switchedOff: Destination[] = [];
    const clear = async () => {
      for (const b of blockers()) {
        const fresh = await destinationsService.setEnabled(b.id, false);
        set((s) => ({ destinations: s.destinations.map((d) => (d.id === b.id ? { ...fresh, enabled: false } : d)) }));
        switchedOff.push(b);
      }
    };
    await clear();
    try {
      const fresh = await destinationsService.setEnabled(id, true);
      set((s) => ({ destinations: s.destinations.map((d) => (d.id === id ? { ...fresh, enabled: true } : d)) }));
    } catch (e) {
      // The list on screen may be out of date (someone else switched one on):
      // reload it, clear again and try once more.
      await get().fetch();
      await clear();
      const fresh = await destinationsService.setEnabled(id, true).catch(() => {
        throw e;
      });
      set((s) => ({ destinations: s.destinations.map((d) => (d.id === id ? { ...fresh, enabled: true } : d)) }));
    }
    void get().fetchStats();
    return switchedOff;
  },

  setEnabledMany: async (ids, enabled) => {
    const ok: string[] = [];
    const failed: { id: string; message: string }[] = [];
    const skipped: string[] = [];
    const switchedOff: Destination[] = [];

    const all = get().destinations;
    const byId = new Map(all.map((d) => [d.id, d] as const));
    const selected = new Set(ids);

    // A buyer can have many live TFNs now, so every selected destination is
    // played. The one rule left: a number can be live on only one destination,
    // so of several selected ones on the SAME number, only one is played.
    // Ones already live keep their number first.
    const takenNumbers = new Set<string>();
    if (enabled) {
      for (const id of ids) {
        const d = byId.get(id);
        if (d?.enabled) takenNumbers.add(numberKey(d.tfn));
      }
    }
    const send: string[] = [];
    for (const id of ids) {
      const current = byId.get(id);
      if (!current) continue;
      if (current.enabled === enabled) {
        ok.push(id); // already in that state - nothing to ask the server
        continue;
      }
      if (enabled) {
        const key = numberKey(current.tfn);
        if (takenNumbers.has(key)) {
          skipped.push(id);
          continue;
        }
        takenNumbers.add(key);
      }
      send.push(id);
    }
    if (send.length === 0) return { ok, failed, skipped, switchedOff };

    /** Turn many on / off: one request per 500, or one per TFN if the bulk endpoint is missing. */
    const applyMany = async (list: string[], on: boolean) => {
      const done: string[] = [];
      const bad: { id: string; message: string }[] = [];
      for (let i = 0; i < list.length; i += BULK_LIMIT) {
        const chunk = list.slice(i, i + BULK_LIMIT);
        try {
          const res = await destinationsService.bulkEnable(chunk, on);
          const updated = new Set(res.updated);
          const refused = new Map(res.failed.map((f) => [f.id, f.reason] as const));
          for (const id of chunk) {
            if (updated.has(id)) done.push(id);
            else bad.push({ id, message: refused.get(id) ?? "No answer from the server for this destination" });
          }
        } catch {
          // Bulk endpoint not deployed yet (or it failed): the old way, one at a time.
          for (const id of chunk) {
            try {
              await destinationsService.setEnabled(id, on);
              done.push(id);
            } catch (e) {
              bad.push({ id, message: messageFromError(e) });
            }
          }
        }
      }
      return { done, bad };
    };

    // Playing: a live destination that is NOT selected but holds the same
    // number would make the server refuse ours, so switch it off first - the
    // same thing a single Play does.
    if (enabled) {
      const sendNumbers = new Set(send.map((id) => numberKey(byId.get(id)?.tfn ?? "")));
      const blockers = all.filter((d) => d.enabled && !selected.has(d.id) && sendNumbers.has(numberKey(d.tfn)));
      if (blockers.length) {
        const { done } = await applyMany(blockers.map((d) => d.id), false);
        const off = new Set(done);
        set((s) => ({ destinations: s.destinations.map((d) => (off.has(d.id) ? { ...d, enabled: false } : d)) }));
        switchedOff.push(...blockers.filter((d) => off.has(d.id)));
      }
    }

    // Show the change straight away; anything refused is put back below.
    const sending = new Set(send);
    set((s) => ({ destinations: s.destinations.map((d) => (sending.has(d.id) ? { ...d, enabled } : d)) }));

    const { done, bad } = await applyMany(send, enabled);
    ok.push(...done);
    failed.push(...bad);
    if (bad.length) {
      const back = new Map(bad.map((f) => [f.id, byId.get(f.id)?.enabled] as const));
      set((s) => ({
        destinations: s.destinations.map((d) => {
          const prev = back.get(d.id);
          return prev !== undefined ? { ...d, enabled: prev } : d;
        }),
      }));
    }
    void get().fetchStats();
    return { ok, failed, skipped, switchedOff };
  },
}));
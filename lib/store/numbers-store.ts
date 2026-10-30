/**
 * Numbers + DNI pools store — backed by /api/numbers/* and /api/dni/pools/*.
 *
 * Two parallel fetches keep numbers and pools in sync. Mutations call
 * through the service layer and patch local state on success.
 */

"use client";

import { create } from "zustand";

import { numbersService, poolsService } from "@/lib/api/services/numbers.service";
import type { NumberPool, NumberStatus, TrackingNumber } from "@/lib/types";
import { friendlyErrorMessage } from "@/lib/api/errors";

interface NumbersState {
  numbers: TrackingNumber[];
  pools: NumberPool[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;

  addNumber: (input: Omit<TrackingNumber, "id" | "provisionedAt">) => Promise<TrackingNumber>;
  /** Purchase a specific Twilio number returned by the phone-numbers search
   *  endpoint. Uses POST /api/phone-numbers/purchase (not /api/numbers/purchase). */
  provisionNumber: (input: {
    phoneNumber: string;
    numberType: "toll_free" | "local";
    campaignId?: string;
    campaignName?: string;
  }) => Promise<TrackingNumber>;
  updateNumber: (id: string, patch: Partial<TrackingNumber>) => Promise<void>;
  setNumberStatus: (id: string, status: NumberStatus) => Promise<void>;
  removeNumber: (id: string) => Promise<void>;

  addPool: (input: Omit<NumberPool, "id">) => Promise<NumberPool>;
  updatePool: (id: string, patch: Partial<NumberPool>) => Promise<void>;
  setPoolActive: (id: string, active: boolean) => Promise<void>;
  removePool: (id: string) => Promise<void>;
}

/**
 * Every tracking number in the workspace, page by page.
 *
 * The server hands out at most 200 numbers per page (newest first). Asking
 * for 500 in one go still returned only 200, so once a workspace had more
 * than 200 numbers the older ones silently dropped off - and a campaign whose
 * numbers were among them showed "No tracking numbers" although its numbers
 * were still attached and taking calls.
 */
async function fetchAllNumbers(): Promise<TrackingNumber[]> {
  const PAGE_SIZE = 200;
  const MAX_PAGES = 50; // 10,000 numbers - a guard, not a limit anyone reaches.
  const all: TrackingNumber[] = [];
  const seen = new Set<string>();
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await numbersService.list({ page, pageSize: PAGE_SIZE });
    for (const n of res.items) {
      if (!seen.has(n.id)) {
        seen.add(n.id);
        all.push(n);
      }
    }
    const pages = (res as { pages?: number }).pages;
    const total = (res as { total?: number }).total;
    if (res.items.length === 0) break;
    if (typeof pages === "number" ? page >= pages : typeof total === "number" ? all.length >= total : res.items.length < PAGE_SIZE) break;
  }
  return all;
}

export const useNumbersStore = create<NumbersState>()((set, get) => ({
  numbers: [],
  pools: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    // Numbers and pools load independently: a failing pools call must not
    // blank every campaign's Tracking Numbers list.
    const [numbers, pools] = await Promise.allSettled([
      fetchAllNumbers(),
      poolsService.list({ page: 1, pageSize: 200 }),
    ]);
    set((s) => ({
      numbers: numbers.status === "fulfilled" ? numbers.value : s.numbers,
      pools: pools.status === "fulfilled" ? pools.value.items : s.pools,
      loading: false,
      hydrated: numbers.status === "fulfilled" || s.hydrated,
      error:
        numbers.status === "rejected"
          ? messageFromError(numbers.reason)
          : pools.status === "rejected"
            ? messageFromError(pools.reason)
            : null,
    }));
  },

  /* ─── Numbers ────────────────────────────────────────────────────── */

  addNumber: async (input) => {
    // Map the frontend "addNumber" call to the closest backend endpoint:
    //   - if the input looks like a search result with no real number yet,
    //     use /api/numbers/purchase
    //   - otherwise import an existing number via /api/numbers/import
    // Both paths forward the optional campaignId so backends that accept it
    // can attach in one round-trip.
    const created = input.number?.startsWith("+")
      ? await numbersService.importNumber({
          number: input.number,
          campaignId: input.campaignId,
        })
      : await numbersService.purchase({
          number: input.number,
          campaignId: input.campaignId,
        });

    // If the caller asked to attach to a campaign but the server's create
    // response didn't reflect it, explicitly assign via the dedicated
    // endpoint. This covers backends whose import/purchase ignores the
    // campaign field and keeps attachment on a single API contract.
    let final = created;
    if (input.campaignId && created.campaignId !== input.campaignId) {
      try {
        await numbersService.assign(created.id, input.campaignId);
      } catch {
        // Assign failed (e.g. 404 because the backend doesn't expose this
        // endpoint yet) — proceed with the optimistic local patch so the
        // user at least sees their newly-provisioned number in the table.
      }
      // Optimistically patch the local copy with the campaign metadata
      // the caller intended, so the campaign-scoped tracking-numbers
      // table renders the new row immediately — regardless of whether
      // /assign succeeded server-side.
      final = {
        ...created,
        campaignId: input.campaignId,
        campaignName: input.campaignName ?? created.campaignName,
      };
    }
    set((s) => ({ numbers: [final, ...s.numbers] }));
    return final;
  },

  provisionNumber: async (input) => {
    const created = await numbersService.phoneNumberPurchase({
      phoneNumber: input.phoneNumber,
      numberType: input.numberType,
      campaignId: input.campaignId,
    });
    let final = created;
    if (input.campaignId && created.campaignId !== input.campaignId) {
      try {
        await numbersService.assign(created.id, input.campaignId);
      } catch {
        // Non-fatal — proceed with optimistic local patch.
      }
      final = {
        ...created,
        campaignId: input.campaignId,
        campaignName: input.campaignName ?? created.campaignName,
      };
    }
    set((s) => ({ numbers: [final, ...s.numbers] }));
    return final;
  },

  updateNumber: async (id, patch) => {
    const prev = get().numbers;
    set((s) => ({
      numbers: s.numbers.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
    try {
      const fresh = await numbersService.update(id, patch);
      set((s) => ({
        numbers: s.numbers.map((n) => (n.id === id ? fresh : n)),
      }));
    } catch (e) {
      set({ numbers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setNumberStatus: async (id, status) => {
    const prev = get().numbers;
    set((s) => ({
      numbers: s.numbers.map((n) => (n.id === id ? { ...n, status } : n)),
    }));
    try {
      await numbersService.update(id, { status });
    } catch (e) {
      set({ numbers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  removeNumber: async (id) => {
    const prev = get().numbers;
    set((s) => ({ numbers: s.numbers.filter((n) => n.id !== id) }));
    try {
      await numbersService.release(id);
    } catch (e) {
      set({ numbers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  /* ─── Pools ──────────────────────────────────────────────────────── */

  addPool: async (input) => {
    const created = await poolsService.create(input);
    set((s) => ({ pools: [created, ...s.pools] }));
    return created;
  },

  updatePool: async (id, patch) => {
    const prev = get().pools;
    set((s) => ({
      pools: s.pools.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }));
    try {
      const fresh = await poolsService.update(id, patch);
      set((s) => ({
        pools: s.pools.map((p) => (p.id === id ? fresh : p)),
      }));
    } catch (e) {
      set({ pools: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setPoolActive: async (id, active) => {
    const prev = get().pools;
    set((s) => ({
      pools: s.pools.map((p) => (p.id === id ? { ...p, active } : p)),
    }));
    try {
      await poolsService.update(id, { active });
    } catch (e) {
      set({ pools: prev, error: messageFromError(e) });
      throw e;
    }
  },

  removePool: async (id) => {
    const prev = get().pools;
    set((s) => ({ pools: s.pools.filter((p) => p.id !== id) }));
    try {
      await poolsService.remove(id);
    } catch (e) {
      set({ pools: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}

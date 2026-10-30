/**
 * VoIP Shield store — backed by /api/spam/shields/ (shieldType=voip).
 *
 * Holds shield records + helpers for managing protected campaigns and
 * blocked carriers from the detail page. Mutations hit the backend and
 * patch local state on success.
 */

"use client";

import { create } from "zustand";

import { spamService, type Shield } from "@/lib/api/services/spam.service";
import type { VoipShieldEntry } from "@/lib/mock/suppression";
import { friendlyErrorMessage } from "@/lib/api/errors";

interface VoipShieldState {
  shields: VoipShieldEntry[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  getById: (id: string) => VoipShieldEntry | undefined;
  add: (name: string) => Promise<VoipShieldEntry>;
  rename: (id: string, name: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setCampaigns: (id: string, campaignIds: string[]) => Promise<void>;
  addCampaign: (id: string, campaignId: string) => Promise<void>;
  removeCampaign: (id: string, campaignId: string) => Promise<void>;
  addCarrier: (id: string, carrier: string) => Promise<void>;
  removeCarrier: (id: string, carrier: string) => Promise<void>;
}

function shieldToEntry(s: Shield): VoipShieldEntry {
  return {
    id: s.id,
    name: s.name,
    campaignIds: s.campaignIds,
    blockedCarriers: s.blockedCarriers,
  };
}

export const useVoipShieldStore = create<VoipShieldState>()((set, get) => ({
  shields: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const items = await spamService.listShields({ shieldType: "voip" });
      set({ shields: items.map(shieldToEntry), loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  getById: (id) => get().shields.find((s) => s.id === id),

  add: async (name) => {
    const created = await spamService.createShield({ name, shieldType: "voip" });
    const entry = shieldToEntry(created);
    set((s) => ({ shields: [entry, ...s.shields] }));
    return entry;
  },

  rename: async (id, name) => {
    const prev = get().shields;
    set((s) => ({ shields: s.shields.map((x) => (x.id === id ? { ...x, name } : x)) }));
    try {
      await spamService.updateShield(id, { name });
    } catch (e) {
      set({ shields: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().shields;
    set((s) => ({ shields: s.shields.filter((x) => x.id !== id) }));
    try {
      await spamService.deleteShield(id);
    } catch (e) {
      set({ shields: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setCampaigns: async (id, campaignIds) => {
    const prev = get().shields;
    set((s) => ({
      shields: s.shields.map((x) => (x.id === id ? { ...x, campaignIds } : x)),
    }));
    try {
      await spamService.updateShield(id, { campaignIds });
    } catch (e) {
      set({ shields: prev, error: messageFromError(e) });
      throw e;
    }
  },

  addCampaign: async (id, campaignId) => {
    const current = get().shields.find((x) => x.id === id);
    if (!current || current.campaignIds.includes(campaignId)) return;
    await get().setCampaigns(id, [...current.campaignIds, campaignId]);
  },

  removeCampaign: async (id, campaignId) => {
    const current = get().shields.find((x) => x.id === id);
    if (!current) return;
    await get().setCampaigns(id, current.campaignIds.filter((c) => c !== campaignId));
  },

  addCarrier: async (id, carrier) => {
    const current = get().shields.find((x) => x.id === id);
    if (!current || current.blockedCarriers.includes(carrier)) return;
    const next = [...current.blockedCarriers, carrier];
    const prev = get().shields;
    // Optimistic flip while the PATCH is in flight.
    set((s) => ({
      shields: s.shields.map((x) => (x.id === id ? { ...x, blockedCarriers: next } : x)),
    }));
    try {
      const updated = await spamService.updateShield(id, { blockedCarriers: next });
      // Reconcile with backend reality. If the backend silently dropped
      // `blocked_carriers` from the patch (it's currently not in their
      // PATCH-allowed field list), `updated.blockedCarriers` will still be
      // the OLD list — and the UI reverts NOW instead of on refresh.
      set((s) => ({
        shields: s.shields.map((x) =>
          x.id === id ? { ...x, blockedCarriers: updated.blockedCarriers } : x,
        ),
      }));
    } catch (e) {
      set({ shields: prev, error: messageFromError(e) });
      throw e;
    }
  },

  removeCarrier: async (id, carrier) => {
    const current = get().shields.find((x) => x.id === id);
    if (!current) return;
    const next = current.blockedCarriers.filter((c) => c !== carrier);
    const prev = get().shields;
    set((s) => ({
      shields: s.shields.map((x) => (x.id === id ? { ...x, blockedCarriers: next } : x)),
    }));
    try {
      const updated = await spamService.updateShield(id, { blockedCarriers: next });
      set((s) => ({
        shields: s.shields.map((x) =>
          x.id === id ? { ...x, blockedCarriers: updated.blockedCarriers } : x,
        ),
      }));
    } catch (e) {
      set({ shields: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}

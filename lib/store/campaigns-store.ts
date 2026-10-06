/**
 * Campaigns store — backed by /api/campaigns/*.
 * Mirrors the buyers store pattern.
 */

"use client";

import { create } from "zustand";

import { campaignsService } from "@/lib/api/services/campaigns.service";
import type { Campaign, CampaignStatus } from "@/lib/types";

interface CampaignsState {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  getById: (id: string) => Campaign | undefined;
  add: (input: Omit<Campaign, "id" | "createdAt">) => Promise<Campaign>;
  update: (id: string, patch: Partial<Campaign>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: CampaignStatus) => Promise<void>;
  /** Set the concurrent-call (CC) limit; 0 = unlimited. Other caps are kept. */
  setConcurrency: (id: string, maxConcurrency: number) => Promise<void>;
}

export const useCampaignsStore = create<CampaignsState>()((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const page = await campaignsService.list({ page: 1, pageSize: 200 });
      set({ campaigns: page.items, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  getById: (id) => get().campaigns.find((c) => c.id === id),

  add: async (input) => {
    const created = await campaignsService.create(input);
    set((s) => ({ campaigns: [created, ...s.campaigns] }));
    return created;
  },

  update: async (id, patch) => {
    const prev = get().campaigns;
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
    try {
      const fresh = await campaignsService.update(id, patch);
      set((s) => ({
        campaigns: s.campaigns.map((c) => (c.id === id ? fresh : c)),
      }));
    } catch (e) {
      set({ campaigns: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().campaigns;
    set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) }));
    try {
      await campaignsService.remove(id);
    } catch (e) {
      set({ campaigns: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setConcurrency: async (id, maxConcurrency) => {
    const prev = get().campaigns;
    const c = prev.find((x) => x.id === id);
    if (!c) return;
    set({ campaigns: prev.map((x) => (x.id === id ? { ...x, maxConcurrency } : x)) });
    try {
      await campaignsService.saveCaps(id, {
        maxConcurrency,
        dailyCap: c.dailyCap ?? 0,
        monthlyCap: c.monthlyCap ?? 0,
        globalCap: c.globalCap ?? 0,
      });
    } catch (e) {
      set({ campaigns: prev });
      throw e;
    }
  },

  setStatus: async (id, status) => {
    const prev = get().campaigns;
    set((s) => ({
      campaigns: s.campaigns.map((c) => (c.id === id ? { ...c, status } : c)),
    }));
    try {
      await campaignsService.setStatus(id, status);
    } catch (e) {
      set({ campaigns: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Campaigns request failed";
}
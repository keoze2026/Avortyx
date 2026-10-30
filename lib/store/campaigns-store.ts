/**
 * Campaigns store — backed by /api/campaigns/*.
 * Mirrors the buyers store pattern.
 */

"use client";

import { create } from "zustand";

import { campaignsService } from "@/lib/api/services/campaigns.service";
import { routingService } from "@/lib/api/services/routing.service";
import { allowedCampaignIds } from "@/lib/partner-campaign-scope";
import { useAuthStore } from "@/lib/store/auth-store";
import { createLocalSwitches, inBatches, type ManyResult } from "@/lib/store/local-switches";
import type { Campaign, CampaignStatus } from "@/lib/types";
import { cloneName } from "../api/services/clone";
import { friendlyErrorMessage } from "@/lib/api/errors";

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
  /** Play / pause many at once: the switches move together and stay put
   *  while the server catches up; anything it refuses is put back (CH-268). */
  setStatusMany: (ids: string[], status: CampaignStatus) => Promise<ManyResult>;
  /** Set the concurrent-call (CC) limit; 0 = unlimited. Other caps are kept. */
  setConcurrency: (id: string, maxConcurrency: number) => Promise<void>;
  /** Save the campaign's daily call cap (0 = unlimited). The other caps are
   *  sent unchanged, because the cap endpoint treats a missing cap as 0. */
  setDailyCap: (id: string, dailyCap: number) => Promise<void>;
  /** Save all of a campaign's caps at once (the campaign page's Call caps card). */
  setCaps: (
    id: string,
    caps: { dailyCap: number; monthlyCap: number; maxConcurrency: number; globalCap: number },
  ) => Promise<void>;
  /**
   * Create a copy of a campaign named "<name> (Clone)". Copies everything the
   * campaign itself stores (payout, caps, schedule, call audio, duplicate
   * blocking and all advanced settings) and its routing: every rule with its
   * conditions and routed destinations, so the copy shows them the moment it
   * opens (CH-198). Tracking numbers are NOT copied: a TFN belongs to one
   * campaign.
   * The copy starts paused. Resolves with the new campaign.
   */
  clone: (id: string) => Promise<Campaign>;
}

export const useCampaignsStore = create<CampaignsState>()((set, get) => ({
  campaigns: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const startedAt = Date.now();
      const page = await campaignsService.list({ page: 1, pageSize: 200 });
      // A publisher / buyer login sees only the campaigns assigned to it. The
      // server still sends every campaign (backend fix pending), so the
      // others are dropped here, before any screen, filter or dropdown sees them.
      const user = useAuthStore.getState().user;
      const allowed = await allowedCampaignIds(user?.role, user?.id);
      const listed = allowed ? page.items.filter((c) => allowed.has(c.id)) : page.items;
      // Keep play / pause clicked here while this load was on its way: the
      // list can be older than the click (CH-268).
      const onScreen = new Map(get().campaigns.map((c) => [c.id, c.status] as const));
      const campaigns = listed.map((c) =>
        switches.changedSince(c.id, startedAt) && onScreen.has(c.id) ? { ...c, status: onScreen.get(c.id)! } : c,
      );
      set({ campaigns, loading: false, hydrated: true });
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

  setDailyCap: async (id, dailyCap) => {
    const prev = get().campaigns;
    const c = prev.find((x) => x.id === id);
    if (!c) return;
    set({ campaigns: prev.map((x) => (x.id === id ? { ...x, dailyCap } : x)) });
    try {
      await campaignsService.saveCaps(id, {
        maxConcurrency: c.maxConcurrency ?? 0,
        dailyCap,
        monthlyCap: c.monthlyCap ?? 0,
        globalCap: c.globalCap ?? 0,
      });
    } catch (e) {
      set({ campaigns: prev });
      throw e;
    }
  },

  setCaps: async (id, caps) => {
    const prev = get().campaigns;
    set({
      campaigns: prev.map((x) =>
        x.id === id
          ? { ...x, dailyCap: caps.dailyCap, monthlyCap: caps.monthlyCap, maxConcurrency: caps.maxConcurrency, globalCap: caps.globalCap }
          : x,
      ),
    });
    try {
      await campaignsService.saveCaps(id, caps);
    } catch (e) {
      set({ campaigns: prev });
      throw e;
    }
  },

  clone: async (id) => {
    // Read the FULL campaign from the server. The list the table is built
    // from leaves out the advanced settings, call audio and schedule.
    const source = await campaignsService.get(id);

    // Always created paused (see campaignsService.create).
    const created = await campaignsService.create({
      ...source,
      name: cloneName(source.name),
    } as Omit<Campaign, "id" | "createdAt">);

    try {
      // create() cannot carry the settings below, so copy them across now.
      await campaignsService.saveCaps(created.id, {
        maxConcurrency: source.maxConcurrency ?? 0,
        dailyCap: source.dailyCap ?? 0,
        monthlyCap: source.monthlyCap ?? 0,
        globalCap: source.globalCap ?? 0,
      });
      const full = await campaignsService.update(created.id, {
        advancedSettings: source.advancedSettings,
        recordingEnabled: source.recordingEnabled,
        greetingEnabled: source.greetingEnabled,
        greetingMessage: source.greetingMessage,
        whisperEnabled: source.whisperEnabled,
        whisperMessage: source.whisperMessage,
        duplicateCallBlock: source.duplicateCallBlock,
        duplicateCallBlockHours: source.duplicateCallBlockHours,
      });
      await copyRouting(id, created.id);
      set((s) => ({ campaigns: [full, ...s.campaigns] }));
      return full;
    } catch (e) {
      // Don't leave a half-copied campaign behind.
      await campaignsService.remove(created.id).catch(() => undefined);
      throw e;
    }
  },

  setStatus: async (id, status) => {
    const { failed } = await get().setStatusMany([id], status);
    if (failed.length) throw new Error(failed[0].message);
  },

  setStatusMany: async (ids, status) => {
    // Remember each row's own status: putting the whole list back on one
    // refusal used to undo every other row switched in the same click.
    const before = new Map(
      get().campaigns.filter((c) => ids.includes(c.id)).map((c) => [c.id, c.status] as const),
    );
    const send = [...before.keys()].filter((id) => before.get(id) !== status);
    const ok = [...before.keys()].filter((id) => before.get(id) === status);
    const failed: ManyResult["failed"] = [];
    if (send.length === 0) return { ok, failed };

    switches.start(send);
    set((s) => ({
      campaigns: s.campaigns.map((c) => (send.includes(c.id) ? { ...c, status } : c)),
    }));
    try {
      await inBatches(send, 4, async (id) => {
        try {
          await campaignsService.setStatus(id, status);
          ok.push(id);
        } catch (e) {
          failed.push({ id, message: messageFromError(e) });
        }
      });
    } finally {
      switches.end(send);
    }
    if (failed.length) {
      const back = new Set(failed.map((f) => f.id));
      set((s) => ({
        campaigns: s.campaigns.map((c) => (back.has(c.id) ? { ...c, status: before.get(c.id)! } : c)),
        error: failed[0].message,
      }));
    }
    return { ok, failed };
  },
}));

const switches = createLocalSwitches();

/**
 * Copy a campaign's routing to another campaign: each rule with its conditions
 * and its routed destinations (buyer TFNs), with the same priority, weight and
 * on/off state (CH-198). Cloning used to leave ROUTED DESTINATIONS empty, and
 * the team re-added every destination by hand before the copy could take calls.
 */
async function copyRouting(sourceCampaignId: string, targetCampaignId: string): Promise<void> {
  const rules = await routingService.listRules({ campaignId: sourceCampaignId, pageSize: 50 });
  for (const rule of rules.items) {
    const copy = await routingService.createRule({
      name: rule.name,
      ruleType: rule.ruleType,
      campaignId: targetCampaignId,
      priority: rule.priority,
    });
    for (const c of rule.conditions ?? []) {
      await routingService.addCondition(copy.id, c.conditions);
    }
    const destinations = await routingService.listDestinations(rule.id);
    for (const d of destinations) {
      if (!d.destination) continue;
      await routingService.addDestination(copy.id, {
        destination: d.destination,
        destinationType: d.destinationType,
        buyerId: d.buyerId,
        weight: d.weight,
        priority: d.priority,
        revenue: d.revenue != null ? Number(d.revenue) : null,
        convertOn: d.convertOn || "",
        convertSeconds: d.convertSeconds ?? 0,
      });
    }
    // New rules start active; keep a paused one paused.
    if (rule.status === "paused") {
      await routingService.updateRule(copy.id, { status: "paused" });
    }
  }
}

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}
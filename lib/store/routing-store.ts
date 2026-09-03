/**
 * Routing store — backed by /api/routing/rules/*.
 *
 * The frontend's visual graph model is round-tripped through the backend's
 * flat rules + conditions + destinations shape via `lib/routing-bridge.ts`.
 * Mutations call the service and mirror the result locally.
 */

"use client";

import { create } from "zustand";

import { routingService } from "@/lib/api/services/routing.service";
import { flattenPlan, reconstructPlan } from "@/lib/routing-bridge";
import type { RoutingEdge, RoutingNode, RoutingPlan, RoutingPlanStatus } from "@/lib/types";

interface RoutingState {
  plans: RoutingPlan[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  /**
   * Refresh a single plan from `GET /api/routing/rules/{id}` and upsert it
   * into `plans`. `fetch()` populates the store from the paginated LIST
   * endpoint, which many backends serialize slim (omitting nested
   * conditions/destinations); the editor calls this on open so it always
   * works from the fully-detailed record instead of whatever the list
   * happened to include.
   */
  fetchOne: (id: string) => Promise<void>;
  getById: (id: string) => RoutingPlan | undefined;
  add: (input: Omit<RoutingPlan, "id" | "createdAt" | "updatedAt">) => Promise<RoutingPlan>;
  remove: (id: string) => Promise<void>;
  setStatus: (id: string, status: RoutingPlanStatus) => Promise<void>;

  /** Replace a plan's nodes & edges in one shot — persists to the backend. */
  setGraph: (id: string, nodes: RoutingNode[], edges: RoutingEdge[]) => Promise<void>;
  /** Patch a single node's data (e.g. from the inspector). Local only — call
   *  setGraph to persist accumulated edits. */
  patchNodeData: (planId: string, nodeId: string, data: Partial<RoutingNode["data"]>) => void;
}

export const useRoutingStore = create<RoutingState>()((set, get) => ({
  plans: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const page = await routingService.listRules({ page: 1, pageSize: 200 });
      set({
        plans: page.items.map((r) => reconstructPlan(r)),
        loading: false,
        hydrated: true,
      });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  fetchOne: async (id) => {
    const rule = await routingService.getRule(id);
    const existing = get().plans.find((p) => p.id === id);
    const plan = reconstructPlan(rule, existing?.createdAt);
    set((s) => {
      const idx = s.plans.findIndex((p) => p.id === id);
      if (idx === -1) return { plans: [plan, ...s.plans] };
      const next = s.plans.slice();
      next[idx] = plan;
      return { plans: next };
    });
  },

  getById: (id) => get().plans.find((p) => p.id === id),

  add: async (input) => {
    const draft: RoutingPlan = {
      ...input,
      id: "tmp",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const flat = flattenPlan(draft);
    // Create the bare rule first — conditions + destinations are seeded in
    // separate POSTs since the backend exposes them as child endpoints.
    const created = await routingService.createRule({
      name: flat.rule.name,
      ruleType: flat.rule.ruleType,
      campaignId: flat.rule.campaignId,
      priority: flat.rule.priority,
    });
    // Push the visual graph as the first condition.
    try {
      await routingService.addCondition(created.id, flat.conditionBlob);
    } catch {
      // Non-fatal — the rule still exists; the graph can be saved later.
    }
    // Surface buyer destinations.
    for (const d of flat.destinations) {
      try {
        await routingService.addDestination(created.id, {
          buyerId: d.buyerId,
          weight: d.weight,
          priority: d.priority,
        });
      } catch {
        // Skip individual failures; the bridge will reconstruct from the blob.
      }
    }
    // Re-fetch the freshly-created rule so we have the full server-side shape.
    const fresh = await routingService.getRule(created.id);
    const plan = reconstructPlan(fresh, draft.createdAt);
    set((s) => ({ plans: [plan, ...s.plans] }));
    return plan;
  },

  remove: async (id) => {
    const prev = get().plans;
    set((s) => ({ plans: s.plans.filter((p) => p.id !== id) }));
    try {
      await routingService.deleteRule(id);
    } catch (e) {
      set({ plans: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setStatus: async (id, status) => {
    const prev = get().plans;
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === id ? { ...p, status, updatedAt: Date.now() } : p,
      ),
    }));
    try {
      const wireStatus =
        status === "published" ? "active" : status === "archived" ? "paused" : "draft";
      await routingService.updateRule(id, { status: wireStatus });
    } catch (e) {
      set({ plans: prev, error: messageFromError(e) });
      throw e;
    }
  },

  setGraph: async (id, nodes, edges) => {
    const current = get().plans.find((p) => p.id === id);
    if (!current) return;
    const next: RoutingPlan = { ...current, nodes, edges, updatedAt: Date.now() };
    const prev = get().plans;
    // Optimistic local update.
    set((s) => ({ plans: s.plans.map((p) => (p.id === id ? next : p)) }));
    try {
      const flat = flattenPlan(next);
      // Replace the synthetic graph condition.
      // Backend exposes `addCondition` for now (no PATCH/DELETE on individual
      // conditions in the spec we have), so we just append a fresh one. The
      // bridge picks the latest blob on reconstruct.
      await routingService.addCondition(id, flat.conditionBlob);
    } catch (e) {
      set({ plans: prev, error: messageFromError(e) });
      throw e;
    }
  },

  patchNodeData: (planId, nodeId, data) =>
    set((s) => ({
      plans: s.plans.map((p) =>
        p.id === planId
          ? {
              ...p,
              nodes: p.nodes.map((n) =>
                n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
              ),
              updatedAt: Date.now(),
            }
          : p,
      ),
    })),
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Routing request failed";
}

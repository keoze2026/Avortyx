/**
 * Routing service — talks to /api/routing/rules/*.
 *
 * Returns frontend-shaped routing rules. Conditions + destinations are
 * embedded children; the spec exposes them as nested arrays plus POST
 * helpers for `add-condition` / `add-destination`.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

export type RoutingRuleStatus = "active" | "paused" | "draft";

export interface RoutingCondition {
  id: string;
  /** Free-form key/value bag (operator, field, value, …) — backend stores them
   *  as a JSON blob so the frontend can render whatever editor it wants. */
  conditions: Record<string, unknown>;
}

export interface RoutingDestination {
  id: string;
  /** Backend models destinations as { buyer_id, weight, priority, … }. */
  buyerId?: string;
  buyerName?: string;
  weight?: number;
  priority?: number;
}

export interface RoutingRule {
  id: string;
  name: string;
  ruleType: string;
  priority: number;
  status: RoutingRuleStatus;
  campaignId: string;
  campaignName: string;
  conditions: RoutingCondition[];
  destinations: RoutingDestination[];
}

export interface SimulateMatchedCondition {
  conditionId: string;
  matched: boolean;
}

export interface SimulateSelectedDestination {
  id: string;
  name: string;
  buyerName: string;
  weight: number;
  priority: number;
}

export interface SimulateTraceStep {
  step: string;
  outcome: string;
}

export interface SimulateResult {
  matchedConditions: SimulateMatchedCondition[];
  selectedDestination?: SimulateSelectedDestination;
  trace: SimulateTraceStep[];
}

interface RoutingRuleWire {
  id: string;
  name: string;
  ruleType: string;
  priority: number;
  status: string;
  campaignId: string;
  campaignName: string;
  conditions?: Array<{ id: string; conditions: Record<string, unknown> }>;
  destinations?: Array<{
    id: string;
    buyerId?: string;
    buyerName?: string;
    weight?: number;
    priority?: number;
  }>;
}

function normalizeStatus(raw: string | null | undefined): RoutingRuleStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paused" || s === "draft") return s;
  return "active";
}

function wireToRule(w: RoutingRuleWire): RoutingRule {
  return {
    id: w.id,
    name: w.name,
    ruleType: w.ruleType,
    priority: w.priority,
    status: normalizeStatus(w.status),
    campaignId: w.campaignId,
    campaignName: w.campaignName,
    conditions: (w.conditions ?? []).map((c) => ({
      id: c.id,
      conditions: c.conditions,
    })),
    destinations: (w.destinations ?? []).map((d) => ({
      id: d.id,
      buyerId: d.buyerId,
      buyerName: d.buyerName,
      weight: d.weight,
      priority: d.priority,
    })),
  };
}

export const routingService = {
  async listRules(
    query: { page?: number; pageSize?: number; campaignId?: string } = {},
  ): Promise<Paginated<RoutingRule>> {
    const res = await http.get<Paginated<RoutingRuleWire>>("/api/routing/rules", { query });
    return { ...res, items: res.items.map(wireToRule) };
  },

  async getRule(id: string): Promise<RoutingRule> {
    return wireToRule(await http.get<RoutingRuleWire>(`/api/routing/rules/${id}`));
  },

  async createRule(input: {
    name: string;
    ruleType: string;
    campaignId: string;
    priority?: number;
  }): Promise<RoutingRule> {
    return wireToRule(
      await http.post<RoutingRuleWire>("/api/routing/rules", { body: input }),
    );
  },

  async updateRule(id: string, patch: Partial<RoutingRule>): Promise<RoutingRule> {
    return wireToRule(
      await http.patch<RoutingRuleWire>(`/api/routing/rules/${id}`, { body: patch }),
    );
  },

  async deleteRule(id: string): Promise<void> {
    await http.delete(`/api/routing/rules/${id}`);
  },

  async addCondition(ruleId: string, conditions: Record<string, unknown>): Promise<RoutingCondition> {
    return http.post<RoutingCondition>(`/api/routing/rules/${ruleId}/conditions`, {
      body: { conditions },
    });
  },

  /**
   * Attach a destination to a rule.
   *
   * `destination` is the number calls are dialed to and the backend requires
   * it — CreateDestinationSchema raises "destination or phone_number is
   * required" without one. This method only ever sent buyerId, weight and
   * priority, so every call to it failed; nothing in the app called it, which
   * is why that went unnoticed.
   */
  async addDestination(
    ruleId: string,
    destination: {
      destination: string;
      buyerId?: string;
      destinationType?: string;
      weight?: number;
      priority?: number;
    },
  ): Promise<RoutingDestination> {
    return http.post<RoutingDestination>(`/api/routing/rules/${ruleId}/destinations`, {
      body: {
        destination: destination.destination,
        destinationType: destination.destinationType ?? "phone",
        buyerId: destination.buyerId,
        weight: destination.weight ?? 100,
        priority: destination.priority ?? 1,
      },
    });
  },

  /**
   * Walk a hypothetical inbound call through the rule's graph and return
   * which conditions matched, which destination would be picked, and a
   * step-by-step trace. Powers the "Test caller" button on the routing
   * detail page.
   */
  async simulate(
    ruleId: string,
    input: { callerNumber: string; callerState?: string; callerCountry?: string },
  ): Promise<SimulateResult> {
    return http.post<SimulateResult>(`/api/routing/rules/${ruleId}/simulate`, {
      body: input,
    });
  },
};

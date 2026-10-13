/**
 * Simple call setup for one campaign, built on the backend's existing routing
 * rules (/api/routing/rules/*) - no new backend work.
 *
 * Every call is routed through the campaign's active routing rules; a campaign
 * with none drops every call ("No matching rule found"). The campaign page
 * therefore keeps ONE plain rule per campaign - the "Simple setup" - holding
 * the destinations listed under "Send calls to" and how calls are shared
 * (in order / split by % / take turns). Users never see the word "rule".
 *
 * Anything more elaborate (time, location, caller or tag conditions) stays in
 * Advanced Routing, which edits the very same rules.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

/** How a campaign shares calls between its destinations (backend rule types). */
export type Distribution = "priority" | "weighted" | "round_robin";
export const SIMPLE_TYPES: Distribution[] = ["priority", "weighted", "round_robin"];
export const SIMPLE_SUFFIX = " — Simple setup";

export interface RuleSummary {
  id: string;
  name: string;
  ruleType: string;
  priority: number;
  status: string;
  destinationCount: number;
  conditionCount: number;
}

export interface RoutedDestination {
  /** The rule-destination id (not the Destination record id). */
  id: string;
  /** The number calls are sent to. */
  number: string;
  buyerId?: string;
  buyerName?: string;
  priority: number;
  weight: number;
}

type RuleListWire = {
  id: string;
  name: string;
  ruleType: string;
  priority: number;
  status: string;
  destinationCount?: number;
  conditionCount?: number;
};
type DestWire = {
  id: string;
  destination?: string | null;
  buyerId?: string | null;
  buyerName?: string | null;
  priority?: number;
  weight?: number;
};

function destFromWire(d: DestWire): RoutedDestination {
  return {
    id: String(d.id),
    number: d.destination ?? "",
    buyerId: d.buyerId ?? undefined,
    buyerName: d.buyerName ?? undefined,
    priority: d.priority ?? 1,
    weight: d.weight ?? 100,
  };
}

export const campaignRouting = {
  /** Every routing rule of this campaign, in the order the router tries them. */
  async listRules(campaignId: string): Promise<RuleSummary[]> {
    const res = await http.get<Paginated<RuleListWire>>("/api/routing/rules", {
      query: { campaignId, pageSize: 100 },
    });
    return (res.items ?? [])
      .map((r) => ({
        id: String(r.id),
        name: r.name,
        ruleType: r.ruleType,
        priority: r.priority ?? 1,
        status: r.status,
        destinationCount: r.destinationCount ?? 0,
        conditionCount: r.conditionCount ?? 0,
      }))
      .sort((a, b) => a.priority - b.priority);
  },

  /**
   * The rule the campaign page manages: the one named "… Simple setup", else
   * the first plain one (in order / split / take turns) without conditions.
   * null = none yet (it is created when the first destination is added).
   */
  pickSimple(rules: RuleSummary[]): RuleSummary | null {
    return (
      rules.find((r) => r.name.endsWith(SIMPLE_SUFFIX)) ??
      rules.find((r) => SIMPLE_TYPES.includes(r.ruleType as Distribution) && r.conditionCount === 0) ??
      null
    );
  },

  async listDestinations(ruleId: string): Promise<RoutedDestination[]> {
    const list = await http.get<DestWire[]>(`/api/routing/rules/${ruleId}/destinations`);
    return (Array.isArray(list) ? list : []).map(destFromWire).sort((a, b) => a.priority - b.priority);
  },

  /** Create the campaign's Simple setup, tried AFTER any advanced plans it already has. */
  async createSimple(campaignId: string, campaignName: string, after: RuleSummary[]): Promise<RuleSummary> {
    const priority = after.reduce((m, r) => Math.max(m, r.priority), 0) + 1;
    const r = await http.post<RuleListWire>("/api/routing/rules", {
      body: { campaignId, name: `${campaignName}${SIMPLE_SUFFIX}`, ruleType: "priority", priority },
    });
    return {
      id: String(r.id),
      name: r.name,
      ruleType: r.ruleType,
      priority: r.priority ?? priority,
      status: r.status,
      destinationCount: 0,
      conditionCount: 0,
    };
  },

  async setDistribution(ruleId: string, distribution: Distribution): Promise<void> {
    await http.patch(`/api/routing/rules/${ruleId}`, { body: { ruleType: distribution } });
  },

  async addDestination(
    ruleId: string,
    d: { number: string; buyerId?: string; priority: number; weight?: number },
  ): Promise<RoutedDestination> {
    return destFromWire(
      await http.post<DestWire>(`/api/routing/rules/${ruleId}/destinations`, {
        body: {
          destination: d.number,
          destinationType: "phone",
          buyerId: d.buyerId || undefined,
          priority: d.priority,
          weight: d.weight ?? 100,
        },
      }),
    );
  },

  async updateDestination(ruleId: string, id: string, patch: { priority?: number; weight?: number }): Promise<void> {
    await http.patch(`/api/routing/rules/${ruleId}/destinations/${id}`, { body: patch });
  },

  /** Stop sending this campaign's calls there (the Destination itself is untouched). */
  async removeDestination(ruleId: string, id: string): Promise<void> {
    await http.delete(`/api/routing/rules/${ruleId}/destinations/${id}`);
  },
};
/**
 * Routing visual builder ↔ flat rules bridge.
 *
 * Backend stores routing rules as a flat record with two child collections:
 *   - conditions[]   (each = { id, conditions: Record<string, unknown> })
 *   - destinations[] (each = { id, buyerId, weight, priority })
 *
 * Frontend models a richer node-graph (9 node kinds, arbitrary topology,
 * branch handles, etc.). The bridge round-trips the full graph by:
 *   1. Packing the whole `{ nodes, edges }` blob into the rule's first
 *      condition under `conditions.graph` (JSON string).
 *   2. Extracting buyer nodes into the rule's destinations array, so the
 *      backend router can route to a buyer directly without parsing the
 *      graph.
 *
 * On load, the graph is rebuilt from the blob. If the blob is missing (rule
 * was created via the API, not the visual builder), we synthesize a minimal
 * inbound → buyer chain so the canvas isn't blank.
 */

import type {
  RoutingPlan,
  RoutingPlanStatus,
  RoutingNode,
  RoutingEdge,
  BuyerConfig,
} from "@/lib/types";
import type {
  RoutingRule,
  RoutingCondition,
  RoutingDestination,
  RoutingRuleStatus,
} from "@/lib/api/services/routing.service";

const GRAPH_KEY = "graph";

/** Backend status enum is a subset of the frontend's plan status. */
function planStatusToRule(status: RoutingPlanStatus): RoutingRuleStatus {
  if (status === "published") return "active";
  if (status === "archived") return "paused";
  return "draft";
}

function ruleStatusToPlan(status: RoutingRuleStatus): RoutingPlanStatus {
  if (status === "active") return "published";
  if (status === "paused") return "archived";
  return "draft";
}

/** Find the synthetic graph condition; the first one with a `graph` key wins. */
function extractGraphBlob(conditions: RoutingCondition[]): { nodes: RoutingNode[]; edges: RoutingEdge[] } | null {
  for (const c of conditions) {
    const raw = c.conditions?.[GRAPH_KEY];
    if (typeof raw === "string" && raw.length > 0) {
      try {
        const parsed = JSON.parse(raw) as { nodes?: unknown; edges?: unknown };
        // A blob that parses but carries zero nodes is treated the same as a
        // missing blob — it falls through to `synthesizeGraph` below. Without
        // this, a rule that was ever saved with an empty graph (a stale draft,
        // a race on first load, a placeholder row created outside the visual
        // builder) permanently shows 0 nodes/0 buyers even though the rule's
        // real `destinations` still exist on the backend record.
        if (
          Array.isArray(parsed.nodes) &&
          Array.isArray(parsed.edges) &&
          parsed.nodes.length > 0
        ) {
          return {
            nodes: parsed.nodes as RoutingNode[],
            edges: parsed.edges as RoutingEdge[],
          };
        }
      } catch {
        // Fall through — bad blob, treat as missing.
      }
    }
  }
  return null;
}

/** Pull buyer config blocks out of the graph for the destinations array. */
function extractBuyerDestinations(nodes: RoutingNode[]): Array<{ buyerId: string; weight?: number; priority?: number }> {
  const out: Array<{ buyerId: string; weight?: number; priority?: number }> = [];
  for (const n of nodes) {
    if (n.type === "buyer") {
      const cfg = n.data.buyer as BuyerConfig | undefined;
      if (cfg?.buyerId) {
        out.push({
          buyerId: cfg.buyerId,
          weight: typeof cfg.bidOverride === "number" ? cfg.bidOverride : undefined,
        });
      }
    }
  }
  return out;
}

/**
 * Build a synthetic minimal graph when a backend-created rule has no blob.
 * Just renders the rule's flat destinations as a row of buyer nodes hanging
 * off a single inbound node so the canvas isn't blank.
 */
function synthesizeGraph(
  campaignId: string | undefined,
  destinations: RoutingDestination[],
): { nodes: RoutingNode[]; edges: RoutingEdge[] } {
  const nodes: RoutingNode[] = [];
  const edges: RoutingEdge[] = [];

  nodes.push({
    id: "inbound",
    type: "inbound",
    position: { x: 60, y: 80 },
    data: { kind: "inbound", inbound: { campaignId } },
  });

  destinations.forEach((d, i) => {
    const id = `buyer_${d.id ?? i}`;
    nodes.push({
      id,
      type: "buyer",
      position: { x: 360, y: 40 + i * 110 },
      data: {
        kind: "buyer",
        buyer: {
          buyerId: d.buyerId ?? "",
          buyerName: d.buyerName ?? "Buyer",
          bidOverride: typeof d.weight === "number" ? d.weight : undefined,
        },
      },
    });
    edges.push({
      id: `e_${id}`,
      source: "inbound",
      target: id,
      sourceHandle: "out",
      targetHandle: "in",
    });
  });

  return { nodes, edges };
}

/** Convert a RoutingPlan into the payload(s) needed to persist via routing.service. */
export interface FlattenedPlan {
  /** Top-level rule fields for create / update. */
  rule: {
    name: string;
    description?: string;
    ruleType: string;
    priority: number;
    status: RoutingRuleStatus;
    campaignId: string;
  };
  /** Single condition holding the JSON-encoded graph. */
  conditionBlob: Record<string, unknown>;
  /** Buyer destinations extracted from the graph. */
  destinations: Array<{ buyerId: string; weight?: number; priority?: number }>;
}

export function flattenPlan(plan: RoutingPlan): FlattenedPlan {
  return {
    rule: {
      name: plan.name,
      description: plan.description,
      ruleType: "visual-graph",
      priority: 1,
      status: planStatusToRule(plan.status),
      campaignId: plan.campaignId ?? "",
    },
    conditionBlob: {
      [GRAPH_KEY]: JSON.stringify({ nodes: plan.nodes, edges: plan.edges }),
    },
    destinations: extractBuyerDestinations(plan.nodes),
  };
}

/** Convert a backend RoutingRule into the frontend RoutingPlan shape. */
export function reconstructPlan(rule: RoutingRule, fallbackCreatedAt?: number): RoutingPlan {
  const graph = extractGraphBlob(rule.conditions) ?? synthesizeGraph(rule.campaignId, rule.destinations);
  const now = Date.now();
  return {
    id: rule.id,
    name: rule.name,
    description: undefined,
    campaignId: rule.campaignId || undefined,
    campaignName: rule.campaignName || undefined,
    status: ruleStatusToPlan(rule.status),
    nodes: graph.nodes,
    edges: graph.edges,
    createdAt: fallbackCreatedAt ?? now,
    updatedAt: now,
  };
}

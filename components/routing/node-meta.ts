/**
 * Catalog of routing node types — used by the palette (drag source),
 * the inspector (form), and the renderer (tone color).
 */

import type { LucideIcon } from "lucide-react";
import {
  Building2,
  Clock,
  Filter,
  Gauge,
  GitFork,
  Globe2,
  PhoneIncoming,
  Tags,
  XOctagon,
} from "lucide-react";

import { tFor } from "@/lib/i18n";
import { useLocaleStore } from "@/lib/store/locale-store";
import type { RoutingNodeData, RoutingNodeKind } from "@/lib/types";

/** Default text put into a newly dropped node, in the language chosen at that moment. */
const tNow = (key: string) => tFor(useLocaleStore.getState().locale, key);

export type NodeTone = "cyan" | "amber" | "violet" | "emerald" | "rose";

export interface NodeMeta {
  kind: RoutingNodeKind;
  label: string;
  labelKey: string;
  description: string;
  descriptionKey: string;
  icon: LucideIcon;
  tone: NodeTone;
  /** Number of inbound and outbound handles — used by the renderer. */
  inputs: number;
  outputs: number;
  /** Default config used when a node of this kind is dropped on the canvas. */
  defaultData: () => RoutingNodeData;
}

export const NODE_META: Record<RoutingNodeKind, NodeMeta> = {
  inbound: {
    kind: "inbound",
    label: "Inbound",
    labelKey: "trafficUI.routing.nodes.inbound.label",
    description: "Where every call enters the plan.",
    descriptionKey: "trafficUI.routing.nodes.inbound.description",
    icon: PhoneIncoming,
    tone: "cyan",
    inputs: 0,
    outputs: 1,
    defaultData: () => ({ kind: "inbound", inbound: {} }),
  },
  hoursFilter: {
    kind: "hoursFilter",
    label: "Hours filter",
    labelKey: "trafficUI.routing.nodes.hoursFilter.label",
    description: "Pass only during certain hours / days.",
    descriptionKey: "trafficUI.routing.nodes.hoursFilter.description",
    icon: Clock,
    tone: "amber",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "hoursFilter",
      hoursFilter: { days: [1, 2, 3, 4, 5], startHour: 8, endHour: 20 },
    }),
  },
  geoFilter: {
    kind: "geoFilter",
    label: "Geo filter",
    labelKey: "trafficUI.routing.nodes.geoFilter.label",
    description: "Pass calls from selected states.",
    descriptionKey: "trafficUI.routing.nodes.geoFilter.description",
    icon: Globe2,
    tone: "violet",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "geoFilter",
      geoFilter: { mode: "allow", states: ["TX", "CA"] },
    }),
  },
  tagFilter: {
    kind: "tagFilter",
    label: "Tag filter",
    labelKey: "trafficUI.routing.nodes.tagFilter.label",
    description: "Match custom call metadata.",
    descriptionKey: "trafficUI.routing.nodes.tagFilter.description",
    icon: Tags,
    tone: "violet",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "tagFilter",
      tagFilter: { tag: "source", operator: "equals", value: "facebook" },
    }),
  },
  weightSplit: {
    kind: "weightSplit",
    label: "Weight split",
    labelKey: "trafficUI.routing.nodes.weightSplit.label",
    description: "Percentage split between two branches.",
    descriptionKey: "trafficUI.routing.nodes.weightSplit.description",
    icon: Filter,
    tone: "cyan",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "weightSplit",
      weightSplit: { weightA: 50, labelA: "A", labelB: "B" },
    }),
  },
  priority: {
    kind: "priority",
    label: "Priority",
    labelKey: "trafficUI.routing.nodes.priority.label",
    description: "Try the primary path first; fall back if no match.",
    descriptionKey: "trafficUI.routing.nodes.priority.description",
    icon: GitFork,
    tone: "cyan",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "priority",
      priority: {
        primaryLabel: tNow("trafficUI.routing.nodes.priority.primary"),
        fallbackLabel: tNow("trafficUI.routing.nodes.priority.fallback"),
      },
    }),
  },
  capCheck: {
    kind: "capCheck",
    label: "Cap check",
    labelKey: "trafficUI.routing.nodes.capCheck.label",
    description: "Stop routing once a limit is hit.",
    descriptionKey: "trafficUI.routing.nodes.capCheck.description",
    icon: Gauge,
    tone: "amber",
    inputs: 1,
    outputs: 2,
    defaultData: () => ({
      kind: "capCheck",
      capCheck: { kind: "daily", limit: 200 },
    }),
  },
  buyer: {
    kind: "buyer",
    label: "Buyer",
    labelKey: "trafficUI.routing.nodes.buyer.label",
    description: "Hand the call off to a buyer (terminal).",
    descriptionKey: "trafficUI.routing.nodes.buyer.description",
    icon: Building2,
    tone: "emerald",
    inputs: 1,
    outputs: 0,
    defaultData: () => ({
      kind: "buyer",
      buyer: { buyerId: "", buyerName: tNow("trafficUI.routing.nodes.buyer.pickBuyer") },
    }),
  },
  deadEnd: {
    kind: "deadEnd",
    label: "Dead end",
    labelKey: "trafficUI.routing.nodes.deadEnd.label",
    description: "Drop the call with a reason.",
    descriptionKey: "trafficUI.routing.nodes.deadEnd.description",
    icon: XOctagon,
    tone: "rose",
    inputs: 1,
    outputs: 0,
    defaultData: () => ({
      kind: "deadEnd",
      deadEnd: { reason: tNow("toolsUI.callLogs.detail.unmatched") },
    }),
  },
};

/** Order shown in the palette. */
export const PALETTE_ORDER: RoutingNodeKind[] = [
  "inbound",
  "hoursFilter",
  "geoFilter",
  "tagFilter",
  "weightSplit",
  "priority",
  "capCheck",
  "buyer",
  "deadEnd",
];

/** Tone → Tailwind / inline color resolver shared by node UI + palette. */
export const TONE_STYLE: Record<
  NodeTone,
  { icon: string; ring: string; border: string; cssVar: string; chip: string }
> = {
  cyan: {
    icon: "text-accent bg-accent/12",
    ring: "ring-accent/30",
    border: "border-accent/40",
    cssVar: "var(--accent)",
    chip: "bg-accent/10 text-accent border-accent/30",
  },
  emerald: {
    icon: "text-[oklch(0.6_0.18_155)] dark:text-[oklch(0.78_0.18_155)] bg-[oklch(0.6_0.18_155)]/10",
    ring: "ring-[oklch(0.6_0.18_155)]/30",
    border: "border-[oklch(0.6_0.18_155)]/40",
    cssVar: "oklch(0.6 0.18 155)",
    chip:
      "bg-[oklch(0.6_0.18_155)]/10 text-[oklch(0.5_0.18_155)] dark:text-[oklch(0.78_0.18_155)] border-[oklch(0.6_0.18_155)]/30",
  },
  violet: {
    icon: "text-[oklch(0.55_0.2_290)] dark:text-[oklch(0.72_0.2_290)] bg-[oklch(0.55_0.2_290)]/10",
    ring: "ring-[oklch(0.6_0.2_290)]/30",
    border: "border-[oklch(0.6_0.2_290)]/40",
    cssVar: "oklch(0.6 0.2 290)",
    chip:
      "bg-[oklch(0.6_0.2_290)]/10 text-[oklch(0.5_0.2_290)] dark:text-[oklch(0.72_0.2_290)] border-[oklch(0.6_0.2_290)]/30",
  },
  amber: {
    icon: "text-[oklch(0.6_0.16_75)] dark:text-[oklch(0.82_0.16_75)] bg-[oklch(0.6_0.16_75)]/10",
    ring: "ring-[oklch(0.6_0.16_75)]/30",
    border: "border-[oklch(0.6_0.16_75)]/40",
    cssVar: "oklch(0.6 0.16 75)",
    chip:
      "bg-[oklch(0.6_0.16_75)]/10 text-[oklch(0.5_0.16_75)] dark:text-[oklch(0.82_0.16_75)] border-[oklch(0.6_0.16_75)]/30",
  },
  rose: {
    icon: "text-[oklch(0.55_0.2_10)] dark:text-[oklch(0.72_0.2_10)] bg-[oklch(0.55_0.2_10)]/10",
    ring: "ring-[oklch(0.6_0.2_10)]/30",
    border: "border-[oklch(0.6_0.2_10)]/40",
    cssVar: "oklch(0.6 0.2 10)",
    chip:
      "bg-[oklch(0.6_0.2_10)]/10 text-[oklch(0.5_0.2_10)] dark:text-[oklch(0.72_0.2_10)] border-[oklch(0.6_0.2_10)]/30",
  },
};

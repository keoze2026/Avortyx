/**
 * AI Insights store — backed by /api/ai/recommendations, /api/ai/anomalies,
 * /api/ai/autopilot. The backend is rule-based (not LLM) so responses are
 * deterministic and cheap to refresh.
 *
 * Backend payloads are flatter than the frontend's UI types (no confidence,
 * baseline, projection, etc.) — synthesized fields are derived from the
 * action / category so the existing card UI keeps rendering.
 */

"use client";

import { create } from "zustand";

import {
  aiService,
  type AutopilotAction,
  type Anomaly as WireAnomaly,
  type Recommendation as WireRecommendation,
} from "@/lib/api/services/ai.service";
import type {
  AiRecommendation,
  Anomaly,
  AnomalyKind,
  AnomalySeverity,
  RecommendationKind,
} from "@/lib/types";
import { friendlyErrorMessage } from "@/lib/api/errors";

interface AiInsightsState {
  recommendations: AiRecommendation[];
  anomalies: Anomaly[];
  autopilotActions: AutopilotAction[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetchAll: () => Promise<void>;
  refreshRecommendations: () => Promise<void>;
  refreshAnomalies: () => Promise<void>;
  runAutopilot: () => Promise<AutopilotAction[]>;
}

/* ─── Mappers ─────────────────────────────────────────────────────────── */

function recommendationKindFromAction(action: string | null | undefined): RecommendationKind {
  // Backend may send a row with action missing/null; default to a benign kind
  // rather than crashing the whole store.
  const a = (action ?? "").toLowerCase();
  if (a.includes("pause") || a.includes("stop")) return "pause";
  if (a.includes("scale") || a.includes("increase") || a.includes("raise")) return "scale";
  if (a.includes("rebalance") || a.includes("shift") || a.includes("move")) return "rebalance";
  if (a.includes("alert") || a.includes("notify") || a.includes("review")) return "alert";
  return "optimize";
}

function scopeFromCategory(
  cat: string | null | undefined,
  entityId: string | null,
  title: string,
): AiRecommendation["scope"] {
  const c = (cat ?? "").toLowerCase();
  if (c === "buyer") return { type: "buyer", id: entityId ?? undefined, name: title };
  if (c === "publisher") return { type: "publisher", id: entityId ?? undefined, name: title };
  if (c === "campaign") return { type: "campaign", id: entityId ?? undefined, name: title };
  return { type: "network", id: entityId ?? undefined, name: title };
}

function wireToRecommendation(w: WireRecommendation, idx: number): AiRecommendation {
  const kind = recommendationKindFromAction(w.action);
  return {
    // Backend doesn't issue stable ids; synthesize one from category + entity
    // so the deck can dedupe and the dismiss/apply state survives a re-render.
    id: `${w.category}:${w.entityId ?? `_${idx}`}:${w.action}`,
    kind,
    title: w.title,
    body: w.message,
    rationale: w.message,
    scope: scopeFromCategory(w.category, w.entityId, w.title),
    // CH-420: the server sends no confidence - show none rather than a made-up 85%.
    confidence: null,
    impact: {
      label: "Expected effect",
      labelKey: "x2.insights.expectedEffect",
      value: w.action,
      direction: kind === "pause" ? "down" : "up",
    },
    // CH-420: the server sends no time series per recommendation, so there is
    // no before / after chart (it was drawn from invented numbers).
    baseline: [],
    projected: [],
    createdAt: Date.now(),
    status: "open",
  };
}

function anomalyKindFromMetric(metric: string | null | undefined): AnomalyKind {
  const m = (metric ?? "").toLowerCase();
  if (m.includes("conversion")) return "conversion-drop";
  if (m.includes("volume")) return "volume-spike";
  if (m.includes("latency")) return "latency-spike";
  if (m.includes("cap")) return "cap-reached";
  if (m.includes("reject")) return "reject-rate";
  if (m.includes("geo") || m.includes("region")) return "geo-shift";
  return "conversion-drop";
}

function anomalySeverityFromChange(pct: number | null): AnomalySeverity {
  if (pct === null) return "info";
  const abs = Math.abs(pct);
  if (abs >= 40) return "critical";
  if (abs >= 15) return "warning";
  return "info";
}

/** The backend says how serious an anomaly is; only fall back to the size of
 *  the change when it doesn't. A volume spike of +103% was shown as Critical
 *  because the size alone was used - Sir: more calls is good news (CH-208). */
function anomalySeverity(w: WireAnomaly): AnomalySeverity {
  const t = (w.type ?? "").toLowerCase();
  if (t === "success" || t === "good") return "good";
  if (t === "critical" || t === "warning" || t === "info") return t;
  const metric = (w.metric ?? "").toLowerCase();
  if (metric.includes("volume") && (w.changePercent ?? 0) > 0) return "good";
  return anomalySeverityFromChange(w.changePercent);
}

/** What the portal calls a metric. The backend sends its internal names
 *  ("call_volume"), which were shown as-is under every alert (CH-210). */
const METRIC_LABELS: Record<string, string> = {
  call_volume: "Call Volume",
  revenue: "Revenue",
  live_activity: "Live Activity",
};

function metricLabel(metric: string): string {
  const known = METRIC_LABELS[metric.toLowerCase()];
  if (known) return known;
  return metric
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

function wireToAnomaly(w: WireAnomaly, idx: number): Anomaly {
  // Backend occasionally returns rows with metric missing; coerce to a string
  // so downstream consumers (notifications dropdown) can safely .toLowerCase().
  const metric = w.metric ?? "";
  return {
    id: `${w.type}:${metric}:${idx}`,
    kind: anomalyKindFromMetric(metric),
    severity: anomalySeverity(w),
    title: w.title,
    body: w.message,
    scope: { type: "network", name: metricLabel(metric) },
    detectedAt: Date.now(),
    delta: {
      metric,
      pct: w.changePercent ?? 0,
    },
  };
}

/* ─── Store ───────────────────────────────────────────────────────────── */

export const useAiInsightsStore = create<AiInsightsState>()((set) => ({
  recommendations: [],
  anomalies: [],
  autopilotActions: [],
  loading: false,
  error: null,
  hydrated: false,

  fetchAll: async () => {
    set({ loading: true, error: null });
    try {
      const [recs, anoms] = await Promise.all([
        aiService.recommendations(),
        aiService.anomalies(),
      ]);
      set({
        recommendations: recs.map(wireToRecommendation),
        anomalies: anoms.map(wireToAnomaly),
        loading: false,
        hydrated: true,
      });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  refreshRecommendations: async () => {
    try {
      const recs = await aiService.recommendations();
      set({ recommendations: recs.map(wireToRecommendation) });
    } catch (e) {
      set({ error: messageFromError(e) });
    }
  },

  refreshAnomalies: async () => {
    try {
      const anoms = await aiService.anomalies();
      set({ anomalies: anoms.map(wireToAnomaly) });
    } catch (e) {
      set({ error: messageFromError(e) });
    }
  },

  runAutopilot: async () => {
    try {
      const actions = await aiService.runAutopilot();
      set({ autopilotActions: actions });
      return actions;
    } catch (e) {
      set({ error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}

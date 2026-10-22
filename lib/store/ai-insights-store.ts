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
    confidence: 0.85,
    impact: {
      label: "Expected effect",
      labelKey: "x2.insights.expectedEffect",
      value: w.action,
      direction: kind === "pause" ? "down" : "up",
    },
    // Decorative micro-chart series — flat then projected step so the card's
    // sparkline still has something to draw. Backend doesn't ship time-series
    // per recommendation; the dashboard time-series is the proper source.
    baseline: [60, 62, 58, 64, 66, 65, 67],
    projected: kind === "pause" ? [50, 45, 42, 38, 36] : [70, 74, 78, 82, 85],
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
    scope: { type: "network", name: metric },
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
  if (e instanceof Error) return e.message;
  return "AI Insights request failed";
}

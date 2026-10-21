/** AI Insights types — recommendations, anomalies, chat, and autopilot rules. */

export type RecommendationKind = "scale" | "pause" | "rebalance" | "alert" | "optimize";
export type RecommendationStatus = "open" | "applied" | "dismissed" | "snoozed";

export interface RecommendationScope {
  type: "campaign" | "publisher" | "buyer" | "geo" | "network";
  /** Optional id pointing at the entity */
  id?: string;
  /** Human label */
  name: string;
}

export interface AiRecommendation {
  id: string;
  kind: RecommendationKind;
  title: string;
  body: string;
  /** Why the AI is suggesting this — shown on expand */
  rationale: string;
  scope: RecommendationScope;
  /** 0..1 — model confidence */
  confidence: number;
  /** The headline impact if applied */
  impact: { label: string; /** Translation key for `label`, when it is a fixed text. */ labelKey?: string; value: string; direction: "up" | "down" };
  /** Trailing baseline series + forward projected (used for the micro-chart) */
  baseline: number[];
  projected: number[];
  createdAt: number;
  status: RecommendationStatus;
}

export type AnomalySeverity = "info" | "warning" | "critical";
export type AnomalyKind =
  | "conversion-drop"
  | "volume-spike"
  | "latency-spike"
  | "cap-reached"
  | "reject-rate"
  | "geo-shift";

export interface Anomaly {
  id: string;
  kind: AnomalyKind;
  severity: AnomalySeverity;
  title: string;
  body: string;
  scope: RecommendationScope;
  detectedAt: number;
  /** Magnitude of the anomaly (percent change) */
  delta: { metric: string; pct: number };
}

export interface ChatSuggestion {
  id: string;
  question: string;
  /** Hint used by the mock responder to pick a canned reply */
  category: "performance" | "anomaly" | "forecast" | "explain";
}

export interface AutopilotRule {
  id: string;
  label: string;
  description: string;
  /** Tone used by the toggle */
  tone: "safe" | "caution" | "aggressive";
  enabled: boolean;
}

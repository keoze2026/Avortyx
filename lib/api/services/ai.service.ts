/**
 * AI Insights service — /api/ai/*.
 *
 * Backend is rule-based (not LLM) so responses are deterministic and
 * cheap to call. Three endpoints:
 *   GET  /api/ai/recommendations  — actionable suggestions
 *   GET  /api/ai/anomalies        — unusual patterns (call drops, dead periods)
 *   POST /api/ai/autopilot        — runs an autopilot pass and returns the
 *                                   actions it just took (pause buyer X, etc.)
 */

import { http } from "@/lib/api/http";

export type RecommendationCategory =
  | "performance"
  | "buyer"
  | "campaign"
  | "publisher"
  | "spam"
  | "compliance"
  | "growth"
  | "other";

export interface Recommendation {
  /** Stable backend-supplied id; the deck uses this for dismiss persistence. */
  id: string;
  type: string;
  category: RecommendationCategory;
  title: string;
  message: string;
  /** Free-form action handle the UI can map to a CTA. */
  action: string;
  /** Entity the recommendation targets — buyer id, campaign id, etc. */
  entityId: string | null;
}

/** One thing Autopilot did, as the server recorded it. */
export interface AutopilotHistoryItem {
  action: string;
  entity: string;
  reason: string;
  at: string;
  source: string;
}

/**
 * Persisted autopilot configuration. Mirrors the backend's flat
 * AutopilotConfigSchema: a switch, and where it has one, its threshold.
 */
export interface AutopilotConfig {
  pauseOnHighNoAnswer: boolean;
  noAnswerThreshold: number;
  pauseOnShortCalls: boolean;
  shortCallSeconds: number;
  minCallsToJudge: number;
  resumeRecoveredBuyers: boolean;
  resumeAfterMinutes: number;
  alertOnVolumeDrop: boolean;
  volumeDropThreshold: number;
  alertOnRevenueDrop: boolean;
  revenueDropThreshold: number;
  alertOnLowBalance: boolean;
  lowBalanceAmount: number;
  alertOnNoCalls: boolean;
  noCallsHours: number;
  alertOnHighSpam: boolean;
  spamRateThreshold: number;
  alertOnCampaignWithoutBuyers: boolean;
  autoRun: boolean;
  runEveryMinutes: number;
  lastRunAt: string | null;
  history: AutopilotHistoryItem[];
}

export interface Anomaly {
  type: string;
  title: string;
  message: string;
  metric: string;
  value: number;
  previous: number | null;
  changePercent: number | null;
}

export interface AutopilotAction {
  action: string;
  entity: string;
  reason: string;
}

function normalizeCategory(raw?: string): RecommendationCategory {
  const c = (raw ?? "").toLowerCase();
  if (
    c === "performance" || c === "buyer" || c === "campaign" ||
    c === "publisher" || c === "spam" || c === "compliance" || c === "growth"
  ) return c;
  return "other";
}

interface RecommendationWire {
  /** Stable id was added in the backend's v1 update. Optional here so older
   *  deployments fall back to the synthesized form. */
  id?: string;
  type: string;
  category: string;
  title: string;
  message: string;
  action: string;
  entityId: string | null;
}

interface AnomalyWire {
  type: string;
  title: string;
  message: string;
  metric: string;
  value: number;
  previous: number | null;
  changePercent: number | null;
}

interface AutopilotWire {
  action: string;
  entity: string;
  reason: string;
}

export const aiService = {
  async recommendations(): Promise<Recommendation[]> {
    const wire = await http.get<RecommendationWire[]>("/api/ai/recommendations/");
    return wire.map((w, idx) => ({
      // Prefer the backend's stable id; fall back to a synthesized one only
      // for older deployments that haven't shipped the id field yet.
      id: w.id ?? `${w.category}:${w.entityId ?? `_${idx}`}:${w.action}`,
      type: w.type,
      category: normalizeCategory(w.category),
      title: w.title,
      message: w.message,
      action: w.action,
      entityId: w.entityId,
    }));
  },

  /* ─── Autopilot rule configuration ────────────────────────────────── */
  async getAutopilotConfig(): Promise<AutopilotConfig> {
    return http.get<AutopilotConfig>("/api/ai/autopilot/config/");
  },

  async updateAutopilotConfig(patch: Partial<AutopilotConfig>): Promise<AutopilotConfig> {
    return http.patch<AutopilotConfig>("/api/ai/autopilot/config/", { body: patch });
  },

  async anomalies(): Promise<Anomaly[]> {
    return http.get<AnomalyWire[]>("/api/ai/anomalies/");
  },

  /** Trigger an autopilot pass; backend returns the actions it just performed. */
  async runAutopilot(): Promise<AutopilotAction[]> {
    return http.post<AutopilotWire[]>("/api/ai/autopilot/");
  },
};

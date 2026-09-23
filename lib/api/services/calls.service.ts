/**
 * Call detail service — talks to /api/routing/calls/{id}.
 *
 * The routing call endpoint returns rich call data including transcription
 * + sentiment + recording URL. Used by the Call Detail sheet (Phase 2) and
 * the Routing log page (Phase 3).
 */

import { http } from "@/lib/api/http";
import {
  callRecordToCall,
  normalizeStatus,
  toNum,
  toTs,
  type CallRecordWire,
} from "@/lib/api/services/analytics.service";
import type { Paginated } from "@/lib/api/types";
import type { Call } from "@/lib/types";

/* ─── Wire shape — extends the base call record with transcription/sentiment ─── */

interface RoutingCallWire extends CallRecordWire {
  transcriptionText?: string;
  transcriptionStatus?: string;
  sentiment?: string;
  sentimentScore?: number | null;
}

export type SentimentLabel = "positive" | "neutral" | "negative" | "mixed" | "unknown";

export interface CallDetail extends Call {
  transcription?: {
    text: string;
    /** e.g. "pending", "processing", "done", "failed" — passthrough from backend. */
    status: string;
  };
  sentiment?: {
    label: SentimentLabel;
    /** -1..1 — negative … positive. */
    score: number | null;
  };
}

function normalizeSentimentLabel(raw?: string): SentimentLabel {
  const s = (raw ?? "").toLowerCase();
  if (s === "positive" || s === "negative" || s === "neutral" || s === "mixed") return s;
  return "unknown";
}

function wireToCallDetail(w: RoutingCallWire): CallDetail {
  const base = callRecordToCall(w);
  const detail: CallDetail = { ...base };
  if (w.transcriptionText || w.transcriptionStatus) {
    detail.transcription = {
      text: w.transcriptionText ?? "",
      status: w.transcriptionStatus ?? "",
    };
  }
  if (w.sentiment || typeof w.sentimentScore === "number") {
    detail.sentiment = {
      label: normalizeSentimentLabel(w.sentiment),
      score: typeof w.sentimentScore === "number" ? w.sentimentScore : null,
    };
  }
  return detail;
}

/** `POST /api/routing/calls/{id}/hangup` response. */
interface HangupWire {
  id: string;
  status: string;
  duration?: number;
  converted?: boolean;
  /** Amount billed for the call, or null when it never connected. */
  charged?: string | number | null;
  endedAt?: string;
  message?: string;
}

export interface HangupResult {
  /** Fields to merge into the row the operator hung up. */
  patch: Partial<Call>;
  message?: string;
}

/* ─── Call activity ("X-ray") — GET /api/analytics/calls/{id}/detail ───
 *
 * Five sections plus a routing trace. Two rules from the backend that the
 * UI has to honour:
 *
 *   • Only events that actually happened appear in `timeline` — render
 *     what comes back rather than expecting all six.
 *   • `city`, `zipCode`, `timezone` and `fraudScore` are null by design
 *     (the lookup provider doesn't supply them) and `areaCode`, `region`,
 *     `country`, `ruleName` only populate on calls placed from 2026-09-23
 *     on. Every one of them is hidden when null rather than shown blank.
 */

/** A timeline entry. `event` is the machine name; `label` is the backend's
 *  own display string, which we prefer over any mapping of our own. */
export interface CallActivityEvent {
  event: string;
  label?: string;
  /** ISO instant. */
  at?: string;
  detail?: Record<string, unknown> | null;
}

export interface CallerProfile {
  number?: string;
  localFormat?: string;
  areaCode?: string | null;
  region?: string | null;
  country?: string | null;
  carrier?: string | null;
  lineType?: string | null;
  isVoip?: boolean | null;
  fraudScore?: number | null;
  city?: string | null;
  zipCode?: string | null;
  timezone?: string | null;
}

export interface CallRouting {
  campaign?: string | null;
  ruleName?: string | null;
  ruleType?: string | null;
  destination?: string | null;
  buyer?: string | null;
  publisher?: string | null;
  blockReason?: string | null;
}

export interface CallFinancials {
  revenue?: number | string | null;
  payout?: number | string | null;
  profit?: number | string | null;
  minCallDuration?: number | null;
}

export interface CallRecordingInfo {
  url?: string | null;
  transcription?: string | null;
  sentiment?: string | null;
}

export interface TraceDestination {
  name?: string;
  buyer?: string | null;
  priority?: number | null;
  weight?: number | null;
  ruleName?: string | null;
  /** Rejected destinations only. */
  reason?: string | null;
}

export interface RoutingTrace {
  summary?: {
    totalDestinations?: number;
    evaluated?: number;
    eligible?: number;
    rejected?: number;
    /** Never examined — routing stopped at the first destination that
     *  passed. NOT the same as rejected. */
    notReached?: number;
  };
  steps?: Array<{ step: string; passed: boolean; detail?: string }>;
  eligibleDestinations?: TraceDestination[];
  rejectedDestinations?: TraceDestination[];
  filteringBreakdown?: Array<{ reason: string; count: number }>;
  selected?: { destination?: string; buyer?: string; rule?: string } | null;
}

export interface CallActivity {
  callerProfile?: CallerProfile;
  routing?: CallRouting;
  financials?: CallFinancials;
  recording?: CallRecordingInfo;
  timeline: CallActivityEvent[];
  /** `{}` on calls placed before the trace was recorded — the panel says
   *  "not recorded" rather than drawing a trace full of zeros. */
  routingTrace?: RoutingTrace;
}

/** True when the backend sent a trace with something in it. */
export function hasRoutingTrace(trace: RoutingTrace | undefined): trace is RoutingTrace {
  if (!trace) return false;
  return Boolean(
    trace.summary ||
      trace.steps?.length ||
      trace.eligibleDestinations?.length ||
      trace.rejectedDestinations?.length ||
      trace.selected,
  );
}

/* ─── Public service ──────────────────────────────────────────────────── */

export const callsService = {
  async get(id: string): Promise<CallDetail> {
    const wire = await http.get<RoutingCallWire>(`/api/routing/calls/${id}`);
    return wireToCallDetail(wire);
  },

  async list(query: {
    page?: number;
    pageSize?: number;
  } = {}): Promise<Paginated<Call>> {
    const res = await http.get<Paginated<RoutingCallWire>>("/api/routing/calls", { query });
    return {
      ...res,
      items: res.items.map((w) => ({ ...callRecordToCall(w) })),
    };
  },

  /**
   * Manually end a call that's still live. The backend closes the record
   * and answers with its final state — `no_answer` / 0 s / not charged if
   * it never connected, otherwise the real duration and what was billed.
   * Calling it on a call that already ended is a 400.
   */
  async hangup(id: string): Promise<HangupResult> {
    const w = await http.post<HangupWire>(`/api/routing/calls/${id}/hangup`);
    const patch: Partial<Call> = {
      status: normalizeStatus(w.status),
      durationSec: typeof w.duration === "number" ? w.duration : 0,
      isConverted: w.converted ?? false,
    };
    if (w.charged !== undefined && w.charged !== null) patch.revenue = toNum(w.charged);
    return { patch, message: w.message };
  },

  /**
   * Everything known about one call — the "X-ray" panel behind the Call
   * Log's row expander.
   */
  async activity(id: string): Promise<CallActivity> {
    const w = await http.get<Partial<CallActivity>>(`/api/analytics/calls/${id}/detail`);
    return {
      ...w,
      // The contract says only events that happened are present; a backend
      // that omits the key entirely shouldn't crash the panel.
      timeline: Array.isArray(w.timeline) ? w.timeline : [],
    };
  },

  /** Live in-flight calls (REST snapshot used before the WebSocket connects). */
  async live(): Promise<Call[]> {
    const wire = await http.get<RoutingCallWire[]>("/api/routing/calls/live");
    return wire.map(callRecordToCall);
  },
};

// Re-export shared helpers so the live socket hook can build Call objects from
// WebSocket event payloads without re-importing every primitive.
export { callRecordToCall, normalizeStatus, toNum, toTs };

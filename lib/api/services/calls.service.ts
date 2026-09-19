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

  /** Live in-flight calls (REST snapshot used before the WebSocket connects). */
  async live(): Promise<Call[]> {
    const wire = await http.get<RoutingCallWire[]>("/api/routing/calls/live");
    return wire.map(callRecordToCall);
  },
};

// Re-export shared helpers so the live socket hook can build Call objects from
// WebSocket event payloads without re-importing every primitive.
export { callRecordToCall, normalizeStatus, toNum, toTs };

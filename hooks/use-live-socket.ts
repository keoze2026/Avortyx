"use client";

/**
 * Live-socket hook — drop-in replacement for `useMockSocket`.
 *
 * Connects to the real backend WebSocket (`wss://avortyx.io/ws/live-calls/`),
 * subscribes to the call lifecycle events, and exposes the same
 * `{ inFlight, history, totals }` shape the Live Monitor already consumes.
 *
 * Initial state is hydrated from `GET /api/routing/calls/live` (or
 * `/api/analytics/live` as a fallback) so the radar isn't blank for the
 * 200ms before the socket starts emitting.
 *
 * If `paused` is true, the hook still receives messages but drops them on
 * the floor — the existing pause UX.
 */

import { useEffect, useReducer, useRef } from "react";

import { callsService } from "@/lib/api/services/calls.service";
import { useCallsStore } from "@/lib/store/calls-store";
import {
  createCallSocket,
  type CallEventType,
  type CallSocket,
} from "@/lib/api/socket";
import { callRecordToCall, normalizeStatus } from "@/lib/api/services/analytics.service";
import type { Call } from "@/lib/types";

interface Totals {
  started: number;
  completed: number;
  missed: number;
  revenue: number;
}

interface State {
  inFlight: Call[];
  history: Call[];
  totals: Totals;
}

const INITIAL: State = {
  inFlight: [],
  history: [],
  totals: { started: 0, completed: 0, missed: 0, revenue: 0 },
};

const HISTORY_CAP = 25;
const INFLIGHT_CAP = 24;

type Action =
  | { kind: "hydrate"; calls: Call[] }
  | { kind: "upsertInFlight"; call: Call; counted?: boolean }
  | { kind: "updateInFlight"; id: string; patch: Partial<Call> }
  | { kind: "settle"; id: string; final: Partial<Call> }
  | { kind: "drop"; id: string };

function reducer(state: State, a: Action): State {
  switch (a.kind) {
    case "hydrate":
      return { ...state, inFlight: a.calls.slice(0, INFLIGHT_CAP) };

    case "upsertInFlight": {
      const exists = state.inFlight.some((c) => c.id === a.call.id);
      const inFlight = exists
        ? state.inFlight.map((c) => (c.id === a.call.id ? { ...c, ...a.call } : c))
        : [a.call, ...state.inFlight].slice(0, INFLIGHT_CAP);
      const totals = a.counted
        ? { ...state.totals, started: state.totals.started + 1 }
        : state.totals;
      return { ...state, inFlight, totals };
    }

    case "updateInFlight": {
      const inFlight = state.inFlight.map((c) =>
        c.id === a.id ? { ...c, ...a.patch } : c,
      );
      return { ...state, inFlight };
    }

    case "settle": {
      const idx = state.inFlight.findIndex((c) => c.id === a.id);
      const current = idx >= 0 ? state.inFlight[idx] : null;
      const settled: Call | null = current
        ? { ...current, ...a.final }
        : null;
      const inFlight = idx >= 0 ? state.inFlight.filter((c) => c.id !== a.id) : state.inFlight;
      const history = settled
        ? [settled, ...state.history].slice(0, HISTORY_CAP)
        : state.history;
      const isConverted = settled?.status === "completed" && (settled.payout ?? 0) > 0;
      const totals: Totals = {
        ...state.totals,
        completed: state.totals.completed + (isConverted ? 1 : 0),
        missed: state.totals.missed + (settled && !isConverted ? 1 : 0),
        revenue: state.totals.revenue + (settled?.revenue ?? 0),
      };
      return { inFlight, history, totals };
    }

    case "drop":
      return {
        ...state,
        inFlight: state.inFlight.filter((c) => c.id !== a.id),
      };
  }
}

interface UseLiveSocketOptions {
  paused: boolean;
}

interface UseLiveSocketReturn extends State {
  /** True after the initial REST snapshot has resolved. */
  hydrated: boolean;
  /** True while the WebSocket is open. */
  connected: boolean;
}

/** Inferred from arbitrary event payload — accepts a wide range of shapes. */
function eventDataToCall(data: unknown): Call | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.id !== "string") return null;
  // The WebSocket payload is broadly aligned with `CallRecordWire`. We pass
  // it through the same mapper used for REST so the call shape stays uniform.
  return callRecordToCall({
    id: d.id,
    callerNumber: (d.callerNumber as string) ?? "",
    destinationNumber: (d.destinationNumber as string) ?? "",
    status: (d.status as string) ?? "ringing",
    duration: (d.duration as number) ?? 0,
    callerAreaCode: (d.callerAreaCode as string) ?? "",
    callerState: (d.callerState as string) ?? "",
    callerCountry: (d.callerCountry as string) ?? "",
    campaignId: (d.campaignId as string) ?? null,
    campaignName: (d.campaignName as string) ?? null,
    buyerId: (d.buyerId as string) ?? null,
    buyerName: (d.buyerName as string) ?? null,
    publisherId: (d.publisherId as string) ?? null,
    publisherName: (d.publisherName as string) ?? null,
    revenue: String(d.revenue ?? 0),
    buyerPayout: String(d.buyerPayout ?? d.payout ?? 0),
    publisherPayout: String(d.publisherPayout ?? 0),
    recordingUrl: (d.recordingUrl as string) ?? "",
    createdAt: (d.createdAt as string) ?? (d.startedAt as string) ?? new Date().toISOString(),
    tags: [],
    notes: "",
  });
}

export function useLiveSocket({ paused }: UseLiveSocketOptions): UseLiveSocketReturn {
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const hydratedRef = useRef(false);
  const socketRef = useRef<CallSocket | null>(null);
  const connectedRef = useRef(false);
  const [, force] = useReducer((n) => n + 1, 0);

  /* ─── Initial REST snapshot ──────────────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await callsService.live();
        if (cancelled) return;
        dispatch({ kind: "hydrate", calls: snap });
      } catch {
        // Snapshot unavailable — socket will fill in as events arrive.
      } finally {
        hydratedRef.current = true;
        force();
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ─── WebSocket subscription ─────────────────────────────────────── */
  useEffect(() => {
    const socket = createCallSocket();
    socketRef.current = socket;

    const handlers: Array<() => void> = [];

    const onStart = (type: CallEventType) =>
      socket.on(type, (data: unknown) => {
        if (pausedRef.current) return;
        const call = eventDataToCall(data);
        if (!call) return;
        dispatch({ kind: "upsertInFlight", call, counted: type === "call.created" });
      });

    const onProgress = (type: CallEventType) =>
      socket.on(type, (data: unknown) => {
        if (pausedRef.current) return;
        const call = eventDataToCall(data);
        if (!call) return;
        dispatch({
          kind: "updateInFlight",
          id: call.id,
          patch: { status: call.status, durationSec: call.durationSec },
        });
      });

    const onEnd = (type: CallEventType) =>
      socket.on(type, (data: unknown) => {
        if (pausedRef.current) return;
        const call = eventDataToCall(data);
        if (!call) return;
        const status =
          type === "call.failed" ? "failed" :
          type === "call.spam_blocked" ? "rejected" :
          normalizeStatus(call.status ?? "completed");
        dispatch({
          kind: "settle",
          id: call.id,
          final: {
            ...call,
            status,
          },
        });
      });

    handlers.push(onStart("call.created"));
    handlers.push(onStart("call.queued"));
    handlers.push(onProgress("call.ringing"));
    handlers.push(onProgress("call.connected"));
    handlers.push(onProgress("call.routed"));
    handlers.push(onEnd("call.ended"));
    handlers.push(onEnd("call.failed"));
    handlers.push(onEnd("call.spam_blocked"));

    // Track connection state for the UI badge.
    const tick = window.setInterval(() => {
      const open = socket.isConnected();
      if (open !== connectedRef.current) {
        connectedRef.current = open;
        force();
      }
    }, 1000);

    socket.connect();

    return () => {
      window.clearInterval(tick);
      handlers.forEach((unsub) => unsub());
      socket.disconnect();
      socketRef.current = null;
      connectedRef.current = false;
    };
  }, []);

  // Keep the topbar LIVE badge in sync — write inFlight.length to the global
  // calls store so the topbar doesn't need its own socket connection.
  const setLiveCount = useCallsStore((s) => s.setLiveCount);
  useEffect(() => {
    setLiveCount(state.inFlight.length);
  }, [state.inFlight.length, setLiveCount]);

  return {
    ...state,
    hydrated: hydratedRef.current,
    connected: connectedRef.current,
  };
}

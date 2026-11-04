/**
 * WebSocket connector for the Avortyx live channel.
 *
 *   const socket = createCallSocket();
 *   const unsubscribe = socket.on("call.connected", (data) => { … });
 *   socket.connect();
 *   …
 *   socket.disconnect();
 *
 * Carries both call lifecycle events and RTB auction/bid events on a single
 * channel — the backend dev confirmed there's no separate RTB socket. Events
 * are dispatched by their `type` field; payloads come through camelCase
 * (snake_case from the wire converted at the boundary).
 *
 * Features:
 *   - Auto-reconnect with exponential backoff (1s → 30s cap)
 *   - JWT supplied as a `?token=` query param at connect time
 *   - Re-attaches all subscriptions after reconnect (subscriptions live in
 *     the manager, not the socket instance)
 *   - Visibility-aware: pauses reconnect attempts while the tab is hidden
 *
 * Phase 0 lays the plumbing; Phase 2 will wire Live Monitor + Marketplace.
 */

import { snakeToCamel } from "./case";
import { WS_BASE_URL } from "./env";
import { getAccessToken } from "./tokens";
import { isDemoMode } from "../demo/flag";
import { createDemoSocket } from "../demo/socket-driver";

/** Canonical event types confirmed by the backend dev. */
export const CALL_EVENT_TYPES = [
  "call.created",
  "call.ringing",
  "call.connected",
  "call.ended",
  "call.routed",
  "call.failed",
  "call.queued",
  "call.spam_blocked",
  "rtb.auction_created",
  "rtb.bid_placed",
  "rtb.auction_settled",
  // CH-538: "a call event happened in this workspace" - the event name only,
  // never the call. Reports and the header reload through the API.
  "report.changed",
] as const;

export type CallEventType = (typeof CALL_EVENT_TYPES)[number];

/** Backend message envelope (post case-adapter). */
export interface CallEvent<T = unknown> {
  type: CallEventType;
  data: T;
}

type Listener<T = unknown> = (data: T) => void;

interface SocketState {
  ws: WebSocket | null;
  /** True between `connect()` and `disconnect()`. Drives reconnect. */
  open: boolean;
  reconnectAttempts: number;
  reconnectTimer: number | null;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30_000;
// Canonical WS path per backend dev (2026-06-23). Previously `/ws/calls/`
// which the server doesn't expose — that path 404'd silently and the live
// stream stayed empty.
const WS_PATH = "/ws/live-calls/";

export interface CallSocket {
  connect(): void;
  disconnect(): void;
  /** Subscribe to a specific event type. Returns an unsubscribe function. */
  on<T = unknown>(type: CallEventType, listener: Listener<T>): () => void;
  /** Subscribe to every message. Returns an unsubscribe function. */
  onAny(listener: (e: CallEvent) => void): () => void;
  isConnected(): boolean;
}

export function createCallSocket(): CallSocket {
  // Demo mode — return a fake socket that emits canned events.
  if (isDemoMode()) return createDemoSocket();

  const listeners = new Map<CallEventType, Set<Listener>>();
  const anyListeners = new Set<(e: CallEvent) => void>();
  const state: SocketState = {
    ws: null,
    open: false,
    reconnectAttempts: 0,
    reconnectTimer: null,
  };

  const dispatch = (raw: string) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return; // malformed frame
    }
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof (parsed as { type?: unknown }).type !== "string"
    ) {
      return;
    }
    const camelized = snakeToCamel(parsed) as { type: string; data?: unknown };
    // Note: `type` is dotted ("call.created") — case adapter only operates on
    // keys/values, not on string contents, so the type code passes through.
    const event: CallEvent = {
      type: camelized.type as CallEventType,
      data: camelized.data,
    };
    const set = listeners.get(event.type);
    if (set) for (const l of set) l(event.data);
    for (const l of anyListeners) l(event);
  };

  const scheduleReconnect = () => {
    if (!state.open) return;
    if (state.reconnectTimer !== null) return;
    if (typeof window !== "undefined" && document.visibilityState === "hidden") {
      // Don't burn battery reconnecting in the background; we'll retry on visibility change.
      return;
    }
    const delay = Math.min(
      RECONNECT_MAX_MS,
      RECONNECT_BASE_MS * 2 ** state.reconnectAttempts,
    );
    state.reconnectAttempts += 1;
    state.reconnectTimer = window.setTimeout(() => {
      state.reconnectTimer = null;
      openConnection();
    }, delay);
  };

  const openConnection = () => {
    if (typeof window === "undefined") return;
    const token = getAccessToken();
    if (!token) {
      // Without a token we can't authenticate — retry once we have one.
      scheduleReconnect();
      return;
    }
    const url = `${WS_BASE_URL}${WS_PATH}?token=${encodeURIComponent(token)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    state.ws = ws;

    ws.addEventListener("open", () => {
      state.reconnectAttempts = 0;
    });
    ws.addEventListener("message", (e) => {
      if (typeof e.data === "string") dispatch(e.data);
    });
    ws.addEventListener("close", () => {
      state.ws = null;
      scheduleReconnect();
    });
    ws.addEventListener("error", () => {
      // `error` always followed by `close`; let close handle the reconnect.
    });
  };

  const onVisibilityChange = () => {
    if (
      typeof window !== "undefined" &&
      document.visibilityState === "visible" &&
      state.open &&
      !state.ws
    ) {
      openConnection();
    }
  };

  return {
    connect() {
      if (state.open) return;
      state.open = true;
      if (typeof window !== "undefined") {
        document.addEventListener("visibilitychange", onVisibilityChange);
      }
      openConnection();
    },

    disconnect() {
      state.open = false;
      if (state.reconnectTimer !== null) {
        window.clearTimeout(state.reconnectTimer);
        state.reconnectTimer = null;
      }
      if (state.ws) {
        try { state.ws.close(); } catch { /* ignore */ }
        state.ws = null;
      }
      if (typeof window !== "undefined") {
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
    },

    on<T>(type: CallEventType, listener: Listener<T>) {
      let set = listeners.get(type);
      if (!set) {
        set = new Set();
        listeners.set(type, set);
      }
      set.add(listener as Listener);
      return () => {
        const s = listeners.get(type);
        if (!s) return;
        s.delete(listener as Listener);
        if (s.size === 0) listeners.delete(type);
      };
    },

    onAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },

    isConnected() {
      return state.ws?.readyState === WebSocket.OPEN;
    },
  };
}

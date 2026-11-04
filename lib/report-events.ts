"use client";

/**
 * CH-538: Reports and the header move the moment a call event happens.
 *
 * Sir, 4 Nov: "Use a WebSocket/event push so the page updates without a
 * refresh. Target: any call appears in Reports and Call Log within 2 seconds
 * of starting." The backend sends "report.changed" on the live channel
 * (/ws/live-calls/) when any call of the workspace is created, answered or
 * ended (routing/call_events.py). It carries only the kind of event; each page
 * then asks the API as before, so a partner login still sees only its own calls.
 *
 * One connection per tab, shared by every listener, open while at least one
 * listener is. A burst of events (several calls in the same moment) is merged
 * into one notification after BURST_MS. The pages' own timed checks stay as
 * the fallback for when the connection is down.
 */
import { createCallSocket, type CallSocket } from "@/lib/api/socket";

const BURST_MS = 250;

/** CH-542: settings (a cap, a line, a buyer) were changed by someone. */
export const CONFIG_CHANGED = "config.changed";

/** Gets the event names of the burst ("call.created", "call.ended", CONFIG_CHANGED...). */
type Listener = (events: ReadonlySet<string>) => void;

const listeners = new Set<Listener>();
let socket: CallSocket | null = null;
let stopSocket: (() => void) | null = null;
let burst: ReturnType<typeof setTimeout> | undefined;
let pending = new Set<string>();

function notify(data?: unknown): void {
  const name = (data as { event?: unknown } | undefined)?.event;
  pending.add(typeof name === "string" && name ? name : "call.updated");
  if (burst) return;
  burst = setTimeout(() => {
    burst = undefined;
    const events: ReadonlySet<string> = pending;
    pending = new Set();
    for (const l of Array.from(listeners)) {
      try {
        l(events);
      } catch {
        // One page failing to reload never stops the others.
      }
    }
  }, BURST_MS);
}

/** Call `listener` after every call event (and, CH-542, every settings change)
 *  of this workspace. Returns the unsubscribe. */
export function onReportChanged(listener: Listener): () => void {
  if (typeof window === "undefined") return () => {};
  listeners.add(listener);
  if (!socket) {
    socket = createCallSocket();
    stopSocket = socket.on("report.changed", notify);
    socket.connect();
  }
  let done = false;
  return () => {
    if (done) return;
    done = true;
    listeners.delete(listener);
    if (listeners.size === 0 && socket) {
      stopSocket?.();
      socket.disconnect();
      socket = null;
      stopSocket = null;
      if (burst) clearTimeout(burst);
      burst = undefined;
      pending = new Set();
    }
  };
}

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

type Listener = () => void;

const listeners = new Set<Listener>();
let socket: CallSocket | null = null;
let stopSocket: (() => void) | null = null;
let burst: ReturnType<typeof setTimeout> | undefined;

function notify(): void {
  if (burst) return;
  burst = setTimeout(() => {
    burst = undefined;
    for (const l of Array.from(listeners)) {
      try {
        l();
      } catch {
        // One page failing to reload never stops the others.
      }
    }
  }, BURST_MS);
}

/** Call `listener` after every call event of this workspace. Returns the unsubscribe. */
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
    }
  };
}

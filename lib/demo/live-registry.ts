/**
 * Demo-only registry of the calls currently "in flight" on the demo
 * socket, so the demo HTTP router can answer `POST …/{id}/hangup` for a
 * card the operator sees on the Live Monitor — the socket driver and the
 * router are otherwise separate modules with no shared state.
 */

export interface LiveEntry {
  startedAt: number;
  status: "ringing" | "in-progress";
}

const live = new Map<string, LiveEntry>();
const hungUp = new Set<string>();

export function trackLive(id: string, entry: LiveEntry): void {
  live.set(id, entry);
}

export function untrackLive(id: string): void {
  live.delete(id);
}

export function liveEntry(id: string): LiveEntry | undefined {
  return live.get(id);
}

/** Operator hung this call up — the socket driver drops it on its next tick. */
export function markHungUp(id: string): void {
  hungUp.add(id);
  live.delete(id);
}

export function wasHungUp(id: string): boolean {
  return hungUp.has(id);
}

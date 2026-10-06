/**
 * The header's Live number, kept right from every page.
 *
 * The Live figure used to be written only by the Live Monitor's socket, so:
 *   - on every other page it was a poll of the dashboard KPIs (up to 15-30 s old);
 *   - after leaving the Live Monitor the last socket value stayed in the store
 *     for good, so the header could show "Live: 3" with no call in progress;
 *   - the Live Monitor's list is capped at 24 cards and the socket and REST
 *     counted different call states, so the number could be wrong and flip
 *     between values.
 *
 * Now there is ONE writer. It asks the server how many calls are in flight
 * (the same figure and definition the Live Monitor's own counter uses:
 * GET /api/analytics/live/summary -> in_flight), every 10 seconds while the tab
 * is visible, and straight away when the tab regains focus. The Live Monitor
 * calls `refreshLiveCountNow()` whenever a call starts or ends, so on that page
 * the header moves with the calls.
 */

import { http } from "@/lib/api/http";
import { useCallsStore } from "@/lib/store/calls-store";

export const LIVE_COUNT_POLL_MS = 10_000;
/** Give up on the number (header falls back to the KPI figure) after this many failures in a row. */
const MAX_FAILURES = 3;
/** Calls to refreshLiveCountNow() closer together than this are merged into one request. */
const REFRESH_DEBOUNCE_MS = 400;

interface LiveSummaryWire {
  inFlight?: number;
}

let users = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let debounce: ReturnType<typeof setTimeout> | undefined;
let running = false;
let failures = 0;
let teardown: (() => void) | undefined;

const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

async function run(): Promise<void> {
  if (running || !visible()) return;
  running = true;
  try {
    const wire = await http.get<LiveSummaryWire>("/api/analytics/live/summary");
    const n = wire?.inFlight;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error("no live count");
    failures = 0;
    useCallsStore.getState().setLiveCount(Math.round(n));
  } catch {
    failures += 1;
    if (failures >= MAX_FAILURES) useCallsStore.getState().clearLiveCount();
  } finally {
    running = false;
  }
}

/** Check the live count right now (merged if called repeatedly in a burst). */
export function refreshLiveCountNow(): void {
  if (users === 0) return;
  if (debounce) return;
  debounce = setTimeout(() => {
    debounce = undefined;
    void run();
  }, REFRESH_DEBOUNCE_MS);
}

/**
 * Start keeping the live count fresh. Safe to call from several places: the
 * work is shared, and stops when the last caller stops. Returns the stop function.
 */
export function startLiveCountSync(): () => void {
  users += 1;
  if (users === 1) {
    void run();
    timer = setInterval(() => void run(), LIVE_COUNT_POLL_MS);
    const onWake = () => void run();
    if (typeof window !== "undefined") window.addEventListener("focus", onWake);
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onWake);
    teardown = () => {
      if (typeof window !== "undefined") window.removeEventListener("focus", onWake);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onWake);
    };
  }
  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    users -= 1;
    if (users === 0) {
      if (timer) clearInterval(timer);
      if (debounce) clearTimeout(debounce);
      timer = undefined;
      debounce = undefined;
      failures = 0;
      teardown?.();
      teardown = undefined;
    }
  };
}
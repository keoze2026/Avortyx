"use client";

/**
 * Security store - the reports PIN, as the SERVER sees it.
 *
 * This used to keep the PIN in the browser (localStorage, plain digits) and
 * only hide the page. That could never protect anything: it existed in one
 * browser only, buyers and publishers never had it, and anyone could read the
 * data straight from the API. The PIN now lives on the backend:
 *
 *   - ONE PIN per workspace, applied to every login (main account, buyers,
 *     publishers, team members).
 *   - Creating / changing / removing it needs the main account's password.
 *   - Until a login enters the PIN, the backend refuses to return anything
 *     older than today (HTTP 423, code `reports_pin_required`).
 *
 * This store only mirrors that state so the screens can show the right thing.
 * The server stays the authority: if a request is refused, `markLocked()` is
 * called (see lib/api/lock-events.ts) and the UI follows.
 *
 * Nothing is persisted in the browser. A legacy `vortyx.security` entry from
 * the old version (it held the PIN in plain digits) is deleted on load.
 */

import { useEffect } from "react";
import { create } from "zustand";

import { ApiError, friendlyErrorMessage } from "@/lib/api/errors";
import { onReportsLocked } from "@/lib/api/lock-events";
import {
  pinErrorInfo,
  securityService,
  type ReportsPinStatus,
} from "@/lib/api/services/security.service";

/** idle -> nothing asked yet; loading -> first answer pending; ready -> known;
 *  unavailable -> the server doesn't offer PIN protection (yet). */
export type PinLoadState = "idle" | "loading" | "ready" | "unavailable";

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: "incorrect"; attemptsLeft: number | null }
  | { ok: false; reason: "lockedOut"; until: number | null }
  | { ok: false; reason: "error"; message: string };

interface SecurityState {
  load: PinLoadState;
  /** Why the last status check failed (shown when `load` is "unavailable"), else null. */
  statusError: string | null;
  /** The workspace has a PIN. */
  configured: boolean;
  /** This login has entered it and is unlocked right now. */
  unlocked: boolean;
  /** When the current unlock ends (ms since epoch), if the server said. */
  unlockExpiresAt: number | null;
  /** This login may create / change / remove the PIN (the main account). */
  canManage: boolean;
  /** Verifying is blocked until this time (ms since epoch) after too many wrong tries. */
  lockedOutUntil: number | null;
  attemptsLeft: number | null;

  /** Ask the server where things stand. Safe to call repeatedly. */
  fetchStatus: () => Promise<void>;
  /** Enter the PIN. */
  verify: (pin: string) => Promise<VerifyResult>;
  /** Lock this login again right away. */
  lock: () => Promise<void>;
  /** Create or change the PIN. Needs the account password. Throws on failure. */
  setPin: (pin: string, currentPassword: string) => Promise<void>;
  /** Remove the PIN. Needs the account password. Throws on failure. */
  removePin: (currentPassword: string) => Promise<void>;
  /** The server refused a request because the PIN hasn't been entered. */
  markLocked: () => void;
  /** Forget everything (sign-in / sign-out). */
  reset: () => void;
}

const INITIAL = {
  load: "idle" as PinLoadState,
  statusError: null as string | null,
  configured: false,
  unlocked: false,
  unlockExpiresAt: null as number | null,
  canManage: false,
  lockedOutUntil: null as number | null,
  attemptsLeft: null as number | null,
};

const toMs = (iso: string | null): number | null => {
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? ms : null;
};

/** A plain-language reason a status check failed, including what the server said. */
function describeStatusFailure(e: unknown): string {
  if (e instanceof ApiError) {
    const code = e.code ? ` (${e.code})` : "";
    if (e.status === 0) return "The browser could not reach the server (network down, or the request was blocked - for example by CORS).";
    if (e.status === 404) return `The server answered 404${code}: this address has no /api/security/reports-pin/status. The PIN service may not be deployed on the server this site talks to.`;
    if (e.status === 401) return `The server answered 401${code}: not signed in.`;
    if (e.status === 403) return `The server answered 403${code}: this login is not allowed to read the PIN status.`;
    if (e.status >= 500) return `The server answered ${e.status}${code}: an error on the server.`;
    return `The server answered ${e.status}${code}.`;
  }
  // The browser's own wording for "the request never completed".
  if (e instanceof TypeError || (e instanceof Error && /failed to fetch|networkerror|load failed|network request failed/i.test(e.message))) {
    return "The browser could not reach the server (network down, or the request was blocked - for example by CORS).";
  }
  return e instanceof Error && e.message ? e.message : "The status check failed for an unknown reason.";
}

/* One status check at a time: a refresh that triggers another refresh (for
 * example through markLocked) must never turn into a loop. */
let statusInFlight = false;

/* Re-lock the screen the moment a server-side unlock runs out. */
let expiryTimer: ReturnType<typeof setTimeout> | undefined;
const MAX_TIMEOUT_MS = 2_147_000_000; // setTimeout's ceiling (~24.8 days)

function scheduleExpiry(at: number | null): void {
  if (expiryTimer) clearTimeout(expiryTimer);
  expiryTimer = undefined;
  if (at === null) return;
  const wait = at - Date.now();
  if (wait <= 0) return;
  expiryTimer = setTimeout(() => useSecurityStore.getState().markLocked(), Math.min(wait, MAX_TIMEOUT_MS));
}

export const useSecurityStore = create<SecurityState>()((set, get) => {
  const apply = (s: ReportsPinStatus) => {
    const expires = s.unlocked ? toMs(s.unlockExpiresAt) : null;
    set({
      load: "ready",
      configured: s.configured,
      unlocked: s.unlocked,
      unlockExpiresAt: expires,
      canManage: s.canManage,
      lockedOutUntil: toMs(s.lockedOutUntil),
      attemptsLeft: s.attemptsLeft,
    });
    scheduleExpiry(expires);
  };

  return {
    ...INITIAL,

    fetchStatus: async () => {
      if (statusInFlight) return;
      statusInFlight = true;
      if (get().load !== "ready") set({ load: "loading" });
      try {
        apply(await securityService.status());
        set({ statusError: null });
      } catch (e) {
        // First answer failed: the server doesn't offer PIN protection (yet),
        // or can't be reached. The UI stays out of the way; the server still
        // refuses locked data on its own. A failed REFRESH keeps what we know.
        // The reason is kept so the Settings card can show it instead of a
        // generic sentence that fits every possible cause.
        if (get().load !== "ready") set({ load: "unavailable", statusError: describeStatusFailure(e) });
      } finally {
        statusInFlight = false;
      }
    },

    verify: async (pin) => {
      try {
        const s = await securityService.verify(pin);
        if (s) apply(s);
        else set({ load: "ready", configured: true, unlocked: true, lockedOutUntil: null, attemptsLeft: null });
        return { ok: true };
      } catch (e) {
        const info = pinErrorInfo(e);
        if (info.code === "pin_incorrect") {
          set({ attemptsLeft: info.attemptsLeft ?? null });
          return { ok: false, reason: "incorrect", attemptsLeft: info.attemptsLeft ?? null };
        }
        if (info.code === "pin_locked_out") {
          const until = toMs(info.lockedUntil ?? null) ??
            (info.retryAfterSeconds ? Date.now() + info.retryAfterSeconds * 1000 : null);
          set({ lockedOutUntil: until });
          return { ok: false, reason: "lockedOut", until };
        }
        return { ok: false, reason: "error", message: friendlyErrorMessage(e, "Couldn't check the PIN. Please try again.") };
      }
    },

    lock: async () => {
      // Lock the screen first so the data disappears at once, then tell the server.
      set({ unlocked: false, unlockExpiresAt: null });
      scheduleExpiry(null);
      try {
        await securityService.lock();
      } catch {
        void get().fetchStatus();
      }
    },

    setPin: async (pin, currentPassword) => {
      const s = await securityService.setPin({ pin, currentPassword });
      if (s) apply(s);
      else await get().fetchStatus();
    },

    removePin: async (currentPassword) => {
      const s = await securityService.removePin({ currentPassword });
      if (s) apply(s);
      else await get().fetchStatus();
    },

    markLocked: () => {
      // A 423 means a PIN exists and this login hasn't entered it.
      set({ configured: true, unlocked: false, unlockExpiresAt: null });
      scheduleExpiry(null);
      void get().fetchStatus(); // pick up attempts-left / lock-out details
    },

    reset: () => {
      statusInFlight = false;
      if (expiryTimer) clearTimeout(expiryTimer);
      expiryTimer = undefined;
      set({ ...INITIAL });
    },
  };
});

// If the first status check failed - typically the page was opened before the PIN
// service was deployed - try again whenever the tab comes back into view, instead
// of staying "unavailable" until the user happens to reload. At most every 15 s.
if (typeof document !== "undefined") {
  let lastRetry = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible") return;
    const s = useSecurityStore.getState();
    if (s.load !== "unavailable" || Date.now() - lastRetry < 15_000) return;
    lastRetry = Date.now();
    void s.fetchStatus();
  });
}

/* Any request, anywhere, refused with `reports_pin_required` locks the UI. */
onReportsLocked(() => useSecurityStore.getState().markLocked());

/* Delete the old browser-only PIN (it was stored as plain digits). */
if (typeof window !== "undefined") {
  try {
    window.localStorage.removeItem("vortyx.security");
  } catch {
    /* storage unavailable - nothing to clean */
  }
}

/**
 * What a data-loading screen needs to know before it asks for history.
 *
 *   canFetch  true once the PIN state is known AND the data isn't locked.
 *             Fetch only when this is true, and clear what you hold when it
 *             turns false - locked data must not stay in memory.
 *   locked    a PIN exists, this range needs it, and it hasn't been entered.
 *
 * If the status can't be loaded (`unavailable`) it does not block: the server
 * is the authority and answers 423 on its own if the data is protected.
 */
export function useReportsAccess(needsPin: boolean): { canFetch: boolean; locked: boolean } {
  const load = useSecurityStore((s) => s.load);
  const configured = useSecurityStore((s) => s.configured);
  const unlocked = useSecurityStore((s) => s.unlocked);
  const fetchStatus = useSecurityStore((s) => s.fetchStatus);

  // Make sure the state is being loaded even when this is the first screen.
  useEffect(() => {
    if (load === "idle") void fetchStatus();
  }, [load, fetchStatus]);

  const known = load === "ready" || load === "unavailable";
  const locked = needsPin && configured && !unlocked;
  return { canFetch: known && !locked, locked };
}

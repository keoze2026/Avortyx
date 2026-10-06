/**
 * Reports PIN service - /api/security/reports-pin/*.
 *
 * ONE PIN per workspace, stored and enforced by the backend. Every login in
 * the workspace (main account, buyers, publishers, team members) has to enter
 * it before yesterday-and-older report data is returned. See
 * docs/BACKEND-REPORTS-PIN.md for the full contract.
 *
 *   GET  /api/security/reports-pin/status   -> ReportsPinStatus
 *   PUT  /api/security/reports-pin          { pin, currentPassword }  create / change
 *   POST /api/security/reports-pin/remove   { currentPassword }       delete
 *   POST /api/security/reports-pin/verify   { pin }                   unlock this login
 *   POST /api/security/reports-pin/lock                               lock this login
 *
 * Creating, changing and deleting need the main account's password.
 */

import { ApiError } from "@/lib/api/errors";
import { http } from "@/lib/api/http";

export interface ReportsPinStatus {
  /** The workspace has a PIN. */
  configured: boolean;
  /** This login is unlocked right now. */
  unlocked: boolean;
  /** ISO time the unlock ends, or null. */
  unlockExpiresAt: string | null;
  /** This login may create / change / remove the PIN (the main account). */
  canManage: boolean;
  /** ISO time until which verifying is blocked after too many wrong tries. */
  lockedOutUntil: string | null;
  attemptsLeft: number | null;
}

const BASE = "/api/security/reports-pin";

/** Validate + normalise a status payload. Returns null when it isn't one
 *  (for example a mock or an old server answering with something else). */
export function toPinStatus(raw: unknown): ReportsPinStatus | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.configured !== "boolean") return null;
  return {
    configured: o.configured,
    unlocked: o.unlocked === true,
    unlockExpiresAt: typeof o.unlockExpiresAt === "string" ? o.unlockExpiresAt : null,
    canManage: o.canManage === true,
    lockedOutUntil: typeof o.lockedOutUntil === "string" ? o.lockedOutUntil : null,
    attemptsLeft: typeof o.attemptsLeft === "number" ? o.attemptsLeft : null,
  };
}

export interface PinErrorInfo {
  code?: string;
  attemptsLeft?: number;
  retryAfterSeconds?: number;
  lockedUntil?: string;
}

/** Pull the PIN-specific fields out of an error. The raw body keeps the
 *  backend's snake_case names, so read them from there. */
export function pinErrorInfo(e: unknown): PinErrorInfo {
  if (!(e instanceof ApiError)) return {};
  const b = (e.body && typeof e.body === "object" ? e.body : {}) as Record<string, unknown>;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return {
    code: e.code ?? str(b.code),
    attemptsLeft: num(b.attempts_left),
    retryAfterSeconds: num(b.retry_after_seconds),
    lockedUntil: str(b.locked_until),
  };
}

export const securityService = {
  async status(): Promise<ReportsPinStatus> {
    const raw = await http.get<unknown>(`${BASE}/status`);
    const s = toPinStatus(raw);
    if (!s) {
      // Say what did arrive: a server that answers 200 with different field
      // names looks exactly like one that has no PIN support at all.
      const seen =
        raw && typeof raw === "object" && !Array.isArray(raw)
          ? `fields received: ${Object.keys(raw as object).slice(0, 12).join(", ") || "(none)"}`
          : `received ${Array.isArray(raw) ? "a list" : typeof raw}`;
      throw new Error(`The server answered, but not in the expected shape (needs a true/false "configured" field; ${seen}).`);
    }
    return s;
  },

  /** Create or change the PIN. Needs the account password. */
  async setPin(input: { pin: string; currentPassword: string }): Promise<ReportsPinStatus | null> {
    return toPinStatus(await http.put<unknown>(BASE, { body: input }));
  },

  /** Delete the PIN. Needs the account password. */
  async removePin(input: { currentPassword: string }): Promise<ReportsPinStatus | null> {
    return toPinStatus(await http.post<unknown>(`${BASE}/remove`, { body: input }));
  },

  /** Unlock this login. Rejects with code `pin_incorrect` or `pin_locked_out`. */
  async verify(pin: string): Promise<ReportsPinStatus | null> {
    return toPinStatus(await http.post<unknown>(`${BASE}/verify`, { body: { pin } }));
  },

  /** Lock this login again right away. */
  async lock(): Promise<ReportsPinStatus | null> {
    return toPinStatus(await http.post<unknown>(`${BASE}/lock`));
  },
};

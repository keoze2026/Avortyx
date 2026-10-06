/**
 * Asking for "today only" while the reports PIN is locked.
 *
 * Once an admin creates a reports PIN, the server refuses (423, code
 * "reports_pin_required") every history request - and a request with NO start
 * date counts as history, because leaving the dates out would otherwise bypass
 * the lock. Several things the app asks for on every page, for every user, carry
 * no dates: the header's Live / Total / wallet, and the recent-calls lists. Left
 * alone they would all fail the moment a PIN exists. Today is always open, so
 * when history is locked they ask for today instead.
 */

import { ApiError } from "@/lib/api/errors";
import { zonedDayKey } from "@/lib/format";
import { useSecurityStore } from "@/lib/store/security-store";
import { useUIStore } from "@/lib/store/ui-store";

export interface TodayScope {
  dateFrom: string;
  dateTo: string;
  /** The server decides what "today" is from this zone, so it must always be sent with the dates. */
  timezone: string;
}

/** Today (in the report time zone) as a request scope. */
export function todayScope(timeZone: string = useUIStore.getState().reportTimezone): TodayScope {
  const day = zonedDayKey(Date.now(), timeZone);
  return { dateFrom: day, dateTo: day, timezone: timeZone };
}

/** Is this the server saying "history is locked - enter the reports PIN"? */
export function isPinRequiredError(e: unknown): boolean {
  if (!(e instanceof ApiError) || e.status !== 423) return false;
  const bodyCode = e.body && typeof e.body === "object" ? (e.body as Record<string, unknown>).code : undefined;
  return e.code === "reports_pin_required" || bodyCode === "reports_pin_required";
}

/**
 * Wait (briefly) until we know whether a PIN exists. At sign-in the status
 * request and the data requests start together; without this the data requests
 * would go out blind, be refused, and be repeated for today - harmless, but a
 * red 423 in the console on every login. Gives up after `maxMs` and carries on
 * (the refuse-then-retry fallback below still covers that case).
 */
export function whenPinStatusKnown(maxMs = 1500): Promise<void> {
  const known = (load: string) => load === "ready" || load === "unavailable";
  const s = useSecurityStore.getState();
  if (known(s.load)) return Promise.resolve();
  if (s.load === "idle") void s.fetchStatus();
  return new Promise((resolve) => {
    let unsubscribe: () => void = () => undefined;
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, maxMs);
    unsubscribe = useSecurityStore.subscribe((state) => {
      if (known(state.load)) finish();
    });
  });
}

/** True while a PIN is set and this login has not entered it (and we know that for sure). */
export function historyIsLocked(): boolean {
  const s = useSecurityStore.getState();
  return s.load === "ready" && s.configured && !s.unlocked;
}

/**
 * Run `all()` (the request as it always was). If the server says history is
 * locked - or we already know it is - run `todayOnly()` instead. `today` tells
 * the caller which one it got, so it never presents today's figures as all-time.
 */
export async function allOrToday<T>(
  all: () => Promise<T>,
  todayOnly: () => Promise<T>,
): Promise<{ value: T; today: boolean }> {
  await whenPinStatusKnown();
  if (historyIsLocked()) return { value: await todayOnly(), today: true };
  try {
    return { value: await all(), today: false };
  } catch (e) {
    if (isPinRequiredError(e)) return { value: await todayOnly(), today: true };
    throw e;
  }
}

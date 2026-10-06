/**
 * "Has this invited person accepted the invitation?" - answered from the
 * frontend, with endpoints the app already has.
 *
 * When someone opens their invite link and sets a password, the backend signs
 * them in straight away, which creates a login session (valid 7 days). The
 * workspace Sessions list (GET /api/accounts/workspace/sessions) is
 * workspace-wide and names the user of every session; the workspace Members
 * list (GET /api/accounts/workspace/members) maps each user to an email. So:
 *
 *      email --(members)--> user id --(sessions)--> has a login  => registered
 *
 * Someone who has not accepted has no usable password and cannot sign in, so
 * they never have a session. Limits (the backend keeps no "accepted" flag):
 *   - a session lives 7 days, so a person who accepted longer ago and has not
 *     signed in since drops back to "invited" - the browser therefore
 *     remembers anyone it has seen registered (lib/store/registered-partners-store);
 *   - if the sessions list cannot be read, nobody is shown as registered.
 */

import { http } from "@/lib/api/http";
import { workspaceService } from "@/lib/api/services/workspace.service";

export interface RegistrationInfo {
  /** A login session exists for this person. */
  registered: boolean;
  /** When their most recent session started (ms since epoch), if any. */
  lastLoginAt: number | null;
}

/** Keyed by lower-cased email. */
export type RegistrationMap = Map<string, RegistrationInfo>;

export interface UserRef {
  id: string;
  email: string;
}

export interface SessionRef {
  userId: string;
  lastActiveAt: string;
}

export const REGISTRATION_POLL_MS = 30_000;

export const normEmail = (email: string): string => email.trim().toLowerCase();

/** Unique, lower-cased, sorted - a stable key for "which emails are we watching". */
export function normalizeEmails(emails: readonly string[]): string[] {
  return Array.from(new Set(emails.map(normEmail).filter(Boolean))).sort();
}

/** The join itself - pure, so it can be tested without any network. */
export function resolveRegistration(
  emails: readonly string[],
  users: readonly UserRef[],
  sessions: readonly SessionRef[],
): RegistrationMap {
  const idByEmail = new Map<string, string>();
  for (const u of users) {
    if (u.email) idByEmail.set(normEmail(u.email), u.id);
  }
  const lastByUser = new Map<string, number>();
  for (const s of sessions) {
    const ms = Date.parse(s.lastActiveAt);
    const at = Number.isFinite(ms) ? ms : 0;
    const prev = lastByUser.get(s.userId);
    if (prev === undefined || at > prev) lastByUser.set(s.userId, at);
  }
  const out: RegistrationMap = new Map();
  for (const raw of emails) {
    const email = normEmail(raw);
    if (!email || out.has(email)) continue;
    const id = idByEmail.get(email);
    const last = id !== undefined ? lastByUser.get(id) : undefined;
    out.set(email, { registered: last !== undefined, lastLoginAt: last ? last : null });
  }
  return out;
}

/** Every user in the workspace. The endpoint is paginated (50 by default,
 *  200 at most), so walk the pages - a person on page 2 must not be missed. */
export async function fetchWorkspaceUsers(): Promise<UserRef[]> {
  const users: UserRef[] = [];
  for (let page = 1; page <= 25; page++) {
    const res = await http.get<unknown>("/api/accounts/workspace/members", {
      query: { page, pageSize: 200 },
    });
    const items = (Array.isArray(res) ? res : ((res as { items?: unknown[] } | null)?.items ?? [])) as Array<
      Record<string, unknown>
    >;
    for (const it of items) {
      const id = (it.userId ?? it.id) as string | undefined;
      const email = it.email as string | undefined;
      if (id && email) users.push({ id: String(id), email });
    }
    const pages = Array.isArray(res) ? 1 : Number((res as { pages?: number } | null)?.pages ?? 1);
    if (page >= pages) break;
  }
  return users;
}

/** Look up registration for these emails. Throws if either list can't be read
 *  (the caller keeps what it already knew rather than flipping anyone back). */
export async function fetchRegistration(emails: readonly string[]): Promise<RegistrationMap> {
  const wanted = normalizeEmails(emails);
  if (wanted.length === 0) return new Map();
  const [users, sessions] = await Promise.all([fetchWorkspaceUsers(), workspaceService.listSessions()]);
  return resolveRegistration(
    wanted,
    users,
    sessions.map((s) => ({ userId: s.userId, lastActiveAt: s.lastActiveAt })),
  );
}

export interface RegistrationTracker {
  /** Stop polling and remove listeners. */
  stop: () => void;
  /** Check right now (for example straight after sending an invite). */
  refresh: () => void;
}

/**
 * Keep checking while something is on screen: now, every 30 seconds, and
 * whenever the tab regains focus. Does nothing while the tab is hidden. A
 * failed check is ignored (the last answer stays).
 *
 * Framework-free on purpose; the React hook is a thin wrapper around it.
 */
export function startRegistrationTracking(
  emails: readonly string[],
  onUpdate: (map: RegistrationMap) => void,
  opts: { intervalMs?: number; load?: (emails: readonly string[]) => Promise<RegistrationMap> } = {},
): RegistrationTracker {
  const wanted = normalizeEmails(emails);
  if (wanted.length === 0) return { stop() {}, refresh() {} };

  const load = opts.load ?? fetchRegistration;
  let stopped = false;
  let running = false;

  const visible = () => typeof document === "undefined" || document.visibilityState !== "hidden";

  const run = async () => {
    if (stopped || running || !visible()) return;
    running = true;
    try {
      const map = await load(wanted);
      if (!stopped) onUpdate(map);
    } catch {
      /* keep the last answer */
    } finally {
      running = false;
    }
  };

  void run();
  const timer = setInterval(() => void run(), opts.intervalMs ?? REGISTRATION_POLL_MS);
  const onWake = () => void run();
  if (typeof window !== "undefined") window.addEventListener("focus", onWake);
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", onWake);

  return {
    stop() {
      stopped = true;
      clearInterval(timer);
      if (typeof window !== "undefined") window.removeEventListener("focus", onWake);
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onWake);
    },
    refresh() {
      void run();
    },
  };
}

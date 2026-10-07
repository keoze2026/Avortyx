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
 * they never have a session.
 *
 * PREFERRED: when the members list carries `invite_status` ("invited" /
 * "registered" / "revoked") the server's answer is used as is - no guessing.
 * That is the only way a re-invited email is shown correctly in every browser.
 *
 * FALLBACK (older server, no `invite_status`). Limits:
 *   - a session lives 7 days, so a person who accepted longer ago and has not
 *     signed in since drops back to "invited" - the browser therefore
 *     remembers anyone it has seen registered (lib/store/registered-partners-store);
 *   - if the sessions list cannot be read, nobody is shown as registered.
 */

import { http } from "@/lib/api/http";
import { workspaceService } from "@/lib/api/services/workspace.service";

/** Where an invitation stands. "revoked" = access was removed. */
export type InviteStatus = "invited" | "registered" | "revoked";

export interface RegistrationInfo {
  /** They accepted THIS invitation (status === "registered"). */
  registered: boolean;
  status: InviteStatus;
  /** The server said so (true), or it was worked out from login sessions (false). */
  fromServer: boolean;
  /** Their most recent login (ms since epoch), if any. */
  lastLoginAt: number | null;
}

/** Keyed by lower-cased email. */
export type RegistrationMap = Map<string, RegistrationInfo>;

export interface UserRef {
  id: string;
  email: string;
  /** From the server, when it reports invitation status. */
  inviteStatus?: InviteStatus;
  /** When they accepted the current invitation (ms), when the server reports it. */
  acceptedAt?: number | null;
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
  /** email -> when this browser last invited it (ms). Logins before that do not count. */
  invitedAt: Readonly<Record<string, number>> = {},
): RegistrationMap {
  const userByEmail = new Map<string, UserRef>();
  for (const u of users) {
    if (u.email) userByEmail.set(normEmail(u.email), u);
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
    const user = userByEmail.get(email);
    const last = user ? lastByUser.get(user.id) : undefined;
    if (user?.inviteStatus) {
      // The server knows - use its answer, whatever the sessions say.
      out.set(email, {
        registered: user.inviteStatus === "registered",
        status: user.inviteStatus,
        fromServer: true,
        lastLoginAt: last ?? user.acceptedAt ?? null,
      });
      continue;
    }
    // Older server: a login counts only if it is not older than this browser's
    // latest invitation of that email - so a re-invited person whose old
    // account signed in last week is not shown as having accepted the new one.
    const since = invitedAt[email] ?? 0;
    const registered = last !== undefined && last >= since;
    out.set(email, {
      registered,
      status: registered ? "registered" : "invited",
      fromServer: false,
      lastLoginAt: last ? last : null,
    });
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
      if (!id || !email) continue;
      const rawStatus = String(it.inviteStatus ?? it.invite_status ?? "").trim().toLowerCase();
      const inviteStatus =
        rawStatus === "invited" || rawStatus === "registered" || rawStatus === "revoked"
          ? (rawStatus as InviteStatus)
          : undefined;
      const accepted = Date.parse(String(it.acceptedAt ?? it.accepted_at ?? ""));
      users.push({
        id: String(id),
        email,
        inviteStatus,
        acceptedAt: Number.isFinite(accepted) ? accepted : null,
      });
    }
    const pages = Array.isArray(res) ? 1 : Number((res as { pages?: number } | null)?.pages ?? 1);
    if (page >= pages) break;
  }
  return users;
}

/** Look up registration for these emails. Throws if either list can't be read
 *  (the caller keeps what it already knew rather than flipping anyone back). */
export async function fetchRegistration(
  emails: readonly string[],
  invitedAt: Readonly<Record<string, number>> = {},
): Promise<RegistrationMap> {
  const wanted = normalizeEmails(emails);
  if (wanted.length === 0) return new Map();
  const [users, sessions] = await Promise.all([fetchWorkspaceUsers(), workspaceService.listSessions()]);
  return resolveRegistration(
    wanted,
    users,
    sessions.map((s) => ({ userId: s.userId, lastActiveAt: s.lastActiveAt })),
    invitedAt,
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

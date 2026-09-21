/**
 * Auth service — talks to /api/accounts/*.
 *
 * Backend wire shape (after case adapter, all keys camelCase):
 *   login response  : { access, refresh, userId, email, role, organizationId }
 *   refresh response: { access }
 *   /me response    : { id, email, firstName, lastName, role, phoneNumber,
 *                       mfaEnabled, isEmailVerified, organizationId }
 *
 * This service:
 *   - Calls the endpoints
 *   - Returns frontend-shaped `User` objects (joining first + last name)
 *   - Handles token storage as a side effect of `login`/`logout`/`refresh`
 */

import { http } from "@/lib/api/http";
import { clearTokens, setTokens } from "@/lib/api/tokens";
import type { Role, User } from "@/lib/types";

/* ─── Wire types (post case-adapter) ──────────────────────────────────── */

interface LoginResponse {
  access: string;
  refresh: string;
  userId: string;
  email: string;
  role: string;
  organizationId: string;
}

interface MfaChallengeResponse {
  mfaRequired: true;
  tempToken: string;
}

/** Discriminated union of what `POST /api/accounts/login` can return. The
 *  backend ships either the standard login payload OR an MFA challenge. */
type LoginOrChallenge = LoginResponse | MfaChallengeResponse;

export type LoginResult =
  | { mfaRequired: false; user: User }
  | { mfaRequired: true; tempToken: string };

interface UserOutWire {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phoneNumber?: string;
  mfaEnabled?: boolean;
  isEmailVerified?: boolean;
  isSuperuser?: boolean;
  isStaff?: boolean;
  organizationId?: string | null;
  /** Some deployments expose an avatar URL on /me — optional. */
  avatarUrl?: string;
  /** Some deployments expose the organization display name — optional. */
  organizationName?: string;
  /** Telegram link — `telegram_chat_id` is written by the bot on /start,
   *  `telegram_username` by the user (PATCH /me) or by the bot. */
  telegramChatId?: string | number | null;
  telegramUsername?: string | null;
}

/** `POST /api/accounts/me/telegram/link` — a one-time deep link into the
 *  workspace bot. Opening it and pressing Start binds the chat to this user. */
interface TelegramLinkWire {
  url?: string;
  link?: string;
  deepLink?: string;
  code?: string;
  token?: string;
  expiresAt?: string;
}

export interface TelegramLink {
  url: string;
  code?: string;
  expiresAt?: number;
}

function isMfaChallenge(res: LoginOrChallenge): res is MfaChallengeResponse {
  return (res as MfaChallengeResponse).mfaRequired === true;
}

/* ─── Mapper ──────────────────────────────────────────────────────────── */

function normalizeRole(raw: string | null | undefined): Role {
  const r = (raw ?? "").toLowerCase();
  if (r === "buyer" || r === "publisher") return r;
  return "admin";
}

function fullName(first?: string, last?: string): string {
  return [first, last].filter((s) => s && s.trim()).join(" ").trim() || "User";
}

function wireToUser(wire: UserOutWire): User {
  return {
    id: wire.id,
    email: wire.email,
    name: fullName(wire.firstName, wire.lastName),
    role: normalizeRole(wire.role),
    avatarUrl: wire.avatarUrl,
    organization: wire.organizationName ?? wire.organizationId ?? "",
    phone: wire.phoneNumber,
    isSuperuser: wire.isSuperuser === true,
    isStaff: wire.isStaff === true,
    mfaEnabled: wire.mfaEnabled === true,
    telegram:
      wire.telegramChatId || wire.telegramUsername
        ? {
            chatId: wire.telegramChatId ? String(wire.telegramChatId) : undefined,
            username: wire.telegramUsername ?? undefined,
          }
        : undefined,
  };
}

/* ─── Public service ──────────────────────────────────────────────────── */

export interface LoginInput {
  email: string;
  password: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  /** Full name from the signup form; split into first/last for the backend. */
  name: string;
  organizationName: string;
  /** Phone number — patched onto /me after the registration call. */
  phone?: string;
}

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  const firstName = parts[0] ?? "";
  const lastName = parts.slice(1).join(" ");
  return { firstName, lastName };
}

export const authService = {
  /**
   * Log in. Returns either a partial `User` (when MFA isn't enabled) or an
   * MFA challenge that the caller must complete by calling `verifyMfa` with
   * the temp token + the user's 6-digit authenticator code.
   *
   * Callers in the happy (no-MFA) path should follow up with `me()` to
   * hydrate the full profile.
   */
  async login(input: LoginInput): Promise<LoginResult> {
    const res = await http.post<LoginOrChallenge>("/api/accounts/login", {
      body: input,
      anonymous: true,
    });
    if (isMfaChallenge(res)) {
      return { mfaRequired: true, tempToken: res.tempToken };
    }
    setTokens({ access: res.access, refresh: res.refresh });
    return {
      mfaRequired: false,
      user: {
        id: res.userId,
        email: res.email,
        name: res.email.split("@")[0],
        role: normalizeRole(res.role),
        organization: res.organizationId,
      },
    };
  },

  /**
   * Complete the MFA challenge with the 6-digit code the user typed into
   * the login form. Backend at POST /api/accounts/verify-mfa returns the
   * same payload shape as a successful login. On 200 we persist tokens
   * and surface the partial user the same way `login` does.
   */
  async verifyMfa(input: { tempToken: string; code: string }): Promise<User> {
    const res = await http.post<LoginResponse>("/api/accounts/verify-mfa", {
      body: { tempToken: input.tempToken, token: input.code },
      anonymous: true,
    });
    setTokens({ access: res.access, refresh: res.refresh });
    return {
      id: res.userId,
      email: res.email,
      name: res.email.split("@")[0],
      role: normalizeRole(res.role),
      organization: res.organizationId,
    };
  },

  /**
   * Enroll the user in MFA. The frontend generates the TOTP secret
   * client-side (so the QR can render without a backend round-trip) and
   * the user confirms it by entering the 6-digit code from their
   * authenticator app — that pair is sent here for the backend to verify
   * and persist. On success, `mfa_enabled` flips to true on the user.
   */
  async setupMfa(input: { secret: string; code: string }): Promise<User> {
    const wire = await http.post<UserOutWire>("/api/accounts/mfa/setup", {
      body: { secret: input.secret, token: input.code },
    });
    return wireToUser(wire);
  },

  /**
   * Disable MFA. Backend requires a current 6-digit code from the user's
   * authenticator app to prove possession of the device before allowing
   * disable. Returns the updated user (with `mfa_enabled: false`).
   */
  async disableMfa(input: { code: string }): Promise<User> {
    const wire = await http.post<UserOutWire>("/api/accounts/mfa/disable", {
      body: { token: input.code },
    });
    return wireToUser(wire);
  },

  /**
   * Register a new account and immediately log in so the caller has tokens.
   * The backend register endpoint returns the user but no tokens, so we
   * follow up with a login call.
   */
  async register(input: RegisterInput): Promise<User> {
    const { firstName, lastName } = splitName(input.name);
    await http.post("/api/accounts/register", {
      body: {
        email: input.email,
        password: input.password,
        firstName,
        lastName,
        organizationName: input.organizationName,
      },
      anonymous: true,
    });
    // Backend register returns the user but no tokens; log in to receive them.
    // Fresh accounts can't have MFA configured yet, so the login should
    // always return the success branch — but we narrow defensively just
    // in case the backend ever changes that.
    const result = await this.login({ email: input.email, password: input.password });
    if (result.mfaRequired) {
      throw new Error(
        "Registration succeeded but the account already has MFA — unexpected. Please sign in directly.",
      );
    }
    const user = result.user;
    // Patch phone onto /me if the user supplied one — non-fatal if it fails.
    if (input.phone) {
      try {
        await http.patch("/api/accounts/me", { body: { phoneNumber: input.phone } });
        user.phone = input.phone;
      } catch {
        // Swallow — registration succeeded, phone is decorative.
      }
    }
    return user;
  },

  /** Log out, revoke server-side, clear local tokens. */
  async logout(): Promise<void> {
    try {
      await http.post("/api/accounts/logout");
    } catch {
      // Even if the server call fails, drop local tokens — user clicked "logout".
    } finally {
      clearTokens();
    }
  },

  /** Fetch the full profile of the currently authenticated user. */
  async me(): Promise<User> {
    const wire = await http.get<UserOutWire>("/api/accounts/me");
    return wireToUser(wire);
  },

  /** Update the current user's profile. Returns the updated User. */
  async updateProfile(
    patch: Partial<{ name: string; phone: string; avatarUrl: string; telegramUsername: string }>,
  ): Promise<User> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) {
      const { firstName, lastName } = splitName(patch.name);
      body.firstName = firstName;
      body.lastName = lastName;
    }
    if (patch.phone !== undefined) body.phoneNumber = patch.phone;
    if (patch.avatarUrl !== undefined) body.avatarUrl = patch.avatarUrl;
    if (patch.telegramUsername !== undefined) {
      // Stored without the leading "@"; empty string clears it.
      body.telegramUsername = patch.telegramUsername.replace(/^@/, "").trim();
    }
    const wire = await http.patch<UserOutWire>("/api/accounts/me", { body });
    return wireToUser(wire);
  },

  /* ─── Telegram link ─────────────────────────────────────────────────────
   * A bot can only message a chat that has messaged it first, so linking is
   * a deep link (t.me/<bot>?start=<code>) the user opens; the bot receives
   * `/start <code>` and stores the chat id on this account. */

  async telegramLink(): Promise<TelegramLink> {
    const w = await http.post<TelegramLinkWire>("/api/accounts/me/telegram/link");
    const url = w.url ?? w.link ?? w.deepLink;
    if (!url) throw new Error("The server did not return a Telegram link.");
    return {
      url,
      code: w.code ?? w.token,
      expiresAt: w.expiresAt ? Date.parse(w.expiresAt) : undefined,
    };
  },

  async telegramUnlink(): Promise<void> {
    await http.delete("/api/accounts/me/telegram");
  },

  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    await http.post("/api/accounts/change-password", {
      body: { currentPassword, newPassword },
    });
  },

  async requestPasswordReset(email: string): Promise<void> {
    await http.post("/api/accounts/password-reset/request", {
      body: { email },
      anonymous: true,
    });
  },

  async confirmPasswordReset(token: string, newPassword: string): Promise<void> {
    await http.post("/api/accounts/password-reset/confirm", {
      body: { token, newPassword },
      anonymous: true,
    });
  },

  /**
   * Upload a new profile avatar — multipart, backend at POST /api/accounts/me/avatar.
   * Returns the updated `User`. The browser sets the multipart boundary, so we
   * pass FormData with `rawBody: true` to skip JSON serialization.
   *
   * Field name: the previous version sent the file under `file`, which the
   * backend's DRF view didn't recognize — it responded `400 "No file
   * provided"`. The matching endpoint url is `/me/avatar` so the standard
   * convention `avatar` is the right name. If the backend ever changes to
   * another key (e.g. `image`, `upload`), this is the one place to update.
   */
  async uploadAvatar(file: File): Promise<User> {
    const form = new FormData();
    form.append("avatar", file);
    const wire = await http.post<UserOutWire>("/api/accounts/me/avatar", {
      body: form,
      rawBody: true,
    });
    return wireToUser(wire);
  },
};

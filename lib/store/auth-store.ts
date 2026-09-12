/**
 * Auth store — backed by the real /api/accounts/* endpoints.
 *
 * Persists only the `user` snapshot for fast first-paint after a reload;
 * JWT tokens are persisted separately by `lib/api/tokens.ts`. On mount the
 * app shell calls `bootstrap()` to validate the token and refresh the
 * cached user profile.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { ApiError } from "@/lib/api/http";
import { authService } from "@/lib/api/services/auth.service";
import { clearTokens, hasTokens } from "@/lib/api/tokens";
import type { Role, User } from "@/lib/types";

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  hydrated: boolean;
  /** True while a login / register / bootstrap call is in flight. */
  pending: boolean;
  /** Last error message from an auth call, surfaced for form-level display. */
  error: string | null;

  /** Pending MFA challenge — set by `login` when the backend signals that
   *  a 6-digit code is needed. The login form reads this to switch to
   *  the challenge step; `completeMfa(code)` finishes the flow. */
  pendingMfa: { tempToken: string } | null;
  /**
   * Step 1 of sign-in. Returns the User on success or null when MFA is
   * required (in which case `pendingMfa` is set and the caller should show
   * the challenge UI). Throws on credential failure.
   */
  login: (email: string, password: string, role?: Role) => Promise<User | null>;
  /** Step 2 of sign-in (only fires when `pendingMfa` is set). */
  completeMfa: (code: string, role?: Role) => Promise<User>;
  /** Drop a pending MFA challenge — used by the login form's "back" button. */
  cancelMfa: () => void;
  /** Persist a fresh TOTP secret + confirming code to the backend. On
   *  success the user's `mfaEnabled` flips to true. */
  enableMfa: (input: { secret: string; code: string }) => Promise<void>;
  /** Tear down the user's MFA enrollment, gated on a current 6-digit code. */
  disableMfa: (code: string) => Promise<void>;
  signup: (input: {
    name: string;
    email: string;
    password: string;
    organization: string;
    phone?: string;
  }) => Promise<User>;
  logout: () => Promise<void>;
  /**
   * Called once on app shell mount. If tokens exist, fetches /me to
   * validate them and refresh the user snapshot. No-op if no tokens.
   */
  bootstrap: () => Promise<void>;
  setRole: (role: Role) => void;
  /** Replace the user's avatar locally, then patch it to /me. Throws (and
   *  reverts the local change) on failure — see the implementation note on
   *  why the backend patch currently can't actually clear a stored avatar. */
  setAvatar: (avatarUrl: string | null) => Promise<void>;
  /** Update name + phone via PATCH /api/accounts/me. Throws on failure. */
  updateProfile: (patch: { name?: string; phone?: string }) => Promise<void>;
  /** Multipart-upload a new avatar file. Returns the hosted URL the backend
   *  saved; the auth-store's `user.avatarUrl` is updated to match. */
  uploadAvatar: (file: File) => Promise<void>;
  _setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      hydrated: false,
      pending: false,
      error: null,
      pendingMfa: null,

      login: async (email, password, role) => {
        set({ pending: true, error: null, pendingMfa: null });
        try {
          const result = await authService.login({ email, password });
          // MFA challenge — surface the temp token so the UI can switch
          // to the code-entry step. Tokens are not persisted yet; that
          // happens after `completeMfa` succeeds.
          if (result.mfaRequired) {
            set({ pending: false, pendingMfa: { tempToken: result.tempToken } });
            return null;
          }
          // Fetch full profile (first/last name, phone, etc.) immediately.
          let user: User;
          try {
            user = await authService.me();
          } catch {
            user = result.user; // /me failed but tokens are valid — show the partial.
          }
          // Optional role override — keeps the existing demo role-switch behaviour.
          if (role) user = { ...user, role };
          set({ user, isAuthenticated: true, pending: false, error: null });
          return user;
        } catch (e) {
          // Backend rate-limits login to 5/min — surface a friendlier message
          // than the raw "HTTP 429" so the form can guide the user.
          const friendly =
            e instanceof ApiError && e.status === 429
              ? "Too many sign-in attempts. Please wait a minute and try again."
              : messageFromError(e);
          set({ pending: false, error: friendly });
          throw e;
        }
      },

      completeMfa: async (code, role) => {
        const pending = get().pendingMfa;
        if (!pending) {
          throw new Error("No MFA challenge in progress.");
        }
        set({ pending: true, error: null });
        try {
          const partial = await authService.verifyMfa({
            tempToken: pending.tempToken,
            code,
          });
          let user: User;
          try {
            user = await authService.me();
          } catch {
            user = partial;
          }
          if (role) user = { ...user, role };
          set({
            user,
            isAuthenticated: true,
            pending: false,
            error: null,
            pendingMfa: null,
          });
          return user;
        } catch (e) {
          set({ pending: false, error: messageFromError(e) });
          throw e;
        }
      },

      cancelMfa: () => set({ pendingMfa: null }),

      enableMfa: async ({ secret, code }) => {
        const user = await authService.setupMfa({ secret, code });
        set((s) => ({
          // Backend echoes the full user; merge what we already have so
          // any locally-set fields (role override from login, optimistic
          // avatar updates) survive.
          user: s.user ? { ...s.user, ...user } : user,
        }));
      },

      disableMfa: async (code) => {
        const user = await authService.disableMfa({ code });
        set((s) => ({
          user: s.user ? { ...s.user, ...user } : user,
        }));
      },

      signup: async ({ name, email, password, organization, phone }) => {
        set({ pending: true, error: null });
        try {
          const user = await authService.register({
            name,
            email,
            password,
            organizationName: organization,
            phone,
          });
          set({ user, isAuthenticated: true, pending: false, error: null });
          return user;
        } catch (e) {
          set({ pending: false, error: messageFromError(e) });
          throw e;
        }
      },

      logout: async () => {
        // Optimistically clear local state so the UI flips immediately.
        set({ user: null, isAuthenticated: false, error: null });
        try {
          await authService.logout();
        } catch {
          clearTokens();
        }
      },

      bootstrap: async () => {
        // No tokens — drop any stale persisted snapshot and bail.
        if (!hasTokens()) {
          set({ user: null, isAuthenticated: false, hydrated: true });
          return;
        }
        try {
          const user = await authService.me();
          set({ user, isAuthenticated: true, hydrated: true, error: null });
        } catch (e) {
          // Only log the user out on a genuine auth failure. Transient
          // failures (5xx, 429, network blips) leave the saved tokens
          // alone so a refresh-storm or backend hiccup doesn't kick a
          // signed-in user back to the login screen. If `performRefresh`
          // already gave up and cleared the tokens, hasTokens() is now
          // false and the UI flips to logged-out below.
          const isAuthFailure =
            e instanceof ApiError && (e.status === 401 || e.status === 403);
          if (isAuthFailure || !hasTokens()) {
            clearTokens();
            set({ user: null, isAuthenticated: false, hydrated: true });
          } else {
            // Tokens still present, server probably had a hiccup — keep
            // the user signed in and just mark as hydrated.
            set({ hydrated: true });
          }
        }
      },

      setRole: (role) => set((s) => (s.user ? { user: { ...s.user, role } } : s)),

      setAvatar: async (avatarUrl) => {
        const previous = get().user;
        if (!previous) return;
        // Optimistic local flip.
        set({ user: { ...previous, avatarUrl: avatarUrl ?? undefined } });
        try {
          // Sync to backend — passing `""` (or null) clears the avatar there
          // too. Per BACKEND-CONTRACT.md §2.16, `avatarUrl` isn't actually a
          // documented PATCH /me field (it's populated read-only by the
          // upload endpoint), so this currently has no effect server-side —
          // the backend silently ignores it rather than rejecting it, which
          // is why we can't just check the response and have to rely on the
          // caller re-hydrating from /me to notice. Throwing here (instead of
          // swallowing) at least stops the store from claiming success when
          // the request itself failed outright.
          await authService.updateProfile({ avatarUrl: avatarUrl ?? "" });
        } catch (e) {
          // Revert the optimistic flip — showing "removed" when the backend
          // rejected the change would just reintroduce the same bug on the
          // next /me refresh, one screen later.
          set({ user: previous });
          throw e;
        }
      },

      updateProfile: async (patch) => {
        // Only send fields the caller actually wants to change. Throws on
        // failure so the caller can surface a toast.
        const user = await authService.updateProfile(patch);
        set({ user });
      },

      uploadAvatar: async (file) => {
        // Multipart upload via POST /api/accounts/me/avatar. Backend stores
        // the binary and returns the hosted URL; we replace the local user
        // snapshot with whatever /me returns so the URL points to the
        // server's canonical version (not a stale data: URL).
        const user = await authService.uploadAvatar(file);
        set({ user });
      },

      _setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "vortyx.auth",
      storage: createJSONStorage(() => localStorage),
      // Persist user snapshot for fast first-paint. Tokens live in their own
      // module so we don't double-store credentials.
      partialize: (s) => ({ user: s.user, isAuthenticated: s.isAuthenticated }),
      onRehydrateStorage: () => (state) => state?._setHydrated(),
    },
  ),
);

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Authentication failed";
}

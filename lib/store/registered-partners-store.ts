"use client";

/**
 * Emails this browser has already seen as "registered".
 *
 * The backend keeps no "accepted the invite" flag, so registration is read from
 * login sessions, which expire after 7 days (see lib/partner-registration.ts).
 * Without a memory, someone who accepted weeks ago and has not signed in since
 * would fall back to "invited". Once seen registered, an email stays registered
 * here. Per browser only - another browser re-learns it from the live check.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface State {
  /** lower-cased email -> when this browser first saw it registered (ms). */
  seen: Record<string, number>;
  remember: (emails: readonly string[]) => void;
}

export const useRegisteredPartnersStore = create<State>()(
  persist(
    (set) => ({
      seen: {},
      remember: (emails) =>
        set((s) => {
          const fresh = emails.map((e) => e.trim().toLowerCase()).filter((e) => e && s.seen[e] === undefined);
          if (fresh.length === 0) return s; // nothing new: no change, no re-render
          const now = Date.now();
          const next = { ...s.seen };
          for (const e of fresh) next[e] = now;
          return { seen: next };
        }),
    }),
    { name: "vortyx.registered-partners", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

"use client";

/**
 * What this browser knows about invited emails.
 *
 *   seen       email -> when this browser first saw it "registered".
 *              Login sessions expire after 7 days, so without this someone who
 *              accepted weeks ago would fall back to "Invited".
 *   invitedAt  email -> when this browser last sent it an invitation.
 *
 * A NEW invitation must start from scratch: when a partner is deleted and the
 * same email is invited again, nothing learned before that invitation may make
 * it read "Registered". So `markInvited` forgets what was seen and records the
 * invite time, and anything older than that time no longer counts.
 *
 * Used only when the server does not report an invitation status itself; when
 * it does (see lib/partner-registration.ts), the server's word is final.
 * Per browser only.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

const norm = (e: string) => e.trim().toLowerCase();

interface State {
  seen: Record<string, number>;
  invitedAt: Record<string, number>;
  /** These emails are registered (only adds; an email already known is left as is). */
  remember: (emails: readonly string[]) => void;
  /** A fresh invitation was just sent: start these emails from scratch. */
  markInvited: (emails: readonly string[]) => void;
  /** Forget these emails entirely (their partner was deleted, or they were removed). */
  forget: (emails: readonly string[]) => void;
}

export const useRegisteredPartnersStore = create<State>()(
  persist(
    (set) => ({
      seen: {},
      invitedAt: {},
      remember: (emails) =>
        set((s) => {
          const fresh = emails.map(norm).filter((e) => e && s.seen[e] === undefined);
          if (fresh.length === 0) return s; // nothing new: no change, no re-render
          const now = Date.now();
          const next = { ...s.seen };
          for (const e of fresh) next[e] = now;
          return { seen: next };
        }),
      markInvited: (emails) =>
        set((s) => {
          const list = emails.map(norm).filter(Boolean);
          if (list.length === 0) return s;
          const now = Date.now();
          const seen = { ...s.seen };
          const invitedAt = { ...s.invitedAt };
          for (const e of list) {
            delete seen[e];
            invitedAt[e] = now;
          }
          return { seen, invitedAt };
        }),
      forget: (emails) =>
        set((s) => {
          const list = emails.map(norm).filter((e) => e && (s.seen[e] !== undefined || s.invitedAt[e] !== undefined));
          if (list.length === 0) return s;
          const seen = { ...s.seen };
          const invitedAt = { ...s.invitedAt };
          for (const e of list) {
            delete seen[e];
            delete invitedAt[e];
          }
          return { seen, invitedAt };
        }),
    }),
    {
      name: "vortyx.registered-partners",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      // v1 had only `seen`. Keep it; start with no invite times.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as { seen?: Record<string, number>; invitedAt?: Record<string, number> };
        return { seen: p.seen ?? {}, invitedAt: p.invitedAt ?? {} } as unknown as State;
      },
    },
  ),
);

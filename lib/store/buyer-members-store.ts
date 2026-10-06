"use client";

/**
 * Extra people invited to a buyer from the Members table on the buyer's
 * settings tab (the buyer's own contact email is shown automatically and is not
 * stored here). Kept in this browser, like the publisher equivalent
 * (publisher-access-store). Whether each one has registered is NOT stored: it
 * is read live (see lib/partner-registration.ts).
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface BuyerMember {
  id: string;
  email: string;
  invitedAt: number;
}

interface State {
  byBuyer: Record<string, BuyerMember[]>;
  addMember: (buyerId: string, email: string) => void;
  removeMember: (buyerId: string, memberId: string) => void;
}

export const useBuyerMembersStore = create<State>()(
  persist(
    (set) => ({
      byBuyer: {},
      addMember: (buyerId, email) =>
        set((s) => {
          const trimmed = email.trim().toLowerCase();
          if (!trimmed) return s;
          const cur = s.byBuyer[buyerId] ?? [];
          if (cur.some((m) => m.email === trimmed)) return s;
          const member: BuyerMember = {
            id: `bm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
            email: trimmed,
            invitedAt: Date.now(),
          };
          return { byBuyer: { ...s.byBuyer, [buyerId]: [...cur, member] } };
        }),
      removeMember: (buyerId, memberId) =>
        set((s) => {
          const cur = s.byBuyer[buyerId];
          if (!cur) return s;
          return { byBuyer: { ...s.byBuyer, [buyerId]: cur.filter((m) => m.id !== memberId) } };
        }),
    }),
    { name: "vortyx.buyer-members", storage: createJSONStorage(() => localStorage), version: 1 },
  ),
);

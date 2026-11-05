/**
 * CH-578: Clear All in the bell and on the Notifications page.
 *
 * Insights and anomalies are worked out afresh from live data on every load,
 * so there is no stored row to delete: a problem would come straight back.
 * Clear All hides what is showing now, for this login on this browser, until
 * 12 AM Eastern. Anything new shows at once; a problem that is still there
 * returns the next day, so a real fault is never hidden for good.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface NotificationsClearedState {
  ids: Record<string, true>;
  /** The Eastern day start the ids were cleared on. */
  day: number;
  /** The login they were cleared for. */
  owner: string | null;
  clear: (ids: string[], day: number, owner: string | null) => void;
}

export const useNotificationsClearedStore = create<NotificationsClearedState>()(
  persist(
    (set, get) => ({
      ids: {},
      day: 0,
      owner: null,
      clear: (ids, day, owner) => {
        const s = get();
        const next: Record<string, true> = s.day === day && s.owner === owner ? { ...s.ids } : {};
        for (const id of ids) next[id] = true;
        set({ ids: next, day, owner });
      },
    }),
    { name: "avortyx.notifications.cleared", storage: createJSONStorage(() => localStorage) },
  ),
);

/** The ids cleared for this login today; empty once the day or login changes. */
export function activeCleared(
  s: Pick<NotificationsClearedState, "ids" | "day" | "owner">,
  day: number,
  owner: string | null,
): Record<string, true> {
  return s.day === day && s.owner === owner ? s.ids : {};
}

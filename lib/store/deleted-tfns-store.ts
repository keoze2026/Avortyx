"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { deletedTfnsService, type DeletedTfn, type DeletedTfnsNotice } from "@/lib/api/services/deleted-tfns.service";
import { useAuthStore } from "@/lib/store/auth-store";

interface State extends DeletedTfnsNotice {
  /** Numbers already Seen, kept in the bell until 12 PM Eastern (CH-182). The
   *  server stops sending a number once it is Seen, so the browser holds on
   *  to it. */
  kept: DeletedTfn[];
  /** The user `kept` belongs to, so a different login on this browser starts
   *  with an empty list. */
  keptFor: string | null;
  loaded: boolean;
  load: () => Promise<void>;
  markSeen: () => Promise<void>;
}

const EASTERN = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  hourCycle: "h23",
});

/** The Eastern wall clock at `at`, written as if it were UTC. */
function easternWall(at: Date) {
  const p: Record<string, number> = Object.fromEntries(
    EASTERN.formatToParts(at).map((x) => [x.type, Number(x.value)]),
  );
  return {
    year: p.year,
    month: p.month,
    day: p.day,
    hour: p.hour,
    ms: Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute),
  };
}

/** The last 12 PM Eastern at or before `now`. Numbers retired after it stay
 *  listed; at the next 12 PM Eastern they drop off. */
export function lastNoonEastern(now: Date = new Date()): Date {
  const wall = easternWall(now);
  const noonAsUtc = Date.UTC(wall.year, wall.month - 1, wall.hour < 12 ? wall.day - 1 : wall.day, 12);
  // Shift by Eastern's offset at that noon (noon is never near the 2 AM clock change).
  return new Date(noonAsUtc + (noonAsUtc - easternWall(new Date(noonAsUtc)).ms));
}

/** Seen numbers the server no longer sends, still inside today's window. */
function keepUntilNoon(prevKept: DeletedTfn[], prevNumbers: DeletedTfn[], next: DeletedTfn[]): DeletedTfn[] {
  const sent = new Set(next.map((n) => n.id));
  const since = lastNoonEastern().getTime();
  const byId = new Map<string, DeletedTfn>();
  for (const n of [...prevNumbers, ...prevKept]) {
    if (!sent.has(n.id) && new Date(n.retiredAt).getTime() >= since && !byId.has(n.id)) byId.set(n.id, n);
  }
  return [...byId.values()].sort((a, b) => b.retiredAt.localeCompare(a.retiredAt));
}

/** The "TFNs deleted" notice (backend CH-179). Loaded and refreshed by
 *  NotificationRuntime; shown pinned in the bell menu. Unseen numbers count
 *  on the bell until Seen; every number stays listed until 12 PM Eastern. */
export const useDeletedTfnsStore = create<State>()(
  persist(
    (set, get) => {
      const apply = (notice: DeletedTfnsNotice) => {
        const userId = useAuthStore.getState().user?.id ?? null;
        const s = get();
        const prevKept = s.keptFor === userId ? s.kept : [];
        const prevNumbers = s.keptFor === userId ? s.numbers : [];
        set({
          ...notice,
          kept: keepUntilNoon(prevKept, prevNumbers, notice.numbers),
          keptFor: userId,
          loaded: true,
        });
      };
      return {
        count: 0,
        unseenCount: 0,
        numbers: [],
        seenAt: null,
        newestAt: null,
        kept: [],
        keptFor: null,
        loaded: false,
        load: async () => {
          try {
            apply(await deletedTfnsService.get());
          } catch {
            // Keep what is on screen; the next refresh tries again.
          }
        },
        markSeen: async () => {
          apply(await deletedTfnsService.markSeen(get().newestAt));
        },
      };
    },
    {
      name: "vortyx.deletedTfns.kept",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ kept: s.kept, keptFor: s.keptFor }),
    },
  ),
);

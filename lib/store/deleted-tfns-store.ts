"use client";

import { create } from "zustand";

import { deletedTfnsService, type DeletedTfnsNotice } from "@/lib/api/services/deleted-tfns.service";

interface State extends DeletedTfnsNotice {
  loaded: boolean;
  load: () => Promise<void>;
  markSeen: () => Promise<void>;
}

/** The "TFNs deleted" notice (backend CH-179). Loaded and refreshed by
 *  NotificationRuntime; shown pinned in the bell menu until Seen. */
export const useDeletedTfnsStore = create<State>((set, get) => ({
  count: 0,
  numbers: [],
  seenAt: null,
  newestAt: null,
  loaded: false,
  load: async () => {
    try {
      const notice = await deletedTfnsService.get();
      set({ ...notice, loaded: true });
    } catch {
      // Keep what is on screen; the next refresh tries again.
    }
  },
  markSeen: async () => {
    const notice = await deletedTfnsService.markSeen(get().newestAt);
    set({ ...notice, loaded: true });
  },
}));

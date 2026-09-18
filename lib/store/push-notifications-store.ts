/**
 * Push-notification bus.
 *
 * Banner-style alerts that pop up at the top of the screen (iPhone-style)
 * when something operationally important happens — TFN cap reached, AHT
 * dipped, DNC match, conversion spike, etc.
 *
 * Any module can call `pushNotification(...)` to surface an alert without
 * having to plumb component props or context through the app shell.
 */

"use client";

import { create } from "zustand";

import type { NotificationSeverity } from "@/lib/mock/notifications";

export type PushIcon = "phone" | "dollar" | "shield" | "spark" | "alert";

export interface PushNotification {
  /** Runtime id — generated on push, used as the React key + dismissal handle. */
  id: string;
  severity: NotificationSeverity;
  /** Optional icon glyph shown in the banner's left tile. */
  icon?: PushIcon;
  title: string;
  body: string;
  /** Short source / label (campaign, buyer, "+18883241868", …). */
  source?: string;
  /** Optional action label rendered as a chip button at the bottom right. */
  action?: string;
  /** Where the action chip navigates. Without it the chip just dismisses. */
  actionHref?: string;
  /** Auto-dismiss after this many ms (default 6000). 0 = sticky. */
  durationMs?: number;
  /** Internal — when the banner was pushed (ms epoch). */
  pushedAt: number;
}

interface PushState {
  banners: PushNotification[];
  push: (
    n: Omit<PushNotification, "id" | "pushedAt"> & { id?: string },
  ) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

function makeId() {
  return `push_${Math.random().toString(36).slice(2, 8)}_${Date.now()}`;
}

export const usePushNotificationsStore = create<PushState>((set) => ({
  banners: [],
  push: (input) => {
    const id = input.id ?? makeId();
    set((s) => {
      // Cap concurrent banners so a noisy stream doesn't take over the screen.
      const next = [
        ...s.banners,
        { ...input, id, pushedAt: Date.now() } as PushNotification,
      ];
      return { banners: next.slice(-4) };
    });
    return id;
  },
  dismiss: (id) =>
    set((s) => ({ banners: s.banners.filter((b) => b.id !== id) })),
  clear: () => set({ banners: [] }),
}));

/** Helper that doesn't require subscribing to the hook. */
export function pushNotification(
  input: Omit<PushNotification, "id" | "pushedAt"> & { id?: string },
) {
  return usePushNotificationsStore.getState().push(input);
}

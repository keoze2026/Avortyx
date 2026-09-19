/**
 * Alert preferences — which alert types may pop up as a banner at the top
 * of the screen. Backed by the backend, per user:
 *
 *   GET   /api/notifications/events        the catalogue (label + default)
 *   GET   /api/notifications/preferences   { popups_enabled, popup_events, sound_enabled }
 *   PATCH /api/notifications/preferences   any subset; popup_events replaces the list
 *
 * Every alert still lands in the bell menu and on /notifications; this
 * only decides whether it *also* interrupts the operator with a banner.
 * Set from the "Pop-up alerts" panel under the bell's Alerts tab.
 *
 * The last known catalogue + preferences are cached in localStorage so the
 * runtimes can answer `popupAllowed()` before the first fetch resolves and
 * the panel doesn't flash empty on a reload.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import {
  notificationsService,
  type AlertEvent,
  type AlertPreferences,
} from "@/lib/api/services/notifications.service";

interface AlertPreferencesState {
  events: AlertEvent[];
  popupsEnabled: boolean;
  popupEvents: string[];
  soundEnabled: boolean;
  hydrated: boolean;
  loading: boolean;
  error: string | null;

  fetch: () => Promise<void>;
  setPopupsEnabled: (on: boolean) => Promise<void>;
  setEvent: (event: string, on: boolean) => Promise<void>;
  setAllEvents: (on: boolean) => Promise<void>;
  setSoundEnabled: (on: boolean) => Promise<void>;
}

function messageFromError(e: unknown): string {
  return e instanceof Error ? e.message : "Couldn't save alert preferences";
}

export const useAlertPreferencesStore = create<AlertPreferencesState>()(
  persist(
    (set, get) => {
      /** Optimistic PATCH: apply locally, send, roll back on failure. */
      const save = async (patch: Partial<AlertPreferences>) => {
        const before = {
          popupsEnabled: get().popupsEnabled,
          popupEvents: get().popupEvents,
          soundEnabled: get().soundEnabled,
        };
        set({ ...patch, error: null });
        try {
          const saved = await notificationsService.updatePreferences(patch);
          set({ ...saved });
        } catch (e) {
          set({ ...before, error: messageFromError(e) });
          throw e;
        }
      };

      return {
        events: [],
        popupsEnabled: true,
        popupEvents: [],
        soundEnabled: false,
        hydrated: false,
        loading: false,
        error: null,

        fetch: async () => {
          if (get().loading) return;
          set({ loading: true, error: null });
          try {
            const [events, prefs] = await Promise.all([
              notificationsService.events(),
              notificationsService.preferences(),
            ]);
            set({ events, ...prefs, hydrated: true, loading: false });
          } catch (e) {
            // Keep whatever was cached; the panel shows the error inline.
            set({ loading: false, error: messageFromError(e) });
          }
        },

        setPopupsEnabled: (on) => save({ popupsEnabled: on }),

        setEvent: (event, on) => {
          const current = new Set(get().popupEvents);
          if (on) current.add(event);
          else current.delete(event);
          return save({ popupEvents: [...current] });
        },

        setAllEvents: (on) =>
          save({ popupEvents: on ? get().events.map((e) => e.event) : [] }),

        setSoundEnabled: (on) => save({ soundEnabled: on }),
      };
    },
    {
      name: "avortyx.alert-prefs",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only the data is cached — never the transient flags.
      partialize: (s) => ({
        events: s.events,
        popupsEnabled: s.popupsEnabled,
        popupEvents: s.popupEvents,
        soundEnabled: s.soundEnabled,
      }),
      migrate: (persisted, version) => {
        // v0 was the local-only store with a different shape; start clean.
        if (version < 1) return undefined as unknown as AlertPreferencesState;
        return persisted as AlertPreferencesState;
      },
    },
  ),
);

/**
 * Non-hook read for runtimes that fire outside React render.
 *
 * An event the backend's catalogue doesn't list can't be switched off by
 * the operator, so it follows the master switch only.
 */
export function popupAllowed(event: string): boolean {
  const s = useAlertPreferencesStore.getState();
  if (!s.popupsEnabled) return false;
  const known = s.events.some((e) => e.event === event);
  if (!known) return true;
  return s.popupEvents.includes(event);
}

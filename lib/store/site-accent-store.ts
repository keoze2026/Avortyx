"use client";

/**
 * Marketing-site accent — Green (the landing page's own palette, default) or
 * Blue (Avortyx's original brand colour).
 *
 * This is the switch behind the toggle in the landing-page header. It owns
 * the `site-blue` class on <html>, which swaps the `--color-keppel-*` ramp
 * every marketing/auth surface resolves its accent through (see
 * app/globals.css). Green needs no class: the base tokens ARE green, so a JS
 * failure lands on the purchased design rather than on the alternate.
 *
 * Separate from `useAccentStore` (the product's own theme picker) on purpose:
 * that store's default is blue, and a first-time visitor should see the
 * landing page the way it was designed. The toggle still writes through to
 * the product store on every explicit choice (see SiteAccentToggle), so once
 * a visitor picks a colour, marketing, auth and the app all move together —
 * exactly what the previous header toggle did.
 */

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type SiteAccent = "green" | "blue";

/** localStorage key — read by the pre-paint init script in app/layout.tsx too. */
export const SITE_ACCENT_STORAGE_KEY = "avortyx.site-accent";
/** Class the init script / provider put on <html> for the blue variant. */
export const SITE_BLUE_CLASS = "site-blue";

interface SiteAccentState {
  accent: SiteAccent;
  setAccent: (accent: SiteAccent) => void;
}

export const useSiteAccentStore = create<SiteAccentState>()(
  persist(
    (set) => ({
      accent: "green",
      setAccent: (accent) => set({ accent }),
    }),
    {
      name: SITE_ACCENT_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        if (state && state.accent !== "green" && state.accent !== "blue") {
          state.accent = "green";
        }
      },
    },
  ),
);

/**
 * Alert preferences — which alert kinds are allowed to pop up as a banner
 * at the top of the screen.
 *
 * Every alert still lands in the bell menu and on /notifications; this
 * only decides whether it *also* interrupts the operator with a banner.
 * Set from the "Pop-up alerts" panel under the bell's Alerts tab.
 *
 * Persisted per browser so the choice survives a refresh.
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * The kinds an operator can switch on / off. Kept coarse on purpose — each
 * one maps to a question the operator actually asks ("do I want to be
 * interrupted when a buyer stops answering?"), not to a backend metric.
 */
export type PopupAlertKind =
  /** Any cap ≥ 90 % (destination, buyer or campaign; daily / monthly / lines). */
  | "capNear"
  /** A destination hit 100 % of a cap. */
  | "destinationCapOver"
  /** A buyer hit 100 % of a cap. */
  | "buyerCapOver"
  /** A campaign hit 100 % of a cap. */
  | "campaignCapOver"
  /** AHT dropped below its normal range. */
  | "lowAht"
  /** A buyer is missing / not answering a lot of calls. */
  | "buyerMissed"
  /** Any other AI anomaly (volume drop, latency spike, reject rate, …). */
  | "other";

export const POPUP_ALERT_KINDS: PopupAlertKind[] = [
  "capNear",
  "destinationCapOver",
  "buyerCapOver",
  "campaignCapOver",
  "lowAht",
  "buyerMissed",
  "other",
];

const DEFAULT_POPUPS: Record<PopupAlertKind, boolean> = {
  capNear: true,
  destinationCapOver: true,
  buyerCapOver: true,
  campaignCapOver: true,
  lowAht: true,
  buyerMissed: true,
  other: true,
};

interface AlertPreferencesState {
  popups: Record<PopupAlertKind, boolean>;
  setPopup: (kind: PopupAlertKind, on: boolean) => void;
  setAllPopups: (on: boolean) => void;
}

export const useAlertPreferencesStore = create<AlertPreferencesState>()(
  persist(
    (set) => ({
      popups: DEFAULT_POPUPS,
      setPopup: (kind, on) => set((s) => ({ popups: { ...s.popups, [kind]: on } })),
      setAllPopups: (on) =>
        set({
          popups: Object.fromEntries(POPUP_ALERT_KINDS.map((k) => [k, on])) as Record<PopupAlertKind, boolean>,
        }),
    }),
    {
      name: "avortyx.alert-prefs",
      storage: createJSONStorage(() => localStorage),
      // New kinds added later default to "on" instead of vanishing.
      merge: (persisted, current) => {
        const p = (persisted as Partial<AlertPreferencesState> | undefined)?.popups ?? {};
        return { ...current, popups: { ...DEFAULT_POPUPS, ...p } };
      },
    },
  ),
);

/** Non-hook read for runtimes that fire outside React render. */
export function popupAllowed(kind: PopupAlertKind): boolean {
  return useAlertPreferencesStore.getState().popups[kind] !== false;
}

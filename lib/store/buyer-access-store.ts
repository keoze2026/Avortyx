/**
 * Per-buyer access settings: the buyer's time zone and what the buyer's own
 * logins are allowed to do (Block Numbers, Download Reports).
 *
 * Same idea as the publisher equivalent (publisher-access-store), minus the
 * publisher-only permissions (Manage Traffic, Number Creation, Audio
 * Recording). Members and reporting visibility are NOT here: they already
 * have their own stores (buyer-members-store, buyer-reporting-store).
 *
 * Saved on the server at /api/buyers/{id}/access when the backend has it;
 * until then (404 / unreachable) it is kept in this browser so nothing the
 * admin sets is lost, and `serverBacked` tells the screen to say so.
 */

"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { http } from "@/lib/api/http";

export type BuyerPermissionKey = "blockNumbers" | "downloadReports";

export type BuyerPermissions = Record<BuyerPermissionKey, boolean>;

export interface BuyerAccessState {
  timezone: string;
  permissions: BuyerPermissions;
}

/** The permissions a buyer can be given (labels match the publisher screen). */
export const BUYER_PERMISSIONS: Array<{ key: BuyerPermissionKey; labelKey: string; descriptionKey: string }> = [
  {
    key: "blockNumbers",
    labelKey: "buyerAccess.perm.blockNumbers",
    descriptionKey: "buyerAccess.perm.blockNumbersDesc",
  },
  {
    key: "downloadReports",
    labelKey: "buyerAccess.perm.downloadReports",
    descriptionKey: "buyerAccess.perm.downloadReportsDesc",
  },
];

export function emptyBuyerAccess(): BuyerAccessState {
  return { timezone: "UTC", permissions: { blockNumbers: false, downloadReports: false } };
}

type AccessWire = {
  timezone?: string | null;
  permissions?: Partial<Record<BuyerPermissionKey, boolean>> | null;
};

function fromWire(w: AccessWire | null | undefined, fallback: BuyerAccessState): BuyerAccessState {
  return {
    timezone: (w?.timezone ?? "").trim() || fallback.timezone,
    permissions: {
      blockNumbers: !!(w?.permissions?.blockNumbers ?? fallback.permissions.blockNumbers),
      downloadReports: !!(w?.permissions?.downloadReports ?? fallback.permissions.downloadReports),
    },
  };
}

interface Store {
  byBuyer: Record<string, BuyerAccessState>;
  /** true once the server answered for this buyer; false = kept in this browser only. */
  serverBacked: Record<string, boolean>;
  /** Load from the server (safe to call every time the screen opens). */
  fetchAccess: (buyerId: string) => Promise<void>;
  setTimezone: (buyerId: string, timezone: string) => Promise<void>;
  togglePermission: (buyerId: string, key: BuyerPermissionKey) => Promise<void>;
}

export const useBuyerAccessStore = create<Store>()(
  persist(
    (set, get) => {
      /** Change locally at once, then save; a refused save is put back. */
      const save = async (buyerId: string, next: BuyerAccessState) => {
        const prev = get().byBuyer[buyerId] ?? emptyBuyerAccess();
        set((s) => ({ byBuyer: { ...s.byBuyer, [buyerId]: next } }));
        try {
          const w = await http.patch<AccessWire>(`/api/buyers/${buyerId}/access`, {
            body: { timezone: next.timezone, permissions: next.permissions },
          });
          set((s) => ({
            byBuyer: { ...s.byBuyer, [buyerId]: fromWire(w, next) },
            serverBacked: { ...s.serverBacked, [buyerId]: true },
          }));
        } catch (e) {
          const status = (e as { status?: number })?.status;
          if (status === 404 || status === 405 || status === undefined) {
            // The backend has no /access endpoint yet: keep it in this browser.
            set((s) => ({ serverBacked: { ...s.serverBacked, [buyerId]: false } }));
            return;
          }
          // A real refusal (403, 400...): undo and tell the caller.
          set((s) => ({ byBuyer: { ...s.byBuyer, [buyerId]: prev } }));
          throw e;
        }
      };

      return {
        byBuyer: {},
        serverBacked: {},

        fetchAccess: async (buyerId) => {
          try {
            const w = await http.get<AccessWire>(`/api/buyers/${buyerId}/access`);
            set((s) => ({
              byBuyer: { ...s.byBuyer, [buyerId]: fromWire(w, s.byBuyer[buyerId] ?? emptyBuyerAccess()) },
              serverBacked: { ...s.serverBacked, [buyerId]: true },
            }));
          } catch {
            set((s) => ({ serverBacked: { ...s.serverBacked, [buyerId]: false } }));
          }
        },

        setTimezone: async (buyerId, timezone) => {
          const cur = get().byBuyer[buyerId] ?? emptyBuyerAccess();
          await save(buyerId, { ...cur, timezone });
        },

        togglePermission: async (buyerId, key) => {
          const cur = get().byBuyer[buyerId] ?? emptyBuyerAccess();
          await save(buyerId, { ...cur, permissions: { ...cur.permissions, [key]: !cur.permissions[key] } });
        },
      };
    },
    {
      name: "avortyx.buyer-access",
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // Only the settings are remembered; "saved on the server?" is asked again each visit.
      partialize: (s) => ({ byBuyer: s.byBuyer }),
    },
  ),
);

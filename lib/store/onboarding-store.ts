/**
 * Onboarding store — caches the two gating signals the app shell checks:
 *
 *   1. KYC status (must equal "approved" to pass)
 *   2. Billing account balance (must be > 0 to pass)
 *
 * The gate component reads from here; the /kyc and /billing pages call
 * `refresh()` after a successful submission / recharge so the gate
 * re-evaluates without a full page reload.
 */

"use client";

import { create } from "zustand";

import { billingService } from "@/lib/api/services/billing.service";
import { kycService } from "@/lib/api/services/kyc.service";
import type { KycStatus } from "@/lib/api/services/kyc.service";

interface OnboardingState {
  /** null = unknown (loading or never fetched); otherwise the submission status. */
  kycStatus: KycStatus | null;
  /** null = unknown; otherwise the current account balance. */
  balance: number | null;
  /** True while the initial fetch (or a refresh) is in flight. */
  loading: boolean;
  /** Set to true after the first fetch completes (success or failure). */
  hydrated: boolean;

  refresh: () => Promise<void>;
  /** Overwrite the balance from a fresher source (the polled dashboard KPIs). */
  setBalance: (balance: number) => void;
}

export const useOnboardingStore = create<OnboardingState>()((set) => ({
  kycStatus: null,
  balance: null,
  loading: false,
  hydrated: false,

  refresh: async () => {
    set({ loading: true });
    try {
      const [kyc, account] = await Promise.all([
        kycService.get().catch(() => null),
        billingService.account().catch(() => null),
      ]);
      set((prev) => ({
        kycStatus: kyc?.status ?? null,
        // A failed account fetch must not wipe a balance the dashboard poll
        // already delivered.
        balance: account?.balance ?? prev.balance,
        loading: false,
        hydrated: true,
      }));
    } catch {
      set({ loading: false, hydrated: true });
    }
  },

  setBalance: (balance) => set({ balance }),
}));

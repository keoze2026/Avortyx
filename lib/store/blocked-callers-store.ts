"use client";

import { create } from "zustand";

import { spamService } from "@/lib/api/services/spam.service";
import { decodeScope, normalizeNumber } from "@/lib/store/blocked-numbers-store";
import type { BlockedNumberScope } from "@/lib/mock/suppression";

export interface BlockedCallerEntry {
  number: string;
  scope: BlockedNumberScope;
  campaignId?: string;
}

interface State {
  callers: BlockedCallerEntry[];
  fetch: () => Promise<void>;
}

/**
 * Every blocked caller in the workspace, whoever blocked it - the main
 * account, a publisher login or a buyer login (Sir, 21 Oct, CH-185). The call
 * log colours a caller red from this list, so a blocked caller is red in every
 * account. Before, each login only knew its own blocks: a caller the main
 * account blocked was not red for the publisher, and the other way round.
 */
export const useBlockedCallersStore = create<State>((set) => ({
  callers: [],
  fetch: async () => {
    try {
      const rows = await spamService.listBlockedCallers();
      set({
        callers: rows.map((r) => {
          const { scope, campaignId } = decodeScope(r.reason);
          return { number: normalizeNumber(r.number), scope, campaignId: campaignId ?? r.campaignId };
        }),
      });
    } catch {
      // Keep what we had; the next refresh tries again.
    }
  },
}));

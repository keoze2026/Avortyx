/**
 * Blocked Numbers store — backed by /api/spam/blacklist/*.
 *
 * The backend stores number + reason + isActive; the frontend additionally
 * tracks a `scope` ("global" vs "campaign") + optional `campaignId`. We
 * encode scope into the reason field as a JSON-tagged prefix so it round-
 * trips through the backend without requiring schema changes:
 *
 *   reason = "scope=campaign:abc-123|<user reason>"
 *   reason = "scope=global|<user reason>"
 *
 * Mutations call the spam service; reads come from the local cache hydrated
 * on `fetch()`. The CRUD methods preserve the previous sync-style return
 * value semantics but now perform real network calls.
 */

"use client";

import { create } from "zustand";

import { spamService, type SpamEntry } from "@/lib/api/services/spam.service";
import {
  type BlockedNumberEntry,
  type BlockedNumberScope,
} from "@/lib/mock/suppression";

interface BlockedNumbersState {
  numbers: BlockedNumberEntry[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  getById: (id: string) => BlockedNumberEntry | undefined;
  add: (input: {
    number: string;
    scope: BlockedNumberScope;
    campaignId?: string;
  }) => Promise<BlockedNumberEntry>;
  /** Update mutable fields on an existing blocked number.
   *  NOTE: `phone_number` is immutable on the backend after creation —
   *  delete + re-add if the operator needs to change the number itself.
   *  Only the campaign association (which we round-trip through the
   *  backend's `reason` field) can be edited here. */
  update: (
    id: string,
    patch: { campaignId?: string | undefined },
  ) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

/** Strip every non-digit so the store always holds canonical digits-only values. */
function normalizeNumber(input: string): string {
  return input.replace(/\D/g, "");
}

/** Pack the frontend-only `scope` ("number" vs "prefix") and optional
 *  `campaignId` into the backend reason string so round-trips preserve them. */
function encodeReason(scope: BlockedNumberScope, campaignId: string | undefined): string {
  const parts = [`scope=${scope}`];
  if (campaignId) parts.push(`campaign=${campaignId}`);
  return parts.join(";");
}

function decodeScope(reason: string | undefined): {
  scope: BlockedNumberScope;
  campaignId?: string;
} {
  const tokens = (reason ?? "").split(";").map((s) => s.trim());
  let scope: BlockedNumberScope = "number";
  let campaignId: string | undefined;
  for (const tok of tokens) {
    const [k, v] = tok.split("=");
    if (k === "scope" && (v === "number" || v === "prefix")) scope = v;
    else if (k === "campaign" && v) campaignId = v;
  }
  return { scope, campaignId };
}

function wireToEntry(w: SpamEntry): BlockedNumberEntry {
  const { scope, campaignId } = decodeScope(w.reason);
  return {
    id: w.id,
    // The backend echoes E.164 ("+1…"); the store holds digits only (the UI
    // adds the "+" itself — without this the list rendered "++1…").
    number: normalizeNumber(w.number),
    scope,
    campaignId,
  };
}

export const useBlockedNumbersStore = create<BlockedNumbersState>()((set, get) => ({
  numbers: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const page = await spamService.listBlacklist({ page: 1, pageSize: 500 });
      set({ numbers: page.items.map(wireToEntry), loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  getById: (id) => get().numbers.find((n) => n.id === id),

  add: async ({ number, scope, campaignId }) => {
    const normalized = normalizeNumber(number);
    const wire = await spamService.createBlacklist({
      number: normalized,
      reason: encodeReason(scope, campaignId),
    });
    const created = wireToEntry(wire);
    set((s) => ({ numbers: [created, ...s.numbers] }));
    return created;
  },

  update: async (id, patch) => {
    const current = get().numbers.find((n) => n.id === id);
    if (!current) return;
    const next: BlockedNumberEntry = { ...current };
    // `next.number` stays the same — phone numbers are immutable.
    if ("campaignId" in patch) {
      next.campaignId = patch.campaignId;
    }
    // Optimistic update — flips the UI immediately while the PATCH is in flight.
    const prev = get().numbers;
    set((s) => ({ numbers: s.numbers.map((n) => (n.id === id ? next : n)) }));
    try {
      // Only send the mutable field (`reason` — we encode scope + campaignId
      // into it). The backend rejects `phone_number` updates with 400.
      const updated = await spamService.updateBlacklist(id, {
        reason: encodeReason(next.scope, next.campaignId),
      });
      // Overwrite the optimistic row with whatever the backend echoed back.
      // If the backend persisted the change, this is a no-op repaint. If it
      // silently kept the old value (e.g. validation succeeded but no actual
      // update was applied), the UI reverts NOW instead of waiting for the
      // user to refresh — so the failed update is visible immediately.
      const reconciled = wireToEntry(updated);
      set((s) => ({
        numbers: s.numbers.map((n) => (n.id === id ? reconciled : n)),
      }));
    } catch (e) {
      set({ numbers: prev, error: messageFromError(e) });
      throw e;
    }
  },

  remove: async (id) => {
    const prev = get().numbers;
    set((s) => ({ numbers: s.numbers.filter((n) => n.id !== id) }));
    try {
      await spamService.deleteBlacklist(id);
    } catch (e) {
      set({ numbers: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Blocked numbers request failed";
}

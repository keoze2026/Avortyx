/**
 * Per-campaign advanced + sub-tab settings store. Keyed by campaignId.
 * Falls back to DEFAULT_CAMPAIGN_SETTINGS when a campaign hasn't been touched.
 *
 * Persistence model:
 *   - localStorage (fast first paint, offline cache)
 *   - PATCH /api/campaigns/{id} with `advanced_settings` (server truth)
 *
 * Every local update is auto-synced to the backend via a short debounce, so
 * rapid toggle-flips coalesce into one PATCH. A `seed(campaignId, settings)`
 * action is exposed for the detail page to call after fetching a campaign,
 * which writes the server's value into the store WITHOUT triggering another
 * PATCH (avoids an echo loop).
 */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { toast } from "sonner";

import { campaignsService } from "@/lib/api/services/campaigns.service";
import {
  DEFAULT_CAMPAIGN_SETTINGS,
  type CampaignAdvancedSettings,
} from "@/lib/types";

/**
 * Merge a partial settings blob (e.g. a fresh campaign whose backend
 * `advanced_settings` is `{}` or missing several sub-keys) onto the full
 * defaults so every leaf the UI reads is defined. Without this, accessing
 * `settings.callQueue.enabled` on a `{}` payload throws — which is exactly
 * what we saw after toggling Active on a brand-new campaign.
 *
 * The merge is one level deep: every top-level setting is a flat object or
 * an array, never nested objects of objects. Arrays are taken whole from
 * the incoming blob if present (we don't merge array contents).
 */
function withDefaults(
  partial: Partial<CampaignAdvancedSettings> | null | undefined,
): CampaignAdvancedSettings {
  if (!partial || typeof partial !== "object") return DEFAULT_CAMPAIGN_SETTINGS;
  const out = { ...DEFAULT_CAMPAIGN_SETTINGS };
  for (const key of Object.keys(DEFAULT_CAMPAIGN_SETTINGS) as Array<
    keyof CampaignAdvancedSettings
  >) {
    const incoming = partial[key];
    if (incoming === undefined || incoming === null) continue;
    const fallback = DEFAULT_CAMPAIGN_SETTINGS[key];
    if (Array.isArray(fallback)) {
      // Array fields (enrichmentUrls, access) — take whole or fall back.
      out[key] = (Array.isArray(incoming) ? incoming : fallback) as never;
    } else if (typeof fallback === "object" && fallback !== null) {
      // Object field — defensively spread defaults under the incoming partial.
      out[key] = {
        ...(fallback as object),
        ...(typeof incoming === "object" ? (incoming as object) : {}),
      } as never;
    } else {
      out[key] = incoming as never;
    }
  }
  return out;
}

interface CampaignSettingsState {
  byId: Record<string, CampaignAdvancedSettings>;
  /** Returns the campaign's settings, or defaults if unset. */
  get: (campaignId: string) => CampaignAdvancedSettings;
  /** Patch a specific feature on a campaign; syncs to backend (debounced). */
  update: <K extends keyof CampaignAdvancedSettings>(
    campaignId: string,
    key: K,
    value: CampaignAdvancedSettings[K],
  ) => void;
  /** Replace the whole bundle for a campaign; syncs to backend (debounced). */
  replace: (campaignId: string, settings: CampaignAdvancedSettings) => void;
  /**
   * Seed the local cache with the server's value WITHOUT re-syncing it
   * back. Use this on campaign-detail mount: server is the source of truth,
   * local cache is just a faster first paint.
   */
  seed: (campaignId: string, settings: CampaignAdvancedSettings) => void;
}

/* ─── Debounced backend sync ────────────────────────────────────────────── */
/* Toggle-spam on the 12 advanced cards coalesces into one PATCH per campaign.
 * Errors are toast'd by the caller, not the store, to keep this module pure. */

const SYNC_DELAY_MS = 400;
const pending = new Map<string, ReturnType<typeof setTimeout>>();

function scheduleSync(
  campaignId: string,
  settings: CampaignAdvancedSettings,
): void {
  const prev = pending.get(campaignId);
  if (prev) clearTimeout(prev);
  const timer = setTimeout(() => {
    pending.delete(campaignId);
    void campaignsService
      .update(campaignId, {
        advancedSettings: settings as unknown as Record<string, unknown>,
      })
      .catch((e: unknown) => {
        // Say so. Swallowing this is why a switch could be flipped, look
        // saved, and mean nothing: local state updates immediately and the
        // page only reseeds from the server on the next load, so a rejected
        // PATCH was invisible until someone noticed the feature wasn't
        // working. Local state is deliberately left as it is - reverting a
        // control the user just moved is worse than telling them.
        toast.error(
          e instanceof Error ? e.message : "Could not save that setting",
          { description: "The change was not saved. Reload to see the current values." },
        );
      });
  }, SYNC_DELAY_MS);
  pending.set(campaignId, timer);
}

export const useCampaignSettingsStore = create<CampaignSettingsState>()(
  persist(
    (set, get) => ({
      byId: {},
      get: (campaignId) => withDefaults(get().byId[campaignId]),
      update: (campaignId, key, value) => {
        const current = withDefaults(get().byId[campaignId]);
        const next: CampaignAdvancedSettings = { ...current, [key]: value };
        set((s) => ({ byId: { ...s.byId, [campaignId]: next } }));
        scheduleSync(campaignId, next);
      },
      replace: (campaignId, settings) => {
        const merged = withDefaults(settings);
        set((s) => ({ byId: { ...s.byId, [campaignId]: merged } }));
        scheduleSync(campaignId, merged);
      },
      seed: (campaignId, settings) =>
        set((s) => ({
          byId: { ...s.byId, [campaignId]: withDefaults(settings) },
        })),
    }),
    {
      name: "vortyx.campaign-settings",
      storage: createJSONStorage(() => localStorage),
      version: 1,
    },
  ),
);

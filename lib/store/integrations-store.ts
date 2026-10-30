/**
 * Integrations catalog store — backed by /api/integrations/*.
 *
 * Hydrated on app boot. Connect/disconnect use the optimistic + reconcile
 * pattern: flip the local state immediately, fire the API call, then
 * overwrite with the backend's response (when it includes the row) so any
 * server-side normalization is reflected without a refresh.
 */

"use client";

import { create } from "zustand";

import { integrationsService } from "@/lib/api/services/integrations.service";
import type { IntegrationApp } from "@/lib/types";
import { friendlyErrorMessage } from "@/lib/api/errors";

interface IntegrationsState {
  apps: IntegrationApp[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  connect: (id: string) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  /** Bulk variants for the "Connect selected" multi-select action. */
  connectMany: (ids: string[]) => Promise<void>;
  disconnectMany: (ids: string[]) => Promise<void>;
}

export const useIntegrationsStore = create<IntegrationsState>()((set, get) => ({
  apps: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const apps = await integrationsService.list();
      set({ apps, loading: false, hydrated: true });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  connect: async (id) => {
    const prev = get().apps;
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id ? { ...a, connected: true, connectedAt: Date.now() } : a,
      ),
    }));
    try {
      const fresh = await integrationsService.connect(id);
      if (fresh) {
        set((s) => ({ apps: s.apps.map((a) => (a.id === id ? fresh : a)) }));
      }
    } catch (e) {
      set({ apps: prev, error: messageFromError(e) });
      throw e;
    }
  },

  disconnect: async (id) => {
    const prev = get().apps;
    set((s) => ({
      apps: s.apps.map((a) =>
        a.id === id ? { ...a, connected: false, connectedAt: undefined } : a,
      ),
    }));
    try {
      await integrationsService.disconnect(id);
    } catch (e) {
      set({ apps: prev, error: messageFromError(e) });
      throw e;
    }
  },

  connectMany: async (ids) => {
    // Fire in parallel; the per-id action already handles optimistic + rollback.
    await Promise.all(ids.map((id) => get().connect(id).catch(() => undefined)));
  },

  disconnectMany: async (ids) => {
    await Promise.all(ids.map((id) => get().disconnect(id).catch(() => undefined)));
  },
}));

function messageFromError(e: unknown): string {
  // CH-427: the server's message in the language chosen in the app.
  return friendlyErrorMessage(e);
}

/**
 * Partner settings (buyer AND publisher), saved on the server.
 *
 * Backed by the backend's partner settings endpoints:
 *   GET   /api/accounts/partner-permissions             the catalogue: every
 *         permission and report column the backend supports
 *   GET   /api/accounts/{buyer|publisher}/{id}/settings
 *   PATCH /api/accounts/{buyer|publisher}/{id}/settings
 *         { permissions?: {...}, visible_report_columns?: [...] }
 *
 * This is the field the partner's OWN login reads (`visible_report_columns`
 * on /me). Before, the publisher page saved its checkboxes in the browser
 * only and the buyer page saved them in a temporary server cache, so
 * unchecking a column never reached the partner's login.
 *
 * The checkbox list comes from the catalogue, so every box on screen is one
 * the backend can save. When the backend adds a column (e.g. TCL), it shows
 * up here by itself.
 */

"use client";

import { create } from "zustand";

import { http } from "@/lib/api/http";

export type PartnerKind = "buyer" | "publisher";

export interface CatalogueItem {
  /** Backend key, snake_case (e.g. "not_connected", "download_reports"). */
  key: string;
  label: string;
  description: string;
  default: boolean;
}

export interface PartnerCatalogue {
  permissions: CatalogueItem[];
  reportColumns: CatalogueItem[];
}

export interface PartnerSettings {
  /** Keyed by the backend's snake_case permission key. */
  permissions: Record<string, boolean>;
  /** Backend column keys this partner's login may see. */
  visibleColumns: string[];
}

/** What the backend supported when this was written; used only if the catalogue can't be read. */
const FALLBACK_CATALOGUE: PartnerCatalogue = {
  permissions: [
    { key: "manage_traffic", label: "Manage Traffic", description: "Users can effectively manage and optimize traffic.", default: false },
    { key: "number_creation", label: "Number Creation", description: "Users can purchase a new number within the system.", default: false },
    { key: "audio_recording", label: "Audio Recording", description: "It provides users with the ability to view call recordings.", default: false },
    { key: "block_numbers", label: "Block Numbers", description: "Reject calls from specific phone numbers.", default: false },
    { key: "download_reports", label: "Download Reports", description: "Users can download reports about their call activity.", default: true },
  ],
  reportColumns: [
    { key: "incoming", label: "Incoming", description: "Total inbound call attempts.", default: true },
    { key: "connected", label: "Connected", description: "Calls that reached a destination.", default: true },
    { key: "qualified", label: "Qualified", description: "Calls that met the buyer's quality criteria.", default: true },
    { key: "converted", label: "Converted", description: "Calls that converted into a paid event.", default: true },
    { key: "duplicate", label: "Duplicate", description: "Repeat callers inside the duplicate window.", default: true },
    { key: "duration", label: "Duration", description: "Time connected, excluding ring time.", default: true },
    { key: "payout", label: "Payout", description: "What this partner is paid.", default: true },
    { key: "revenue", label: "Revenue", description: "What the call was sold for.", default: false },
  ],
};

/** "manageTraffic" -> "manage_traffic" (the http layer camel-cases object keys on the way in). */
const toSnake = (k: string) => k.replace(/([A-Z])/g, (_, c: string) => "_" + c.toLowerCase());

type CatalogueWire = {
  permissions?: Array<Partial<CatalogueItem>>;
  reportColumns?: Array<Partial<CatalogueItem>>;
};
type SettingsWire = {
  permissions?: Record<string, boolean> | null;
  visibleReportColumns?: string[] | null;
};

function itemsFromWire(list: Array<Partial<CatalogueItem>> | undefined, fallback: CatalogueItem[]): CatalogueItem[] {
  if (!Array.isArray(list) || list.length === 0) return fallback;
  return list
    .filter((i) => typeof i?.key === "string" && i.key)
    .map((i) => ({
      key: String(i.key),
      label: String(i.label ?? i.key),
      description: String(i.description ?? ""),
      default: i.default === true,
    }));
}

function settingsFromWire(w: SettingsWire | null | undefined): PartnerSettings {
  const permissions: Record<string, boolean> = {};
  for (const [k, v] of Object.entries(w?.permissions ?? {})) permissions[toSnake(k)] = v === true;
  return {
    permissions,
    visibleColumns: Array.isArray(w?.visibleReportColumns) ? w!.visibleReportColumns!.map(String) : [],
  };
}

const keyOf = (kind: PartnerKind, id: string) => `${kind}:${id}`;

interface Store {
  catalogue: PartnerCatalogue | null;
  byPartner: Record<string, PartnerSettings>;
  /** "error" when the server could not be read for this partner. */
  status: Record<string, "loading" | "ok" | "error">;

  fetchCatalogue: () => Promise<PartnerCatalogue>;
  fetchSettings: (kind: PartnerKind, id: string) => Promise<void>;
  /** Show / hide one report column for this partner's login. Saves at once. */
  toggleColumn: (kind: PartnerKind, id: string, columnKey: string) => Promise<void>;
  /** Switch one permission for this partner's login. Saves at once. */
  togglePermission: (kind: PartnerKind, id: string, permissionKey: string) => Promise<void>;
}

let cataloguePromise: Promise<PartnerCatalogue> | null = null;

export const usePartnerSettingsStore = create<Store>()((set, get) => {
  /** Change on screen at once, save, and put it back if the server refuses. */
  const save = async (kind: PartnerKind, id: string, next: PartnerSettings, body: Record<string, unknown>) => {
    const k = keyOf(kind, id);
    const prev = get().byPartner[k];
    set((s) => ({ byPartner: { ...s.byPartner, [k]: next } }));
    try {
      const w = await http.patch<SettingsWire>(`/api/accounts/${kind}/${id}/settings`, { body });
      set((s) => ({
        byPartner: { ...s.byPartner, [k]: settingsFromWire(w) },
        status: { ...s.status, [k]: "ok" },
      }));
    } catch (e) {
      set((s) => ({ byPartner: prev ? { ...s.byPartner, [k]: prev } : s.byPartner }));
      throw e;
    }
  };

  return {
    catalogue: null,
    byPartner: {},
    status: {},

    fetchCatalogue: async () => {
      const have = get().catalogue;
      if (have) return have;
      if (!cataloguePromise) {
        cataloguePromise = http
          .get<CatalogueWire>("/api/accounts/partner-permissions")
          .then((w) => ({
            permissions: itemsFromWire(w?.permissions, FALLBACK_CATALOGUE.permissions),
            reportColumns: itemsFromWire(w?.reportColumns, FALLBACK_CATALOGUE.reportColumns),
          }))
          .catch(() => {
            cataloguePromise = null; // try again next time
            return FALLBACK_CATALOGUE;
          });
      }
      const cat = await cataloguePromise;
      set({ catalogue: cat });
      return cat;
    },

    fetchSettings: async (kind, id) => {
      const k = keyOf(kind, id);
      set((s) => ({ status: { ...s.status, [k]: s.byPartner[k] ? s.status[k] ?? "ok" : "loading" } }));
      try {
        const w = await http.get<SettingsWire>(`/api/accounts/${kind}/${id}/settings`);
        set((s) => ({
          byPartner: { ...s.byPartner, [k]: settingsFromWire(w) },
          status: { ...s.status, [k]: "ok" },
        }));
      } catch {
        set((s) => ({ status: { ...s.status, [k]: "error" } }));
      }
    },

    toggleColumn: async (kind, id, columnKey) => {
      const cat = get().catalogue ?? FALLBACK_CATALOGUE;
      const cur = get().byPartner[keyOf(kind, id)] ?? { permissions: {}, visibleColumns: [] };
      const on = new Set(cur.visibleColumns);
      if (on.has(columnKey)) on.delete(columnKey);
      else on.add(columnKey);
      // In the catalogue's order, so the list reads the same every time.
      const visibleColumns = cat.reportColumns.map((c) => c.key).filter((c) => on.has(c));
      await save(kind, id, { ...cur, visibleColumns }, { visibleReportColumns: visibleColumns });
    },

    togglePermission: async (kind, id, permissionKey) => {
      const cat = get().catalogue ?? FALLBACK_CATALOGUE;
      const cur = get().byPartner[keyOf(kind, id)] ?? { permissions: {}, visibleColumns: [] };
      // The server fills anything not sent with its default, so send them all.
      const permissions: Record<string, boolean> = {};
      for (const p of cat.permissions) permissions[p.key] = cur.permissions[p.key] ?? p.default;
      permissions[permissionKey] = !permissions[permissionKey];
      // Keys go out as written: the http layer would snake-case camelCase keys,
      // and these are already snake_case.
      await save(kind, id, { ...cur, permissions }, { permissions });
    },
  };
});

export function partnerKey(kind: PartnerKind, id: string) {
  return keyOf(kind, id);
}

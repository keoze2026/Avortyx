/** Persistent + ephemeral UI state: sidebar, command palette, breadcrumb overrides. */

"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

import { DEFAULT_DISPLAY_TIMEZONE } from "@/lib/timezones";

interface UIState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  setSidebar: (collapsed: boolean) => void;

  /**
   * IANA timezone every reporting surface renders call timestamps in —
   * driven by the Reports toolbar picker and shared with the Dashboard so
   * the two never disagree. Persisted: an operator picks their zone once.
   */
  reportTimezone: string;
  setReportTimezone: (iana: string) => void;

  commandOpen: boolean;
  setCommandOpen: (open: boolean) => void;

  /**
   * Per-path breadcrumb label overrides. Pages can register a label
   * (e.g. a campaign name for `/campaigns/c_xyz`) so the breadcrumb is human-readable.
   * Ephemeral — not persisted.
   */
  breadcrumbOverrides: Record<string, string>;
  setBreadcrumbOverride: (path: string, label: string) => void;
  clearBreadcrumbOverride: (path: string) => void;
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebar: (collapsed) => set({ sidebarCollapsed: collapsed }),

      reportTimezone: DEFAULT_DISPLAY_TIMEZONE,
      setReportTimezone: (iana) => set({ reportTimezone: iana }),

      commandOpen: false,
      setCommandOpen: (open) => set({ commandOpen: open }),

      breadcrumbOverrides: {},
      setBreadcrumbOverride: (path, label) =>
        set((s) => ({ breadcrumbOverrides: { ...s.breadcrumbOverrides, [path]: label } })),
      clearBreadcrumbOverride: (path) =>
        set((s) => {
          const next = { ...s.breadcrumbOverrides };
          delete next[path];
          return { breadcrumbOverrides: next };
        }),
    }),
    {
      name: "vortyx.ui",
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({
        sidebarCollapsed: s.sidebarCollapsed,
        reportTimezone: s.reportTimezone,
      }),
    },
  ),
);

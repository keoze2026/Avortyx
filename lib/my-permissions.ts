/**
 * What the signed-in EMPLOYEE may do, from their Workspace role.
 *
 * The backend sends the effective permissions of the user's role on
 * /api/accounts/me as `permissions`: dotted strings matching the Roles screen,
 * e.g. ["reporting.view", "reporting.download", "campaigns.view", ...].
 *
 * Rules (same as the Roles screen):
 *   - an area with nothing ticked  -> the area is hidden completely
 *   - an area with "view" only     -> can look, cannot change
 *   - each other tick (edit, delete, download, ...) allows just that action
 *
 * Until the backend sends `permissions`, nothing is limited here (the app
 * behaves exactly as before). Buyers and publishers are not affected: their
 * access comes from Buyer / Publisher Access, not from Workspace roles.
 */

"use client";

import * as React from "react";
import { create } from "zustand";

import { http } from "@/lib/api/http";
import { ROUTES } from "@/lib/constants";
import { useAuthStore } from "@/lib/store/auth-store";

/** Which Roles-screen area each portal page belongs to. */
const PAGE_AREA: Array<[prefix: string, area: string]> = [
  [ROUTES.reports, "reporting"],
  [ROUTES.calls, "reporting"],
  [ROUTES.campaigns, "campaigns"],
  [ROUTES.numbers, "tracking-numbers"],
  [ROUTES.routing, "call-flows"],
  [ROUTES.ivr, "call-flows"],
  [ROUTES.queue, "call-flows"],
  [ROUTES.destinations, "destinations"],
  [ROUTES.buyers, "buyers"],
  [ROUTES.publishers, "traffic-sources"],
  [ROUTES.voipShield, "voip-shield"],
  [ROUTES.tcpaShield, "tcpa-shield"],
  [ROUTES.blockedNumbers, "blocked-numbers"],
  [ROUTES.billing, "billing"],
  [ROUTES.integrations, "integrations"],
  [ROUTES.marketplace, "integrations"],
];

export function areaForPath(pathname: string): string | null {
  for (const [prefix, area] of PAGE_AREA) {
    if (pathname === prefix || pathname.startsWith(prefix + "/")) return area;
  }
  return null;
}

interface State {
  /** null = no limits known (backend not sending them yet, or an admin). */
  permissions: Set<string> | null;
  /** The raw role from /me ("admin", "manager", "viewer", a custom role id...). */
  rawRole: string | null;
  loadedFor: string | null;
  load: (userId: string) => Promise<void>;
}

export const useMyPermissions = create<State>()((set, get) => ({
  permissions: null,
  rawRole: null,
  loadedFor: null,
  load: async (userId) => {
    if (get().loadedFor === userId) return;
    set({ loadedFor: userId });
    try {
      const me = await http.get<{ role?: string; permissions?: unknown }>("/api/accounts/me");
      const list = Array.isArray(me?.permissions) ? me.permissions.map(String) : null;
      set({ permissions: list ? new Set(list) : null, rawRole: me?.role ?? null });
    } catch {
      set({ loadedFor: null }); // try again next time
    }
  },
}));

/** Load once per signed-in user; returns helpers. */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const permissions = useMyPermissions((s) => s.permissions);
  const rawRole = useMyPermissions((s) => s.rawRole);
  const load = useMyPermissions((s) => s.load);
  const isStaff = !!user && user.role !== "buyer" && user.role !== "publisher";

  React.useEffect(() => {
    if (user?.id && isStaff) void load(user.id);
  }, [user?.id, isStaff, load]);

  return React.useMemo(() => {
    const limited = isStaff && permissions !== null && rawRole !== "admin";
    /** May this employee do `action` in `area`? (Always true when not limited.) */
    const can = (area: string, action = "view") => !limited || permissions!.has(`${area}.${action}`);
    /** May this employee see this page at all? (Area with nothing ticked = no.) */
    const canSeePath = (pathname: string) => {
      if (!limited) return true;
      if (pathname === ROUTES.workspace || pathname.startsWith(ROUTES.workspace + "/")) return false;
      const area = areaForPath(pathname);
      if (!area) return true;
      // Nothing ticked in the area, or View unticked: the page is not theirs.
      return permissions!.has(`${area}.view`);
    };
    return { limited, can, canSeePath };
  }, [isStaff, permissions, rawRole]);
}

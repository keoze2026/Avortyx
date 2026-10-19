/**
 * Permission catalog for the Setup Role page.
 *
 * Each group represents a product surface (Reporting, Campaigns, …) and
 * the inner permissions are the discrete capabilities that can be toggled
 * on or off for a role.
 *
 * The full set produces a state shape of:
 *   Record<groupId, Record<permissionId, boolean>>
 */

export interface Permission {
  id: string;
  label: string;
}

export interface PermissionGroup {
  id: string;
  label: string;
  permissions: Permission[];
}

/** Areas whose screens do not exist in the portal yet. Their ticks are saved
 *  but there is nothing for them to switch on or off, so the Roles screen says so. */
export const INACTIVE_GROUPS: ReadonlySet<string> = new Set([
  "groups",
  "ping-post-log",
  "leads",
  "custom-parameters",
  "dispute",
  "global-offers",
]);

export const PERMISSION_GROUPS: PermissionGroup[] = [
  {
    id: "reporting",
    label: "Reporting",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "listen", label: "Listen to Recordings" },
      { id: "download", label: "Download Reports" },
    ],
  },
  {
    id: "campaigns",
    label: "Campaigns",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit-campaign", label: "Edit Campaign data" },
      { id: "edit-numbers", label: "Edit Tracking Numbers" },
      { id: "edit-forward", label: "Edit Forward Calls To" },
      { id: "edit-advanced", label: "Edit Advanced Settings" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "call-flows",
    label: "Call Flows",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "tracking-numbers",
    label: "Tracking Numbers",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "number-pools",
    label: "Number Pools",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "destinations",
    label: "Manage Destinations",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "groups",
    label: "Manage Groups",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "ping-post-log",
    label: "Ping/Post Log",
    permissions: [{ id: "view", label: "View" }],
  },
  {
    id: "rtb-bid-log",
    label: "Rtb Bid Log",
    permissions: [{ id: "view", label: "View" }],
  },
  {
    id: "buyers",
    label: "Buyers",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "vendors",
    label: "Vendors",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "traffic-sources",
    label: "Traffic Sources",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "integrations",
    label: "Integrations",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "leads",
    label: "Manage Leads",
    permissions: [
      { id: "view", label: "View" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "custom-parameters",
    label: "Custom Parameters",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "voip-shield",
    label: "VoIP Shield",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "dispute",
    label: "Dispute",
    permissions: [{ id: "view", label: "View" }],
  },
  {
    id: "tcpa-shield",
    label: "TCPA Shield",
    permissions: [{ id: "view", label: "View" }],
  },
  {
    id: "billing",
    label: "Billing",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
    ],
  },
  {
    id: "blocked-numbers",
    label: "Blocked Numbers",
    permissions: [
      { id: "view", label: "View" },
      { id: "edit", label: "Edit" },
      { id: "delete", label: "Delete" },
    ],
  },
  {
    id: "global-offers",
    label: "Global Offers",
    permissions: [{ id: "view", label: "View" }],
  },
];

export type PermissionState = Record<string, Record<string, boolean>>;

/** Total number of discrete permission toggles across every group. */
export const TOTAL_PERMISSIONS = PERMISSION_GROUPS.reduce(
  (n, g) => n + g.permissions.length,
  0,
);

/** Count how many permissions are enabled in a given state. */
export function countEnabledPermissions(state: PermissionState): number {
  let n = 0;
  for (const g of PERMISSION_GROUPS) {
    const groupState = state[g.id] ?? {};
    for (const p of g.permissions) if (groupState[p.id]) n += 1;
  }
  return n;
}

/** Build a default state — all permissions off. */
export function emptyPermissions(): PermissionState {
  const state: PermissionState = {};
  for (const group of PERMISSION_GROUPS) {
    state[group.id] = {};
    for (const p of group.permissions) state[group.id][p.id] = false;
  }
  return state;
}

/** Everything on — used as the admin seed. */
export function allPermissions(): PermissionState {
  const state: PermissionState = {};
  for (const group of PERMISSION_GROUPS) {
    state[group.id] = {};
    for (const p of group.permissions) state[group.id][p.id] = true;
  }
  return state;
}

/** View-only across every group that exposes a "view" permission. */
export function viewerPermissions(): PermissionState {
  const state = emptyPermissions();
  for (const g of PERMISSION_GROUPS) {
    if (g.permissions.some((p) => p.id === "view")) state[g.id].view = true;
  }
  return state;
}

/**
 * Seed the permission state for a built-in role slug.
 * Kept here so both the Setup Role form and the Roles table show consistent counts.
 */
export function seedForRole(roleId: string): PermissionState {
  const normalized = roleId.toLowerCase();
  if (normalized === "admin") return allPermissions();
  if (normalized === "viewer") return viewerPermissions();
  return defaultManagerRestrictedPermissions();
}

/** Reasonable "Manager Restricted"-style defaults inspired by the reference. */
export function defaultManagerRestrictedPermissions(): PermissionState {
  const state = emptyPermissions();
  // Reporting — full
  state.reporting = { view: true, edit: true, listen: true, download: true };
  // Campaigns — edit campaign + forward, no advanced/delete
  state.campaigns = {
    view: true,
    "edit-campaign": true,
    "edit-numbers": false,
    "edit-forward": true,
    "edit-advanced": true,
    delete: false,
  };
  // View-only baselines for most resource groups
  for (const id of [
    "call-flows",
    "tracking-numbers",
    "number-pools",
    "destinations",
    "groups",
    "buyers",
    "vendors",
    "traffic-sources",
    "integrations",
    "custom-parameters",
    "voip-shield",
    "blocked-numbers",
  ]) {
    state[id] = { view: true, edit: true, delete: false };
  }
  // Log surfaces
  state["ping-post-log"] = { view: true };
  state.leads = { view: true, delete: false };
  state.billing = { view: true, edit: false };
  return state;
}

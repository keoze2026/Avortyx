/**
 * Mock workspace activity feed. Records who did what — invited / removed
 * members, changed roles, edited a role's permissions, updated workspace
 * settings. Powers the Activity log card in Workspace settings.
 */

import type { MemberRole } from "@/lib/types";

const MIN = 1000 * 60;
const HOUR = 1000 * 60 * 60;
const DAY = 1000 * 60 * 60 * 24;

/** "record" = a change to a campaign, buyer, destination, number, ...;
 *  "account" = sign-ins, sign-outs, passwords, 2FA, API keys. */
export type ActivityCategory = "member" | "role" | "settings" | "record" | "account";

export type ActivityKind =
  /** member events */
  | "member.invited"
  | "member.joined"
  | "member.removed"
  | "member.suspended"
  | "member.reactivated"
  | "member.role-changed"
  /** role events */
  | "role.permissions-updated"
  /** workspace settings events */
  | "workspace.renamed"
  | "workspace.timezone-changed"
  /** a record (campaign, buyer, destination, number, ...) was created / edited / deleted */
  | "record.created"
  | "record.updated"
  | "record.deleted"
  /** account events */
  | "account.login"
  | "account.logout"
  | "account.security"
  | "account.other";

/** One field of an edit: its value before and after. null = empty. */
export interface ActivityChange {
  field: string;
  old: string | null;
  new: string | null;
}

export interface WorkspaceActivityEvent {
  id: string;
  kind: ActivityKind;
  category: ActivityCategory;
  timestamp: number;
  /** Person who performed the action. */
  actor: {
    name: string;
    initials: string;
    avatar: [string, string];
  };
  /** What the action acted on — member name, role name, setting label. */
  target?: string;
  /** Short "from → to" or "+N / -N" string for the table's Detail column. */
  detail?: string;
  /** Member role change events carry the role pair for richer rendering. */
  rolePair?: { from: MemberRole; to: MemberRole };
  /** The server's own wording for the action, e.g. "Updated", "Login". */
  actionLabel?: string;
  /** What kind of record it was, as the server names it, e.g. "campaign_destination". */
  targetType?: string;
  /** For an edit: each field that changed, with old and new value. Empty on
   *  creates and deletes (there is no previous value). */
  changes?: ActivityChange[];
}

const AVERY: WorkspaceActivityEvent["actor"] = {
  name: "Avery Quinn",
  initials: "AQ",
  avatar: ["#00e6b8", "#1656d6"],
};
const MORGAN: WorkspaceActivityEvent["actor"] = {
  name: "Morgan Reed",
  initials: "MR",
  avatar: ["#22d3ee", "#1656d6"],
};
const PRIYA: WorkspaceActivityEvent["actor"] = {
  name: "Priya Desai",
  initials: "PD",
  avatar: ["#a855f7", "#1656d6"],
};

export const MOCK_WORKSPACE_ACTIVITY: WorkspaceActivityEvent[] = [
  {
    id: "a_001",
    kind: "member.invited",
    category: "member",
    timestamp: Date.now() - MIN * 24,
    actor: AVERY,
    target: "devon@avortyx.io",
    detail: "as Viewer",
  },
  {
    id: "a_002",
    kind: "role.permissions-updated",
    category: "role",
    timestamp: Date.now() - HOUR * 2,
    actor: AVERY,
    target: "Manager",
    detail: "+2 permissions",
  },
  {
    id: "a_003",
    kind: "member.role-changed",
    category: "member",
    timestamp: Date.now() - HOUR * 5,
    actor: MORGAN,
    target: "Priya Desai",
    rolePair: { from: "viewer", to: "buyer" },
  },
  {
    id: "a_004",
    kind: "workspace.timezone-changed",
    category: "settings",
    timestamp: Date.now() - HOUR * 8,
    actor: AVERY,
    target: "Default timezone",
    detail: "America/New_York → America/Los_Angeles",
  },
  {
    id: "a_005",
    kind: "member.suspended",
    category: "member",
    timestamp: Date.now() - DAY * 1 - HOUR * 3,
    actor: AVERY,
    target: "Hana Becker",
  },
  {
    id: "a_006",
    kind: "member.joined",
    category: "member",
    timestamp: Date.now() - DAY * 2,
    actor: PRIYA,
    target: "Priya Desai",
  },
  {
    id: "a_007",
    kind: "role.permissions-updated",
    category: "role",
    timestamp: Date.now() - DAY * 2 - HOUR * 6,
    actor: AVERY,
    target: "Buyer",
    detail: "-1 permission",
  },
  {
    id: "a_008",
    kind: "workspace.renamed",
    category: "settings",
    timestamp: Date.now() - DAY * 4,
    actor: AVERY,
    target: "Workspace name",
    detail: "Avortyx Demo → Avortyx Demo Co.",
  },
  {
    id: "a_009",
    kind: "member.role-changed",
    category: "member",
    timestamp: Date.now() - DAY * 6,
    actor: AVERY,
    target: "Morgan Reed",
    rolePair: { from: "buyer", to: "manager" },
  },
  {
    id: "a_010",
    kind: "member.removed",
    category: "member",
    timestamp: Date.now() - DAY * 8,
    actor: AVERY,
    target: "kai@avortyx.io",
  },
  {
    id: "a_011",
    kind: "member.invited",
    category: "member",
    timestamp: Date.now() - DAY * 12,
    actor: MORGAN,
    target: "riley@avortyx.io",
    detail: "as Publisher",
  },
  {
    id: "a_012",
    kind: "member.reactivated",
    category: "member",
    timestamp: Date.now() - DAY * 18,
    actor: AVERY,
    target: "Jordan Cole",
  },
];

/** Short verb phrase rendered in the Action column. */
export const ACTIVITY_VERBS: Record<ActivityKind, string> = {
  "member.invited": "invited",
  "member.joined": "joined the workspace",
  "member.removed": "removed",
  "member.suspended": "suspended",
  "member.reactivated": "reactivated",
  "member.role-changed": "changed role for",
  "role.permissions-updated": "updated permissions for",
  "workspace.renamed": "updated",
  "workspace.timezone-changed": "updated",
  "record.created": "created",
  "record.updated": "updated",
  "record.deleted": "deleted",
  "account.login": "signed in",
  "account.logout": "signed out",
  "account.security": "changed security settings",
  "account.other": "changed",
};
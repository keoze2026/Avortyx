/** Settings-module types. */

import type { Role } from "./auth";

/**
 * Member roles — must match the backend enum at
 * PATCH /api/accounts/workspace/members/{user_id}/role:
 *   admin / manager / agent / buyer / publisher / viewer
 */
export type MemberRole = Role | "manager" | "agent" | "viewer";

/**
 * Member status — backend collapses pending invites into `active`, so the
 * status enum is just `active | suspended`. (`invited` was removed when the
 * workspace endpoints shipped — invited users appear in /members as active
 * immediately.)
 */
export type MemberStatus = "active" | "suspended";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: MemberRole;
  /** Initials + a gradient pair used by the avatar */
  initials: string;
  avatar: [string, string];
  status: MemberStatus;
  invitedAt: number;
  joinedAt?: number;
  lastActiveAt?: number;
}

export type ApiScope = "read" | "write" | "admin";

export interface ApiKey {
  id: string;
  name: string;
  /** What we show in the UI — the rest of the token is hashed */
  prefix: string;
  scopes: ApiScope[];
  createdAt: number;
  lastUsedAt?: number;
  createdByName: string;
}

export interface DeviceSession {
  id: string;
  device: string;
  browser: string;
  ip: string;
  city?: string;
  current: boolean;
  lastActiveAt: number;
  /** Whose sign-in it is - the workspace admin sees everyone's (CH-266). */
  userId?: string;
  userName?: string;
}

export interface NotificationPref {
  key: string;
  label: string;
  description: string;
  email: boolean;
  inApp: boolean;
  sms: boolean;
}

/** A capability that can be toggled per role in the permission matrix. */
export interface Capability {
  key: string;
  label: string;
  description: string;
}

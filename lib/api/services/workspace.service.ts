/**
 * Workspace service — /api/accounts/workspace/*.
 *
 * Endpoints (confirmed by backend dev, June 2026):
 *   GET    /api/accounts/workspace
 *   PATCH  /api/accounts/workspace
 *   GET    /api/accounts/workspace/members
 *   POST   /api/accounts/workspace/members/invite          body: { email, role }
 *   DELETE /api/accounts/workspace/members/{user_id}
 *   PATCH  /api/accounts/workspace/members/{user_id}/role  body: { role?, status? }
 *
 * Invited members appear in the members list immediately with status `active`
 * — there is no separate invite lifecycle. Role + status share one PATCH
 * endpoint (the dev consolidated suspend onto the same route).
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";
import type { Member, MemberRole, MemberStatus } from "@/lib/types";

/* ─── Frontend shapes ─────────────────────────────────────────────────── */

export interface Workspace {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: number;
  /** Optional — backend dev can add `member_count` and `plan_tier` later. */
  memberCount?: number;
  planTier?: string;
}

/* ─── Wire shapes (post case-adapter) ─────────────────────────────────── */

interface WorkspaceWire {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  createdAt: string;
  memberCount?: number;
  planTier?: string;
}

interface MemberWire {
  id: string;
  /** Backend may use `userId` rather than `id` — accept both. */
  userId?: string;
  name?: string;
  email: string;
  role: string;
  status?: string;
  invitedAt?: string;
  joinedAt?: string | null;
  lastActiveAt?: string | null;
}

/* ─── Helpers ─────────────────────────────────────────────────────────── */

function toTs(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : undefined;
}

function normalizeRole(raw: string | null | undefined): MemberRole {
  const r = (raw ?? "").toLowerCase();
  if (r === "admin" || r === "manager" || r === "agent" || r === "buyer" ||
      r === "publisher" || r === "viewer") return r;
  return "viewer";
}

function normalizeStatus(raw?: string): MemberStatus {
  return (raw ?? "").toLowerCase() === "suspended" ? "suspended" : "active";
}

/** Hash a string into a deterministic 0..2π — used to pick a stable avatar
 *  gradient for each member id so portraits don't flip between renders. */
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return ((h % 360) + 360) % 360;
}

function pickAvatarGradient(seed: string): [string, string] {
  const a = hashHue(seed);
  const b = (a + 40) % 360;
  return [`oklch(0.68 0.16 ${a})`, `oklch(0.58 0.20 ${b})`];
}

function initialsFrom(name: string, email: string): string {
  const parts = (name || email.split("@")[0] || "?").trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function wireToMember(w: MemberWire): Member {
  const id = w.userId ?? w.id;
  const name = w.name?.trim() || w.email.split("@")[0];
  return {
    id,
    name,
    email: w.email,
    role: normalizeRole(w.role),
    initials: initialsFrom(name, w.email),
    avatar: pickAvatarGradient(id),
    status: normalizeStatus(w.status),
    invitedAt: toTs(w.invitedAt) ?? Date.now(),
    joinedAt: toTs(w.joinedAt),
    lastActiveAt: toTs(w.lastActiveAt),
  };
}

function wireToWorkspace(w: WorkspaceWire): Workspace {
  return {
    id: w.id,
    name: w.name,
    slug: w.slug,
    isActive: !!w.isActive,
    createdAt: toTs(w.createdAt) ?? Date.now(),
    memberCount: w.memberCount,
    planTier: w.planTier,
  };
}

/* ─── Public service ──────────────────────────────────────────────────── */

export const workspaceService = {
  async get(): Promise<Workspace> {
    return wireToWorkspace(await http.get<WorkspaceWire>("/api/accounts/workspace"));
  },

  async update(patch: { name?: string; slug?: string }): Promise<Workspace> {
    return wireToWorkspace(
      await http.patch<WorkspaceWire>("/api/accounts/workspace", { body: patch }),
    );
  },

  async listMembers(): Promise<Member[]> {
    // Backend may wrap in a paginated envelope; handle both shapes.
    const res = await http.get<MemberWire[] | { items?: MemberWire[] }>(
      "/api/accounts/workspace/members",
    );
    const items = Array.isArray(res) ? res : (res.items ?? []);
    return items.map(wireToMember);
  },

  async invite(input: { email: string; role: MemberRole }): Promise<Member> {
    const wire = await http.post<MemberWire>("/api/accounts/workspace/members/invite", {
      body: { email: input.email, role: input.role },
    });
    return wireToMember(wire);
  },

  async updateMember(userId: string, patch: { role?: MemberRole; status?: MemberStatus }): Promise<Member> {
    const wire = await http.patch<MemberWire>(
      `/api/accounts/workspace/members/${userId}/role`,
      { body: patch },
    );
    return wireToMember(wire);
  },

  async remove(userId: string): Promise<void> {
    await http.delete(`/api/accounts/workspace/members/${userId}`);
  },

  /* ─── Activity log / sessions / role catalog ──────────────────────────── */
  async listActivity(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<WorkspaceActivityWire>> {
    const res = await http.get<Paginated<WorkspaceActivityWire>>(
      "/api/accounts/workspace/activity",
      { query },
    );
    return res;
  },

  async listSessions(): Promise<WorkspaceSessionWire[]> {
    const res = await http.get<WorkspaceSessionWire[] | { items?: WorkspaceSessionWire[] }>(
      "/api/accounts/workspace/sessions",
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  async revokeSession(sessionId: string): Promise<void> {
    await http.delete(`/api/accounts/workspace/sessions/${sessionId}`);
  },

  async listRoles(): Promise<WorkspaceRoleWire[]> {
    const res = await http.get<WorkspaceRoleWire[] | { items?: WorkspaceRoleWire[] }>(
      "/api/accounts/roles",
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  /* ─── Custom workspace roles (new endpoints) ─────────────────────────── */

  async listWorkspaceRoles(): Promise<WorkspaceRoleWire[]> {
    const res = await http.get<WorkspaceRoleWire[] | { items?: WorkspaceRoleWire[] }>(
      "/api/accounts/workspace/roles",
    );
    return Array.isArray(res) ? res : (res.items ?? []);
  },

  async createWorkspaceRole(input: {
    name: string;
    description: string;
    capabilities: string[];
  }): Promise<WorkspaceRoleWire> {
    return http.post<WorkspaceRoleWire>("/api/accounts/workspace/roles", { body: input });
  },

  async updateWorkspaceRole(
    id: string,
    patch: { name?: string; description?: string; capabilities?: string[] },
  ): Promise<WorkspaceRoleWire> {
    return http.patch<WorkspaceRoleWire>(`/api/accounts/workspace/roles/${id}`, {
      body: patch,
    });
  },

  async deleteWorkspaceRole(id: string): Promise<void> {
    await http.delete(`/api/accounts/workspace/roles/${id}`);
  },
};

/* ─── Wire shapes for the activity / sessions / roles endpoints ─────────── */

export interface WorkspaceActivityWire {
  id: string;
  actorId: string;
  actorName: string;
  /** Code, e.g. "record_updated", "login", "password_change". */
  action: string;
  /** The server's readable form of `action`, e.g. "Updated". */
  actionLabel?: string;
  /** e.g. "campaign", "buyer", "destination", "campaign_destination". */
  targetType: string;
  targetId?: string;
  targetName?: string;
  /**
   * For an edit, each field that changed: { priority: { old: "3", new: "10" } }.
   * `{}` on creates and deletes. Never includes updated_at, password,
   * last_login or the live / hourly / daily call counters (the server leaves
   * those out on purpose).
   */
  changes?: Record<string, { old?: unknown; new?: unknown } | null>;
  ipAddress?: string | null;
  createdAt: string;
}

export interface WorkspaceSessionWire {
  id: string;
  userId: string;
  userName: string;
  ip: string;
  location?: string;
  userAgent: string;
  lastActiveAt: string;
  current: boolean;
}

export interface WorkspaceRoleWire {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  /** True for the six default roles (admin / manager / agent / buyer /
   *  publisher / viewer). Built-ins are read-only — editing or deleting
   *  them is disallowed by the backend. */
  isBuiltin?: boolean;
}
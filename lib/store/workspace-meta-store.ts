/**
 * Workspace meta store — activity log, sessions, and role catalog.
 *
 * Three small read-only resources surfaced on the Settings screens. We
 * bundle them in one store so a single fetch on app boot brings them all
 * online and the StoreHydrator doesn't have three near-identical entries.
 *
 *   GET    /api/accounts/workspace/activity?page=&page_size=
 *   GET    /api/accounts/workspace/sessions
 *   DELETE /api/accounts/workspace/sessions/{id}
 *   GET    /api/accounts/roles
 *
 * The wire types are normalized at the boundary so the existing settings
 * UIs keep rendering: activity events get mapped to ActivityKind +
 * ActivityCategory; session user-agents are parsed into device + browser
 * labels; role rows pass through with light validation.
 */

"use client";

import { create } from "zustand";

import {
  workspaceService,
  type WorkspaceActivityWire,
  type WorkspaceRoleWire,
  type WorkspaceSessionWire,
} from "@/lib/api/services/workspace.service";
import type {
  ActivityCategory,
  ActivityChange,
  ActivityKind,
  WorkspaceActivityEvent,
} from "@/lib/mock/workspace-activity";
import type { DeviceSession } from "@/lib/types";

export interface WorkspaceRole {
  id: string;
  name: string;
  description: string;
  capabilities: string[];
  /** Backend `is_builtin` — true for the six baked-in roles (admin /
   *  manager / agent / buyer / publisher / viewer). Built-ins are
   *  read-only on the workspace-roles endpoint. */
  isBuiltin: boolean;
}

interface WorkspaceMetaState {
  activity: WorkspaceActivityEvent[];
  sessions: DeviceSession[];
  roles: WorkspaceRole[];
  loading: boolean;
  error: string | null;
  hydrated: boolean;

  fetch: () => Promise<void>;
  /** Re-read only the activity feed (the Activity tab calls this when opened). */
  refreshActivity: () => Promise<void>;
  revokeSession: (sessionId: string) => Promise<void>;
}

/* ─── Wire ↔ FE mappers ─────────────────────────────────────────────────── */

function toTs(s: string | undefined): number {
  if (!s) return Date.now();
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : Date.now();
}

function initialsFrom(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function avatarGradientFor(seed: string): [string, string] {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const a = ((h % 360) + 360) % 360;
  const b = (a + 40) % 360;
  return [`oklch(0.68 0.16 ${a})`, `oklch(0.58 0.20 ${b})`];
}

/** The server's action codes (accounts.ActivityLog.Action). */
const EXACT_ACTIONS: Record<string, ActivityKind> = {
  record_created: "record.created",
  record_updated: "record.updated",
  record_deleted: "record.deleted",
  login: "account.login",
  logout: "account.logout",
  password_change: "account.security",
  mfa_enabled: "account.security",
  mfa_disabled: "account.security",
  api_key_created: "account.security",
  api_key_revoked: "account.security",
  profile_updated: "account.other",
  organization_created: "account.other",
};

/** Map the backend's `action` onto our ActivityKind. Exact server codes
 *  first; then older free-form wording. Anything unknown is shown with the
 *  server's own label ("account.other") - it used to fall back to "invited",
 *  which made every edit to a campaign or destination read as an invitation. */
function actionToKind(action: string): ActivityKind {
  const exact = EXACT_ACTIONS[action];
  if (exact) return exact;
  const a = action.toLowerCase();
  if (a.includes("invite")) return "member.invited";
  if (a.includes("join")) return "member.joined";
  if (a.includes("remove") && a.includes("member")) return "member.removed";
  if (a.includes("suspend")) return "member.suspended";
  if (a.includes("reactivate")) return "member.reactivated";
  if (a.includes("role") && a.includes("chang")) return "member.role-changed";
  if (a.includes("permission")) return "role.permissions-updated";
  if (a.includes("renam") && a.includes("workspace")) return "workspace.renamed";
  if (a.includes("timezone")) return "workspace.timezone-changed";
  return "account.other";
}

function kindToCategory(k: ActivityKind): ActivityCategory {
  if (k.startsWith("record.")) return "record";
  if (k.startsWith("account.")) return "account";
  if (k.startsWith("workspace.")) return "settings";
  if (k.startsWith("role.")) return "role";
  return "member";
}

/** A changed value as text. null / "" / Python's "None" = empty. */
function changeValue(v: unknown): string | null {
  if (v === null || v === undefined || v === "" || v === "None") return null;
  if (typeof v === "string") return v;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

/** { priority: { old: "3", new: "10" } } -> [{ field: "priority", old: "3", new: "10" }], by field name. */
function changesFrom(raw: WorkspaceActivityWire["changes"]): ActivityChange[] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];
  return Object.entries(raw)
    .map(([field, pair]) => {
      const p = pair && typeof pair === "object" ? (pair as { old?: unknown; new?: unknown }) : {};
      return { field, old: changeValue(p.old), new: changeValue(p.new) };
    })
    .sort((a, b) => a.field.localeCompare(b.field));
}

/** Record types that are about roles and permissions (shown under "Roles"). */
const ROLE_TARGET_TYPES = new Set(["role", "workspace_role", "custom_role", "permission", "role_permission", "membership"]);

function wireToActivity(w: WorkspaceActivityWire): WorkspaceActivityEvent {
  const kind = actionToKind(w.action);
  const changes = changesFrom(w.changes);
  // Role and permission edits belong under "Roles": edits to a role record, or
  // a user edit whose changed fields include the role.
  const isRoleEvent =
    kind.startsWith("record.") &&
    (ROLE_TARGET_TYPES.has((w.targetType ?? "").toLowerCase()) || changes.some((c) => /(^|_)role$/i.test(c.field)));
  const ua = w.userAgent ? parseUserAgent(w.userAgent) : null;
  return {
    id: w.id,
    kind,
    category: isRoleEvent ? "role" : kindToCategory(kind),
    timestamp: toTs(w.createdAt),
    actor: {
      name: w.actorName,
      initials: initialsFrom(w.actorName),
      avatar: avatarGradientFor(w.actorId),
    },
    target: w.targetName || undefined,
    actionLabel: w.actionLabel || undefined,
    targetType: w.targetType || undefined,
    changes,
    actionCode: w.action || undefined,
    ipAddress: w.ipAddress || undefined,
    client: ua ? `${ua.browser} · ${ua.device}` : undefined,
  };
}

/** Derive a friendly device / browser label from a User-Agent string. The
 *  parse is intentionally conservative — we only recognize common families
 *  and fall back to the raw UA for the device column when nothing matches. */
function parseUserAgent(ua: string): { device: string; browser: string } {
  const lower = ua.toLowerCase();
  let device = "Desktop";
  if (lower.includes("iphone")) device = "iPhone";
  else if (lower.includes("ipad")) device = "iPad";
  else if (lower.includes("android")) device = "Android";
  else if (lower.includes("mac")) device = "Mac";
  else if (lower.includes("windows")) device = "Windows";
  else if (lower.includes("linux")) device = "Linux";

  let browser = "Browser";
  if (lower.includes("edg/")) browser = "Edge";
  else if (lower.includes("chrome/")) browser = "Chrome";
  else if (lower.includes("safari/") && !lower.includes("chrome")) browser = "Safari";
  else if (lower.includes("firefox/")) browser = "Firefox";
  return { device, browser };
}

function wireToSession(w: WorkspaceSessionWire): DeviceSession {
  const { device, browser } = parseUserAgent(w.userAgent);
  return {
    id: w.id,
    device,
    browser,
    ip: w.ip,
    city: w.location,
    current: w.current,
    lastActiveAt: toTs(w.lastActiveAt),
  };
}

function wireToRole(w: WorkspaceRoleWire): WorkspaceRole {
  return {
    id: w.id,
    name: w.name,
    description: w.description,
    capabilities: Array.isArray(w.capabilities) ? w.capabilities : [],
    // Heuristic fallback for older deployments that don't ship the flag —
    // anything whose id matches a baked-in slug is a built-in.
    isBuiltin:
      typeof w.isBuiltin === "boolean"
        ? w.isBuiltin
        : ["admin", "manager", "agent", "buyer", "publisher", "viewer"].includes(
            w.id,
          ),
  };
}

/* ─── Store ─────────────────────────────────────────────────────────────── */

export const useWorkspaceMetaStore = create<WorkspaceMetaState>()((set, get) => ({
  activity: [],
  sessions: [],
  roles: [],
  loading: false,
  error: null,
  hydrated: false,

  fetch: async () => {
    set({ loading: true, error: null });
    try {
      const [activityPage, sessionsRes, rolesRes] = await Promise.all([
        workspaceService.listActivity({ page: 1, pageSize: 100 }).catch(() => null),
        workspaceService.listSessions().catch(() => [] as WorkspaceSessionWire[]),
        // Workspace-roles endpoint returns built-in + custom roles; fall back
        // to the legacy catalog-only endpoint for older deployments.
        workspaceService
          .listWorkspaceRoles()
          .catch(() => workspaceService.listRoles().catch(() => [] as WorkspaceRoleWire[])),
      ]);
      set({
        activity: (activityPage?.items ?? []).map(wireToActivity),
        sessions: sessionsRes.map(wireToSession),
        roles: rolesRes.map(wireToRole),
        loading: false,
        hydrated: true,
      });
    } catch (e) {
      set({ loading: false, error: messageFromError(e) });
    }
  },

  refreshActivity: async () => {
    try {
      const page = await workspaceService.listActivity({ page: 1, pageSize: 100 });
      set({ activity: (page?.items ?? []).map(wireToActivity) });
    } catch {
      // Keep what is on screen; the next refresh will try again.
    }
  },

  revokeSession: async (sessionId) => {
    const prev = get().sessions;
    set((s) => ({ sessions: s.sessions.filter((x) => x.id !== sessionId) }));
    try {
      await workspaceService.revokeSession(sessionId);
    } catch (e) {
      set({ sessions: prev, error: messageFromError(e) });
      throw e;
    }
  },
}));

function messageFromError(e: unknown): string {
  if (e instanceof Error) return e.message;
  return "Workspace meta request failed";
}
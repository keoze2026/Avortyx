"use client";

/**
 * What a BUYER or PUBLISHER login may do: the five Permissions toggles the
 * admin sets on the partner's edit page (Manage Traffic, Number Creation,
 * Audio Recording, Block Numbers, Download Reports).
 *
 * Admin / staff logins: everything is allowed, always.
 *
 * Where it comes from: the partner's own settings. The scoped /api/publishers
 * (or /api/buyers) list gives the partner login its own record, and
 * /api/accounts/{kind}/{id}/settings gives its `permissions` - the same
 * toggles the admin edits. (/api/accounts/me builds `capabilities` too, but
 * its response schema drops the field, so it never arrives.)
 *
 * Re-read each time a page using it opens (at most every 30 seconds), so a
 * toggle the admin changes shows without the partner logging out. While it is
 * loading nothing is allowed, so a switched-off button never flashes up. If it
 * can't be read at all, the backend's defaults apply (only Download Reports on).
 */

import * as React from "react";

import { http } from "@/lib/api/http";
import { usePermissions } from "@/lib/my-permissions";
import { useAuthStore } from "@/lib/store/auth-store";

export type PartnerPermissionKey =
  | "manage_traffic"
  | "number_creation"
  | "audio_recording"
  | "block_numbers"
  | "download_reports"
  | "tfn_test";

type Perms = Record<PartnerPermissionKey, boolean>;

/** The backend's defaults (accounts/partner_permissions.py), used if the settings can't be read. */
const DEFAULTS: Perms = {
  manage_traffic: false,
  number_creation: false,
  audio_recording: false,
  block_numbers: false,
  download_reports: true,
  tfn_test: false,
};
const NOTHING: Perms = {
  manage_traffic: false,
  number_creation: false,
  audio_recording: false,
  block_numbers: false,
  download_reports: false,
  tfn_test: false,
};

const REFRESH_MS = 30_000;

type Cached = { userId: string; at: number; perms: Perms };
let cached: Cached | null = null;
let inflight: { userId: string; promise: Promise<Perms | null> } | null = null;

/** "audioRecording" -> "audio_recording" (the http layer camel-cases object keys on the way in). */
const toSnake = (k: string) => k.replace(/([A-Z])/g, (_, c: string) => "_" + c.toLowerCase());

/** The partner login's own buyer / publisher id, from the list the backend scopes to it. */
async function ownPartnerId(kind: "buyer" | "publisher"): Promise<string | null> {
  const res = await http.get<unknown>(`/api/${kind}s?page=1&page_size=5`);
  const rows = Array.isArray(res)
    ? res
    : ((res as { items?: unknown[]; results?: unknown[] } | null)?.items ??
       (res as { results?: unknown[] } | null)?.results ??
       []);
  const first = rows[0] as { id?: unknown } | undefined;
  return first?.id ? String(first.id) : null;
}

async function readPerms(kind: "buyer" | "publisher"): Promise<Perms | null> {
  try {
    const id = await ownPartnerId(kind);
    if (!id) return null;
    const s = await http.get<{ permissions?: Record<string, unknown> }>(`/api/accounts/${kind}/${id}/settings`);
    if (!s?.permissions || typeof s.permissions !== "object") return null;
    const out: Perms = { ...DEFAULTS };
    for (const [k, v] of Object.entries(s.permissions)) {
      const key = toSnake(k) as PartnerPermissionKey;
      if (key in out) out[key] = Boolean(v);
    }
    return out;
  } catch {
    return null;
  }
}

function loadPerms(userId: string, kind: "buyer" | "publisher"): Promise<Perms | null> {
  if (inflight && inflight.userId === userId) return inflight.promise;
  const promise = readPerms(kind)
    .then((perms) => {
      if (perms) cached = { userId, at: Date.now(), perms };
      return perms;
    })
    .finally(() => {
      if (inflight?.promise === promise) inflight = null;
    });
  inflight = { userId, promise };
  return promise;
}

/**
 * An EMPLOYEE's equivalents on the Roles screen. Only the three toggles that
 * have a tick of their own are mapped; the others stay open for staff (the
 * pages that need them check their own ticks directly).
 */
const STAFF_TICK: Partial<Record<PartnerPermissionKey, [area: string, action: string]>> = {
  audio_recording: ["reporting", "listen"],
  download_reports: ["reporting", "download"],
  block_numbers: ["blocked-numbers", "edit"],
};

export interface PartnerPermissions {
  /** True for buyer / publisher logins. */
  isPartner: boolean;
  /** Whether this login may use the feature. Always true for admin / staff. */
  can: (key: PartnerPermissionKey) => boolean;
}

export function usePartnerPermissions(): PartnerPermissions {
  const role = useAuthStore((s) => s.user?.role);
  const userId = useAuthStore((s) => s.user?.id) ?? "";
  const kind = role === "buyer" || role === "publisher" ? role : null;
  const staff = usePermissions();

  const fresh = cached && cached.userId === userId ? cached.perms : null;
  // undefined = still looking
  const [perms, setPerms] = React.useState<Perms | undefined>(fresh ?? undefined);

  React.useEffect(() => {
    if (!kind || !userId) return;
    let alive = true;
    const have = cached && cached.userId === userId ? cached : null;
    if (have) setPerms(have.perms);
    if (!have || Date.now() - have.at > REFRESH_MS) {
      void loadPerms(userId, kind).then((p) => {
        if (!alive) return;
        // A failed refresh keeps the last good answer; a first failure uses the defaults.
        setPerms(p ?? (have ? have.perms : DEFAULTS));
      });
    }
    return () => {
      alive = false;
    };
  }, [kind, userId]);

  return React.useMemo(() => {
    if (!kind) {
      return {
        isPartner: false,
        can: (key: PartnerPermissionKey) => {
          const tick = STAFF_TICK[key];
          return !tick || staff.can(tick[0], tick[1]);
        },
      };
    }
    const p = perms ?? NOTHING;
    return { isPartner: true, can: (key: PartnerPermissionKey) => p[key] };
  }, [kind, perms, staff]);
}

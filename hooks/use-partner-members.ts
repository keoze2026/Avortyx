"use client";

/**
 * Who can sign in to a buyer or publisher - read from the server.
 *
 *   GET /api/buyers/{id}/members
 *   GET /api/publishers/{id}/members
 *
 * Each row is a real login from the users table: email, invite status
 * ("invited" / "registered" / "revoked"), last login. The Members box used
 * to be a list kept in the browser, so it only knew about people invited
 * from that box on that machine; logins created any other way (the
 * auto-invite when a buyer is created, another browser, cleared storage)
 * kept working while the box showed nothing. Now the box shows exactly what
 * the database enforces, on every device.
 *
 * The old browser-kept list for this partner is deleted once the server
 * list has loaded, so nothing reads from it again.
 *
 * Refreshes every 30 s while the tab is visible and when it regains focus;
 * `refresh()` reloads at once (after an invite or a removal).
 */

import * as React from "react";

import type { PartnerMemberRow } from "@/components/network/partner-members-section";
import { http } from "@/lib/api/http";
import type { PartnerKind } from "@/lib/partner-access";
import type { InviteStatus } from "@/lib/partner-registration";
import { useBuyerMembersStore } from "@/lib/store/buyer-members-store";
import { usePublisherAccessStore } from "@/lib/store/publisher-access-store";

const REFRESH_MS = 30_000;

/** One row of the members endpoint (camelCased by the http layer). */
interface MemberWire {
  id: string;
  email: string;
  isActive?: boolean;
  inviteStatus?: string | null;
  invitedAt?: string | null;
  acceptedAt?: string | null;
  lastLogin?: string | null;
}

function toMs(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const n = Date.parse(iso);
  return Number.isFinite(n) ? n : null;
}

function toStatus(w: MemberWire): InviteStatus {
  const s = (w.inviteStatus ?? "").toLowerCase();
  if (s === "revoked" || w.isActive === false) return "revoked";
  if (s === "registered" || w.acceptedAt) return "registered";
  return "invited";
}

/** Delete this partner's old browser-kept member list. */
function dropBrowserList(kind: PartnerKind, partnerId: string) {
  if (kind === "buyer") {
    const store = useBuyerMembersStore.getState();
    for (const m of store.byBuyer[partnerId] ?? []) store.removeMember(partnerId, m.id);
  } else {
    const store = usePublisherAccessStore.getState();
    for (const m of store.byPublisher[partnerId]?.members ?? []) store.removeMember(partnerId, m.id);
  }
}

export interface PartnerMembers {
  rows: PartnerMemberRow[];
  loading: boolean;
  /** The list could not be loaded (the rows are whatever loaded last). */
  error: boolean;
  refresh: () => Promise<void>;
}

/**
 * @param contactEmail the partner's own contact address. It stays in the
 *   list (it is the account the backend invites on create) and can't be
 *   removed from here.
 */
export function usePartnerMembers(
  kind: PartnerKind,
  partnerId: string,
  contactEmail?: string | null,
): PartnerMembers {
  const [members, setMembers] = React.useState<MemberWire[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const contact = (contactEmail ?? "").trim().toLowerCase();

  const refresh = React.useCallback(async () => {
    try {
      const list = await http.get<MemberWire[]>(`/api/${kind}s/${partnerId}/members`);
      setMembers(Array.isArray(list) ? list : []);
      setError(false);
      dropBrowserList(kind, partnerId);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [kind, partnerId]);

  React.useEffect(() => {
    setLoading(true);
    setMembers([]);
    void refresh();
    const tick = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const id = window.setInterval(tick, REFRESH_MS);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  const rows = React.useMemo<PartnerMemberRow[]>(() => {
    const out: PartnerMemberRow[] = members.map((m) => {
      const status = toStatus(m);
      const email = (m.email ?? "").trim().toLowerCase();
      return {
        id: m.id,
        email,
        registered: status === "registered",
        status,
        lastLoginAt: toMs(m.lastLogin),
        canRemove: email !== contact && status !== "revoked",
      };
    });
    return out;
  }, [members, contact]);

  return { rows, loading, error, refresh };
}

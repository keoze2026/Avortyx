/**
 * Keeping partner logins honest when partners are deleted and re-invited.
 *
 * Rule (from the client): when a buyer or publisher - or one of its members -
 * is deleted, everything about that invitation goes. If the same email is
 * invited again, as a buyer or a publisher, it is a NEW invitation and the
 * person goes through the same steps as the first time.
 *
 * The server enforces this (it ends the old login and resets the account; see
 * the backend guide). This module is the frontend half:
 *   - markInvited     a fresh invitation was sent: forget what this browser knew
 *   - forgetPartner   a buyer / publisher was deleted: forget its emails and its
 *                     locally-kept member list
 *   - removePartnerMember   remove one person's access on the server
 */

import { ApiError } from "@/lib/api/errors";
import { http } from "@/lib/api/http";
import { useBuyerMembersStore } from "@/lib/store/buyer-members-store";
import { usePublisherAccessStore } from "@/lib/store/publisher-access-store";
import { useRegisteredPartnersStore } from "@/lib/store/registered-partners-store";

export type PartnerKind = "publisher" | "buyer";

const clean = (emails: readonly (string | null | undefined)[]): string[] =>
  Array.from(new Set(emails.map((e) => (e ?? "").trim().toLowerCase()).filter(Boolean)));

/** A fresh invitation was just sent to these emails. */
export function markInvited(emails: readonly (string | null | undefined)[]): void {
  const list = clean(emails);
  if (list.length) useRegisteredPartnersStore.getState().markInvited(list);
}

/** Forget these emails entirely. */
export function forgetEmails(emails: readonly (string | null | undefined)[]): void {
  const list = clean(emails);
  if (list.length) useRegisteredPartnersStore.getState().forget(list);
}

/** Every email this browser lists for a partner: its contact address plus invited members. */
export function partnerEmails(kind: PartnerKind, partnerId: string, contactEmail?: string | null): string[] {
  const members =
    kind === "buyer"
      ? (useBuyerMembersStore.getState().byBuyer[partnerId] ?? []).map((m) => m.email)
      : (usePublisherAccessStore.getState().byPublisher[partnerId]?.members ?? []).map((m) => m.email);
  return clean([contactEmail, ...members]);
}

/** A buyer or publisher was deleted: forget its emails and drop its local member list. */
export function forgetPartner(kind: PartnerKind, partnerId: string, contactEmail?: string | null): void {
  forgetEmails(partnerEmails(kind, partnerId, contactEmail));
  if (kind === "buyer") {
    const store = useBuyerMembersStore.getState();
    for (const m of store.byBuyer[partnerId] ?? []) store.removeMember(partnerId, m.id);
  } else {
    const store = usePublisherAccessStore.getState();
    for (const m of store.byPublisher[partnerId]?.members ?? []) store.removeMember(partnerId, m.id);
  }
}

/**
 * "removed"     - the server ended this person's access.
 * "local-only"  - the server does not offer member removal yet: the row is
 *                 removed from this list, but their login still works.
 */
export type RemoveOutcome = "removed" | "local-only";

/**
 * Remove one person's access: POST /api/{buyers|publishers}/{id}/members/remove { email }.
 * A 404 with code "member_not_found" means they were already gone (fine). A
 * plain 404 / 405 / 501 means the server does not have this endpoint yet.
 * Anything else is a real error and is thrown.
 */
export async function removePartnerMember(kind: PartnerKind, partnerId: string, email: string): Promise<RemoveOutcome> {
  try {
    await http.post(`/api/${kind}s/${partnerId}/members/remove`, { body: { email: email.trim().toLowerCase() } });
    return "removed";
  } catch (e) {
    if (e instanceof ApiError) {
      const code = e.code ?? (e.body && typeof e.body === "object" ? (e.body as Record<string, unknown>).code : undefined);
      if (e.status === 404 && code === "member_not_found") return "removed";
      if (e.status === 404 || e.status === 405 || e.status === 501) return "local-only";
    }
    throw e;
  }
}

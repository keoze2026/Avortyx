"use client";

import * as React from "react";

import {
  PartnerMembersSection,
  type PartnerMemberRow,
  type PartnerMembersLabels,
} from "@/components/network/partner-members-section";
import { usePartnerRegistration } from "@/hooks/use-partner-registration";
import { http } from "@/lib/api/http";
import { forgetEmails, markInvited, removePartnerMember } from "@/lib/partner-access";
import { useBuyerMembersStore, type BuyerMember } from "@/lib/store/buyer-members-store";
import type { Buyer } from "@/lib/types";

const NO_MEMBERS: BuyerMember[] = [];

const LABELS: PartnerMembersLabels = {
  title: "Members",
  description: "People invited to sign in and view this buyer's statistics",
  searchAria: "Search members",
  searchPlaceholder: "Search by email",
  filterAria: "Filter members",
  filterSoon: "Filtering is coming soon",
  invite: "Invite",
  invitePlaceholder: "name@company.com",
  sendInvite: "Send invite",
  cancel: "Cancel",
  email: "Email",
  status: "Status",
  actions: "Actions",
  noData: "No members yet",
  invalidEmail: "Enter a valid email address",
  invitedToast: (email) => `Invite sent to ${email}`,
  removedToast: (email) => `Removed ${email}: their access has ended`,
  removeAria: (email) => `Remove ${email}`,
};

/**
 * Members of a buyer, with each person's status: "Invited" until they accept,
 * then "Registered" in blue. The buyer's own contact email (the address the
 * backend invites when the buyer is created) is listed automatically.
 */
export function BuyerMembersCard({ buyer }: { buyer: Buyer }) {
  const members = useBuyerMembersStore((s) => s.byBuyer[buyer.id]) ?? NO_MEMBERS;
  const addMember = useBuyerMembersStore((s) => s.addMember);
  const removeMember = useBuyerMembersStore((s) => s.removeMember);

  const contactEmail = (buyer.email ?? "").trim().toLowerCase();
  const emails = React.useMemo(
    () => [...(contactEmail ? [contactEmail] : []), ...members.map((m) => m.email)],
    [contactEmail, members],
  );
  const reg = usePartnerRegistration(emails);

  const rows = React.useMemo<PartnerMemberRow[]>(() => {
    const out: PartnerMemberRow[] = [];
    if (contactEmail) out.push({ id: "contact", email: contactEmail, ...reg.info(contactEmail), canRemove: false });
    for (const m of members) {
      if (m.email === contactEmail) continue;
      out.push({ id: m.id, email: m.email, ...reg.info(m.email), canRemove: true });
    }
    return out;
  }, [contactEmail, members, reg]);

  return (
    <PartnerMembersSection
      rows={rows}
      labels={LABELS}
      onInvite={async (email) => {
        await http.post(`/api/buyers/${buyer.id}/invite`, { body: { email } });
        addMember(buyer.id, email);
        // A new invitation starts from scratch, even for an email seen before.
        markInvited([email]);
        reg.refresh();
      }}
      onRemove={async (id) => {
        const member = members.find((m) => m.id === id);
        if (!member) return;
        // End their access on the server first; only then drop the row.
        const outcome = await removePartnerMember("buyer", buyer.id, member.email);
        removeMember(buyer.id, id);
        forgetEmails([member.email]);
        reg.refresh();
        return outcome;
      }}
    />
  );
}

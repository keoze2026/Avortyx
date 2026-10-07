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
import { useTranslation } from "@/hooks/use-translation";

const NO_MEMBERS: BuyerMember[] = [];

/** Labels in the chosen language (lib/i18n/extra/daily.ts). */
function buyerMemberLabels(t: (key: string) => string): PartnerMembersLabels {
  return {
    title: t("buyerMembers.title"),
    description: t("buyerMembers.description"),
    searchAria: t("buyerMembers.searchAria"),
    searchPlaceholder: t("buyerMembers.searchPlaceholder"),
    filterAria: t("buyerMembers.filterAria"),
    filterSoon: t("buyerMembers.filterSoon"),
    invite: t("buyerMembers.invite"),
    invitePlaceholder: "name@company.com",
    sendInvite: t("buyerMembers.sendInvite"),
    cancel: t("buyerMembers.cancel"),
    email: t("buyerMembers.email"),
    status: t("buyerMembers.status"),
    actions: t("buyerMembers.actions"),
    noData: t("buyerMembers.noData"),
    invalidEmail: t("buyerMembers.invalidEmail"),
    invitedToast: (email) => t("buyerMembers.invitedToast").replace("{email}", email),
    removedToast: (email) => t("buyerMembers.removedToast").replace("{email}", email),
    removeAria: (email) => t("buyerMembers.removeAria").replace("{email}", email),
  };
}

/**
 * Members of a buyer, with each person's status: "Invited" until they accept,
 * then "Registered" in blue. The buyer's own contact email (the address the
 * backend invites when the buyer is created) is listed automatically.
 */
export function BuyerMembersCard({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const labels = React.useMemo(() => buyerMemberLabels(t), [t]);
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
      labels={labels}
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

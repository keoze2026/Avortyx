"use client";

import * as React from "react";

import {
  PartnerMembersSection,
  type PartnerMembersLabels,
} from "@/components/network/partner-members-section";
import { usePartnerMembers } from "@/hooks/use-partner-members";
import { http } from "@/lib/api/http";
import { forgetEmails, markInvited, removePartnerMember } from "@/lib/partner-access";
import type { Buyer } from "@/lib/types";
import { useTranslation } from "@/hooks/use-translation";

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
 * Members of a buyer - every login that can sign in to it, read from the
 * server (GET /api/buyers/{id}/members), with each person's status:
 * "Invited" until they accept, then "Registered" in blue. The buyer's own
 * contact login is listed too and can't be removed from here.
 */
export function BuyerMembersCard({ buyer }: { buyer: Buyer }) {
  const { t } = useTranslation();
  const labels = React.useMemo(() => buyerMemberLabels(t), [t]);
  const { rows, refresh } = usePartnerMembers("buyer", buyer.id, buyer.email);

  return (
    <PartnerMembersSection
      rows={rows}
      labels={labels}
      onInvite={async (email) => {
        await http.post(`/api/buyers/${buyer.id}/invite`, { body: { email } });
        // A new invitation starts from scratch, even for an email seen before.
        markInvited([email]);
        await refresh();
      }}
      onRemove={async (id) => {
        const member = rows.find((m) => m.id === id);
        if (!member) return;
        // End their access on the server, then reload the list from it.
        const outcome = await removePartnerMember("buyer", buyer.id, member.email);
        forgetEmails([member.email]);
        await refresh();
        return outcome;
      }}
    />
  );
}

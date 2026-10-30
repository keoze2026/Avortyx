"use client";

/** CH-415: one Campaign Group, in Sir's design (components/campaigns/groups/detail). */

import { useParams } from "next/navigation";

import { GroupDetail } from "@/components/campaigns/groups/detail/group-detail";

export default function CampaignGroupPage() {
  const params = useParams<{ id: string }>();
  return <GroupDetail groupId={String(params?.id ?? "")} />;
}

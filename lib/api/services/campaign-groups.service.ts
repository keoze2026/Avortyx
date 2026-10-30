/**
 * Campaign Groups (CH-328; Sir, 28 Oct) - backend campaigns/groups_api.py.
 *
 * A group is a set of campaigns the team edits as one: a destination added,
 * removed, or given a new priority / weight on the group(s) is changed in
 * every campaign in them, in one go (all or nothing). Internal: publisher and
 * buyer logins get 403 and never see the page.
 */

import { http } from "@/lib/api/http";

export interface GroupCampaign {
  id: string;
  name: string;
  status: string;
}

export interface CampaignGroup {
  id: string;
  name: string;
  description: string;
  campaigns: GroupCampaign[];
}

export interface GroupLineCampaign {
  campaignId: string;
  campaignName: string;
  /** The campaign's own destination row id. */
  id: string;
  priority: number;
  weight: number;
  revenue: string | null;
  convertOn: string;
  convertSeconds: number;
}

/** One destination number across the group's campaigns. */
export interface GroupLine {
  number: string;
  buyerId: string | null;
  buyerName: string;
  campaigns: GroupLineCampaign[];
  missingIn: { campaignId: string; campaignName: string }[];
  inCount: number;
  ofCount: number;
  priorities: number[];
  weights: number[];
}

export type GroupAction = "add" | "remove" | "update";

/** One of several destinations changed together (CH-353). */
export interface ApplyNumber {
  number: string;
  buyerId?: string;
  revenue?: number;
  convertOn?: "incoming" | "connected" | "length";
  convertSeconds?: number;
}

export interface ApplyChange {
  groupIds: string[];
  action: GroupAction;
  number: string;
  /** Several destinations at once, all or nothing (CH-353). */
  numbers?: ApplyNumber[];
  buyerId?: string;
  priority?: number;
  weight?: number;
  revenue?: number;
  convertOn?: "incoming" | "connected" | "length";
  convertSeconds?: number;
}

export interface ApplyResult {
  action: GroupAction;
  number: string;
  numbers?: string[];
  groups: string[];
  changed: number;
  campaigns: number;
  results: {
    campaignId: string;
    campaignName: string;
    group: string;
    result: "added" | "removed" | "changed" | "unchanged";
    detail: string;
    /** The destination this row is about (CH-353). */
    number?: string;
  }[];
}

/** CH-415: one destination in a group - which campaigns, and each one's own
 *  priority / weight. Campaigns not listed are left as they are. */
export interface SetLineCampaign {
  campaignId: string;
  included: boolean;
  priority?: number;
  weight?: number;
}

export interface SetLineChange {
  number: string;
  buyerId?: string;
  campaigns: SetLineCampaign[];
  /** Needed only when the destination is in none of the group's campaigns yet. */
  revenue?: number;
  convertOn?: "incoming" | "connected" | "length";
  convertSeconds?: number;
}

/** CH-415: one line of a group's Change history. */
export interface GroupHistoryItem {
  id: string;
  at: string;
  by: string;
  text: string;
}

const BASE = "/api/campaign-groups/";

export const campaignGroups = {
  async list(): Promise<CampaignGroup[]> {
    const res = await http.get<{ items: CampaignGroup[] }>(BASE);
    return res.items ?? [];
  },

  async create(body: { name: string; description?: string; campaignIds: string[] }): Promise<CampaignGroup> {
    return http.post<CampaignGroup>(BASE, { body });
  },

  async update(
    id: string,
    body: { name?: string; description?: string; campaignIds?: string[] },
  ): Promise<CampaignGroup> {
    return http.patch<CampaignGroup>(`${BASE}${id}`, { body });
  },

  async remove(id: string): Promise<void> {
    await http.delete(`${BASE}${id}`);
  },

  async destinations(id: string): Promise<GroupLine[]> {
    const res = await http.get<{ items: GroupLine[] }>(`${BASE}${id}/destinations`);
    return res.items ?? [];
  },

  async apply(change: ApplyChange): Promise<ApplyResult> {
    return http.post<ApplyResult>(`${BASE}apply`, { body: change });
  },

  /** CH-415: all or nothing, in one transaction on the server. */
  async setLine(groupId: string, change: SetLineChange): Promise<ApplyResult> {
    return http.post<ApplyResult>(`${BASE}${groupId}/line`, { body: change });
  },

  async history(groupId: string): Promise<GroupHistoryItem[]> {
    const res = await http.get<{ items: GroupHistoryItem[] }>(`${BASE}${groupId}/history`);
    return res.items ?? [];
  },
};

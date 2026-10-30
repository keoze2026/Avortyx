/**
 * CH-408: figures one part of the campaign page loads and another shows.
 *
 * The Destinations tile in the header counts the lines in the Destinations
 * card below it. That card already loads them from the campaign's routing
 * rule, so it puts the count here rather than the header loading them again.
 */

"use client";

import { create } from "zustand";

export interface RoutedCount {
  total: number;
  on: number;
}

interface CampaignPageState {
  /** campaignId → its routed destinations, once the card has loaded them. */
  routed: Record<string, RoutedCount>;
  setRouted: (campaignId: string, count: RoutedCount) => void;
}

export const useCampaignPageStore = create<CampaignPageState>((set) => ({
  routed: {},
  setRouted: (campaignId, count) =>
    set((s) => {
      const prev = s.routed[campaignId];
      if (prev && prev.total === count.total && prev.on === count.on) return s;
      return { routed: { ...s.routed, [campaignId]: count } };
    }),
}));

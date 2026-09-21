/**
 * Marketplace (RTB) auction + bid fixtures.
 * Mix of open + recently-settled auctions; the socket driver tops up with
 * `rtb.auction_created` + `rtb.bid_placed` events to keep the floor alive.
 */

import { makeRng, pick, intRange, range, chance } from "../rng";
import { DEMO_CAMPAIGN } from "./account";

const NOW = Date.now();

// Auctions run on the account's one campaign; the bidders are outside buyers.
const CAMPAIGNS_FOR_AUCTION = [DEMO_CAMPAIGN.name];


const BUYER_NAMES = [
  "Apex Insurance Group",
  "Solar United",
  "Pinnacle Legal Partners",
  "Meridian Auto Insurance",
  "Hearthside Roofing Network",
  "Clearpath Debt Solutions",
  "Lighthouse ACA Verification",
];

const AREA_CODES = ["212", "415", "713", "404", "305", "303", "617", "773"];

function makePhone(rng: () => number): string {
  const ac = pick(AREA_CODES, rng);
  const tail = String(intRange(rng, 1_000_000, 9_999_999));
  return `+1${ac}${tail}`;
}

export interface DemoAuctionWire {
  id: string;
  campaign_id: string;
  campaign_name: string;
  caller_number: string;
  status: "open" | "settled" | "cancelled";
  bid_floor: number;
  winning_bid?: number;
  winning_buyer_id?: string;
  winning_buyer_name?: string;
  created_at: number;
  settled_at?: number;
}

export interface DemoBidWire {
  id: string;
  auction_id: string;
  buyer_id: string;
  buyer_name: string;
  amount: number;
  is_winning: boolean;
  created_at: number;
}

export function seedAuctions(): DemoAuctionWire[] {
  const rng = makeRng(2026);
  const rows: DemoAuctionWire[] = [];
  // 8 open
  for (let i = 0; i < 8; i++) {
    const camp = pick(CAMPAIGNS_FOR_AUCTION, rng);
    const floor = Math.round(range(rng, 10, 80) * 100) / 100;
    const winner = chance(rng, 0.7);
    const winningBid = winner ? Math.round((floor + range(rng, 0.5, 22)) * 100) / 100 : undefined;
    const winningBuyer = winner ? pick(BUYER_NAMES, rng) : undefined;
    rows.push({
      id: `auction_demo_open_${i}`,
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: camp,
      caller_number: makePhone(rng),
      status: "open",
      bid_floor: floor,
      winning_bid: winningBid,
      winning_buyer_id: winningBuyer ? winningBuyer.toLowerCase().replace(/\s+/g, "_") : undefined,
      winning_buyer_name: winningBuyer,
      created_at: NOW - intRange(rng, 10, 240) * 1000,
    });
  }
  // 12 settled within the last day
  for (let i = 0; i < 12; i++) {
    const camp = pick(CAMPAIGNS_FOR_AUCTION, rng);
    const floor = Math.round(range(rng, 12, 75) * 100) / 100;
    const winningBid = Math.round((floor + range(rng, 1.5, 32)) * 100) / 100;
    const winningBuyer = pick(BUYER_NAMES, rng);
    const settledAt = NOW - intRange(rng, 60, 8 * 60 * 60) * 1000;
    rows.push({
      id: `auction_demo_settled_${i}`,
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: camp,
      caller_number: makePhone(rng),
      status: "settled",
      bid_floor: floor,
      winning_bid: winningBid,
      winning_buyer_id: winningBuyer.toLowerCase().replace(/\s+/g, "_"),
      winning_buyer_name: winningBuyer,
      created_at: settledAt - 90_000,
      settled_at: settledAt,
    });
  }
  return rows;
}

export function bidsForAuction(auction: DemoAuctionWire): DemoBidWire[] {
  const rng = makeRng(auction.id.length * 7);
  const bids: DemoBidWire[] = [];
  const count = intRange(rng, 1, 5);
  let lastAmount = auction.bid_floor;
  for (let i = 0; i < count; i++) {
    const buyer = pick(BUYER_NAMES, rng);
    lastAmount = Math.round((lastAmount + range(rng, 0.5, 6.5)) * 100) / 100;
    bids.push({
      id: `bid_demo_${auction.id}_${i}`,
      auction_id: auction.id,
      buyer_id: buyer.toLowerCase().replace(/\s+/g, "_"),
      buyer_name: buyer,
      amount: lastAmount,
      is_winning: i === count - 1 && auction.winning_bid === lastAmount,
      created_at: auction.created_at + i * 12_000,
    });
  }
  return bids.sort((a, b) => b.created_at - a.created_at);
}

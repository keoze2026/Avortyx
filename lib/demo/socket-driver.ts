/**
 * Fake CallSocket for demo mode.
 *
 * Implements the same `CallSocket` interface the real socket exposes, but
 * never opens a network connection. Instead it ticks on an interval and
 * emits canned events to any subscribers, so the Live Monitor radar and
 * the Marketplace bid tape look alive.
 *
 * Removal: delete this file + the `if (isDemoMode()) return createDemoSocket();`
 * branch at the top of `lib/api/socket.ts`.
 */

import type { CallEvent, CallEventType, CallSocket } from "../api/socket";
import { DEMO_BUYER, DEMO_CAMPAIGN, DEMO_DESTINATION_TFN, DEMO_PUBLISHER } from "./fixtures/account";
import { trackLive, untrackLive, wasHungUp } from "./live-registry";
import { snakeToCamel } from "../api/case";
import { generateLiveCalls, liveCallsCount } from "./fixtures/calls";
import { seedAuctions, bidsForAuction } from "./fixtures/auctions";
import { makeRng, pick, intRange, range } from "./rng";

type Listener<T = unknown> = (data: T) => void;

// The live account runs one campaign / buyer / publisher; so does the demo.
const CAMPAIGNS = [DEMO_CAMPAIGN.name];
const BUYERS = [{ id: DEMO_BUYER.id, name: DEMO_BUYER.name }];
const PUBLISHERS = [{ id: DEMO_PUBLISHER.id, name: DEMO_PUBLISHER.name }];
const AREA_CODES = ["212", "415", "713", "404", "305", "303", "617", "773", "206", "619", "512"];
const STATES = ["TX", "CA", "FL", "NY", "PA", "OH", "IL", "GA", "NC", "MI"];

let counter = 0;
function nextCallId(): string {
  counter += 1;
  return `live_${counter.toString(36)}_${Date.now().toString(36)}`;
}

function makePhone(rng: () => number): string {
  const ac = pick(AREA_CODES, rng);
  const tail = String(intRange(rng, 1_000_000, 9_999_999));
  return `+1${ac}${tail}`;
}

interface InFlight {
  id: string;
  startedAt: number;
  campaign: string;
  buyer: { id: string; name: string };
  publisher: { id: string; name: string };
  caller: string;
  state: string;
  destination: string;
  status: "ringing" | "in-progress";
  ttl: number;
}

export function createDemoSocket(): CallSocket {
  const listeners = new Map<CallEventType, Set<Listener>>();
  const anyListeners = new Set<(e: CallEvent) => void>();
  let tick: ReturnType<typeof setInterval> | null = null;
  let opened = false;
  const inFlight: InFlight[] = [];

  // Marketplace auctions kept in memory so the bid stream stays coherent.
  const auctions = seedAuctions().filter((a) => a.status === "open").slice(0, 6);

  const emit = (type: CallEventType, data: unknown) => {
    // Match the dispatch path of the real socket — wrap in {type, data} and
    // run through snakeToCamel exactly like real WS frames.
    const camelData = snakeToCamel(data);
    const set = listeners.get(type);
    if (set) for (const l of set) l(camelData);
    const event: CallEvent = { type, data: camelData };
    for (const l of anyListeners) l(event);
  };

  const seedInFlight = () => {
    // Open with the dataset's live figure for this hour already in flight.
    const live = generateLiveCalls(liveCallsCount());
    for (const c of live) {
      inFlight.push({
        id: c.id,
        startedAt: Date.parse(c.created_at),
        campaign: c.campaign_name,
        buyer: { id: c.buyer_id, name: c.buyer_name },
        publisher: { id: c.publisher_id, name: c.publisher_name },
        caller: c.caller_number,
        state: c.caller_state,
        destination: c.destination_number,
        status: c.status as InFlight["status"],
        ttl: intRange(makeRng(c.id.length), 30, 180),
      });
      trackLive(c.id, { startedAt: Date.parse(c.created_at), status: c.status as InFlight["status"] });
    }
  };

  const startCall = (rng: () => number) => {
    const camp = pick(CAMPAIGNS, rng);
    const buyer = pick(BUYERS, rng);
    const publisher = pick(PUBLISHERS, rng);
    const id = nextCallId();
    const call: InFlight = {
      id,
      startedAt: Date.now(),
      campaign: camp,
      buyer,
      publisher,
      caller: makePhone(rng),
      state: pick(STATES, rng),
      destination: DEMO_DESTINATION_TFN,
      status: "ringing",
      ttl: intRange(rng, 30, 240),
    };
    inFlight.push(call);
    trackLive(call.id, { startedAt: call.startedAt, status: "ringing" });
    emit("call.created", liveWire(call));
  };

  const liveWire = (c: InFlight) => ({
    id: c.id,
    caller_number: c.caller,
    destination_number: c.destination,
    status: c.status,
    duration: Math.floor((Date.now() - c.startedAt) / 1000),
    caller_area_code: c.caller.slice(2, 5),
    caller_state: c.state,
    caller_country: "US",
    campaign_id: DEMO_CAMPAIGN.id,
    campaign_name: c.campaign,
    buyer_id: c.buyer.id,
    buyer_name: c.buyer.name,
    publisher_id: c.publisher.id,
    publisher_name: c.publisher.name,
    revenue: "0.00",
    buyer_payout: "0.00",
    publisher_payout: "0.00",
    recording_url: "",
    created_at: new Date(c.startedAt).toISOString(),
    tags: [] as string[],
    notes: "",
  });

  const settleCall = (c: InFlight, rng: () => number) => {
    const converted = rng() < 0.62;
    const revenue = converted ? Math.round(range(rng, 35, 320) * 100) / 100 : 0;
    emit("call.ended", {
      ...liveWire(c),
      status: converted ? "completed" : (rng() < 0.5 ? "missed" : "rejected"),
      duration: Math.floor((Date.now() - c.startedAt) / 1000),
      revenue: revenue.toFixed(2),
      buyer_payout: revenue.toFixed(2),
      publisher_payout: Math.round(revenue * 0.6 * 100 / 100).toFixed(2),
    });
  };

  const placeBid = (rng: () => number) => {
    const auction = pick(auctions, rng);
    if (!auction) return;
    const buyer = pick(BUYERS, rng);
    const current = auction.winning_bid ?? auction.bid_floor;
    const step = Math.round(range(rng, 0.5, 4.5) * 100) / 100;
    const next = Math.round((current + step) * 100) / 100;
    auction.winning_bid = next;
    auction.winning_buyer_id = buyer.id;
    auction.winning_buyer_name = buyer.name;
    emit("rtb.bid_placed", {
      id: `bid_${Date.now().toString(36)}`,
      auction_id: auction.id,
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      amount: next,
      is_winning: true,
      created_at: Date.now(),
    });
  };

  const newAuction = (rng: () => number) => {
    const camp = pick(CAMPAIGNS, rng);
    const floor = Math.round(range(rng, 12, 70) * 100) / 100;
    const a = {
      id: `auction_${Date.now().toString(36)}`,
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: camp,
      caller_number: makePhone(rng),
      status: "open" as const,
      bid_floor: floor,
      winning_bid: undefined,
      winning_buyer_id: undefined,
      winning_buyer_name: undefined,
      created_at: Date.now(),
    };
    auctions.push(a);
    if (auctions.length > 12) {
      const removed = auctions.shift();
      if (removed) {
        emit("rtb.auction_settled", { ...removed, status: "settled", settled_at: Date.now() });
      }
    }
    emit("rtb.auction_created", a);
  };

  const runTick = () => {
    const rng = Math.random;
    const now = Date.now();
    // Calls the operator hung up (POST …/hangup) leave quietly — the hook
    // already settled the card from the router's response.
    for (let i = inFlight.length - 1; i >= 0; i--) {
      if (wasHungUp(inFlight[i].id)) inFlight.splice(i, 1);
    }
    // Promote ringing → in-progress after 4s
    for (const c of inFlight) {
      if (c.status === "ringing" && now - c.startedAt > 4_000) {
        c.status = "in-progress";
        trackLive(c.id, { startedAt: c.startedAt, status: "in-progress" });
        emit("call.connected", liveWire(c));
      }
    }
    // Settle calls past their TTL
    for (let i = inFlight.length - 1; i >= 0; i--) {
      const c = inFlight[i];
      if (now - c.startedAt >= c.ttl * 1000) {
        settleCall(c, rng);
        untrackLive(c.id);
        inFlight.splice(i, 1);
      }
    }
    // Converge on the dataset's live figure for the current hour: start
    // enough calls to cover the shortfall (capped so a slot change ramps
    // over a few ticks rather than jumping), and start none when over it
    // so settling calls bring the count back down. After hours the target
    // is 0 and the radar drains on its own.
    const target = liveCallsCount();
    const deficit = target - inFlight.length;
    const toStart = Math.min(Math.max(deficit, 0), 12);
    for (let i = 0; i < toStart; i++) startCall(rng);
    // Place a couple of bids per tick
    placeBid(rng);
    if (Math.random() < 0.35) placeBid(rng);
    // Occasionally rotate auctions
    if (Math.random() < 0.18) newAuction(rng);
  };

  return {
    connect() {
      if (opened) return;
      opened = true;
      seedInFlight();
      // First tick after a short delay so subscribers attach.
      setTimeout(() => {
        runTick();
        tick = setInterval(runTick, 3_200);
      }, 600);
    },
    disconnect() {
      opened = false;
      if (tick) {
        clearInterval(tick);
        tick = null;
      }
    },
    on<T>(type: CallEventType, listener: (data: T) => void) {
      let s = listeners.get(type);
      if (!s) {
        s = new Set();
        listeners.set(type, s);
      }
      s.add(listener as Listener);
      return () => {
        const ss = listeners.get(type);
        if (!ss) return;
        ss.delete(listener as Listener);
        if (ss.size === 0) listeners.delete(type);
      };
    },
    onAny(listener) {
      anyListeners.add(listener);
      return () => {
        anyListeners.delete(listener);
      };
    },
    isConnected() {
      return opened;
    },
  };
}

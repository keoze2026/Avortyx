/**
 * Core operational fixtures — campaigns, buyers, publishers, numbers,
 * destinations, routing plans, IVR flows, blocked numbers, spam shields.
 *
 * Every entity is in **wire shape (snake_case)** so the http router can
 * return it as-is and the http layer's response case-adapter will hand
 * camelCase to the consumer, exactly like the real backend.
 *
 * Numbers (revenue/calls/caps) are tuned to feel like an active mid-tier
 * pay-per-call operator: ~$40k/day, ~12k calls/day, $35 avg CPL.
 */

import { DEMO_BUYER, DEMO_CAMPAIGN, DEMO_CAPS, DEMO_DESTINATION_TFN, DEMO_PUBLISHER } from "./account";
import { makeRng, pick, intRange, range } from "../rng";

const NOW = Date.now();
const DAY = 24 * 60 * 60 * 1000;

/* ─── Campaign vertical palette ────────────────────────────────────── */

const VERTICALS = [
  "health-insurance",
  "auto-insurance",
  "home-services",
  "solar",
  "legal",
  "education",
  "finance",
  "travel",
] as const;

const VERTICAL_NAMES = {
  "health-insurance": "Health Insurance",
  "auto-insurance": "Auto Insurance",
  "home-services": "Home Services",
  solar: "Solar",
  legal: "Legal",
  education: "Education",
  finance: "Finance",
  travel: "Travel",
};

/* ─── Campaigns ────────────────────────────────────────────────────── */

const CAMPAIGN_SEED: Array<{
  id: string;
  name: string;
  vertical: (typeof VERTICALS)[number];
  status: "active" | "paused" | "draft";
  payout_per_call: number;
  total_calls: number;
  conversion_rate: number;
  revenue_today: number;
}> = [
  // The live account runs a single campaign; the demo mirrors it.
  { id: DEMO_CAMPAIGN.id, name: DEMO_CAMPAIGN.name, vertical: DEMO_CAMPAIGN.vertical, status: "active", payout_per_call: 1, total_calls: 0, conversion_rate: 0.64, revenue_today: 0 },
];

export function seedCampaigns() {
  return CAMPAIGN_SEED.map((c) => ({
    id: c.id,
    name: c.name,
    vertical: c.vertical,
    description: `${VERTICAL_NAMES[c.vertical]} — ${c.name}. Inbound + DNI traffic, US territories only.`,
    status: c.status,
    payout_per_call: c.payout_per_call,
    payout_model: "flat",
    total_calls: c.total_calls,
    conversion_rate: c.conversion_rate,
    revenue_today: c.revenue_today,
    daily_cap: DEMO_CAPS.daily,
    monthly_cap: DEMO_CAPS.monthly,
    concurrency_cap: DEMO_CAPS.concurrency,
    geo_targets: ["US"],
    created_at: new Date(NOW - intRange(makeRng(c.id.length * 17), 30, 180) * DAY).toISOString(),
    advanced_settings: {},
    buyer_ids: [],
    publisher_ids: [],
  }));
}

/* ─── Buyers ───────────────────────────────────────────────────────── */

const BUYER_SEED = [
  { id: DEMO_BUYER.id, name: DEMO_BUYER.name, organization: DEMO_BUYER.organization, contact_name: DEMO_BUYER.contactName, contact_email: DEMO_BUYER.contactEmail, bid_amount: 1, daily_cap: DEMO_CAPS.daily, monthly_cap: DEMO_CAPS.monthly, concurrency_cap: DEMO_CAPS.concurrency, calls_today: 0, calls_month: 0, spend_today: 0, spend_month: 0, lifetime_spend: 0, accept_rate: 0.87, conversion_rate: 0.64, status: "active", description: "Primary buyer on the 23 JUNE campaign." },
];

export function seedBuyers() {
  return BUYER_SEED.map((b) => ({
    ...b,
    payout_model: "flat",
    campaign_ids: [],
    created_at: new Date(NOW - intRange(makeRng(b.id.length * 23), 90, 540) * DAY).toISOString(),
    not_connected: false,
  }));
}

/* ─── Publishers ───────────────────────────────────────────────────── */

const PUBLISHER_SEED = [
  { id: DEMO_PUBLISHER.id, name: DEMO_PUBLISHER.name, organization: DEMO_PUBLISHER.organization, contact_email: DEMO_PUBLISHER.contactEmail, payout_rate: 0.55, calls_today: 0, calls_month: 0, revenue_today: 0, revenue_month: 0, pending_payout: 0, conversion_rate: 0.64, numbers_assigned: 1, status: "active" },
];

export function seedPublishers() {
  return PUBLISHER_SEED.map((p) => ({
    ...p,
    description: `${p.name} — verified pay-per-call publisher.`,
    is_partner: true,
    created_at: new Date(NOW - intRange(makeRng(p.id.length * 31), 60, 480) * DAY).toISOString(),
  }));
}

/* ─── Phone numbers ────────────────────────────────────────────────── */

const AREA_CODES = ["212", "415", "713", "404", "305", "303", "617", "773", "602", "206", "619", "512", "214", "503", "702", "615"];

export function seedNumbers() {
  const buyers = BUYER_SEED;
  const campaigns = CAMPAIGN_SEED;
  const publishers = PUBLISHER_SEED;
  const rows: Array<Record<string, unknown>> = [];
  const rng = makeRng(99551);
  for (let i = 0; i < 48; i++) {
    const ac = pick(AREA_CODES, rng);
    const tail = String(intRange(rng, 1_000_000, 9_999_999));
    const number = `+1${ac}${tail.padStart(7, "0")}`;
    const camp = pick(campaigns, rng);
    const buyer = pick(buyers, rng);
    const pub = pick(publishers, rng);
    rows.push({
      id: `n_demo_${i.toString(36)}`,
      number,
      formatted_number: `+1 (${ac}) ${tail.slice(0, 3)}-${tail.slice(3, 7)}`,
      friendly_name: `${camp.name.slice(0, 24)}…`,
      country: "US",
      status: i % 13 === 0 ? "paused" : "active",
      type: i % 5 === 0 ? "toll-free" : "local",
      provider: i % 3 === 0 ? "Twilio" : "Bandwidth",
      campaign_id: camp.id,
      campaign_name: camp.name,
      buyer_id: buyer.id,
      buyer_name: buyer.name,
      publisher_id: pub.id,
      publisher_name: pub.name,
      monthly_cost: 1.0,
      voice_url: `https://demo.avortyx.io/twiml/${i}`,
      calls_today: intRange(rng, 0, 280),
      created_at: new Date(NOW - intRange(rng, 5, 240) * DAY).toISOString(),
    });
  }
  return rows;
}

/* ─── Destinations ─────────────────────────────────────────────────── */

export function seedDestinations() {
  // One destination, like the live account: every call lands on this TFN.
  return [
    {
      id: "d_demo_0",
      name: `${DEMO_BUYER.name} — Primary`,
      tfn: DEMO_DESTINATION_TFN,
      type: "phone",
      target_value: DEMO_DESTINATION_TFN,
      buyer_id: DEMO_BUYER.id,
      buyer_name: DEMO_BUYER.name,
      status: "active",
      daily_cap: DEMO_CAPS.daily,
      monthly_cap: DEMO_CAPS.monthly,
      concurrency_cap: DEMO_CAPS.concurrency,
      enabled: true,
      weight: 1,
      priority: 100,
      created_at: new Date(NOW - 120 * DAY).toISOString(),
    },
  ];
}

/* ─── Routing plans ────────────────────────────────────────────────── */

/**
 * Shape matches what `routing.service.ts#wireToRule` actually reads
 * (`rule_type`, `priority`, `conditions[]`, `destinations[]`) — NOT the
 * frontend's `RoutingPlan.nodes`/`.edges`, which only ever exist client-side
 * inside `conditions[].conditions.graph` (see `lib/routing-bridge.ts`).
 *
 * Seeding plain `nodes: []` / `edges: []` here (the old shape) meant every
 * demo plan round-tripped through `wireToRule` with empty `conditions` and
 * `destinations` arrays regardless of what a `nodes`/`edges` key held — the
 * exact "0 nodes / 0 buyers / 0 edges despite a real buyer destination"
 * report, reproduced locally by our own fixture rather than a live backend.
 *
 * Two plans below carry a real saved graph blob (inbound → buyer); the third
 * carries only a `destinations` entry and no blob, to exercise the bridge's
 * `synthesizeGraph` fallback — the path a rule created outside the visual
 * builder takes.
 */
function graphCondition(nodes: unknown[], edges: unknown[]) {
  return [
    {
      id: "cond_graph",
      conditions: { graph: JSON.stringify({ nodes, edges }) },
    },
  ];
}

export function seedRoutingPlans() {
  return [
    {
      id: "rp_demo_main",
      name: `${DEMO_CAMPAIGN.name} — Geo Split`,
      description: "Routes by caller state, with cap-aware fallback.",
      status: "active",
      rule_type: "visual-graph",
      priority: 1,
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: DEMO_CAMPAIGN.name,
      created_at: new Date(NOW - 45 * DAY).toISOString(),
      updated_at: new Date(NOW - 3 * DAY).toISOString(),
      conditions: graphCondition(
        [
          { id: "inbound", type: "inbound", position: { x: 60, y: 120 }, data: { kind: "inbound", inbound: { campaignId: DEMO_CAMPAIGN.id } } },
          { id: "geo", type: "geoFilter", position: { x: 340, y: 120 }, data: { kind: "geoFilter", geoFilter: { mode: "allow", states: ["TX", "FL", "OH"] } } },
          { id: "buyer_main", type: "buyer", position: { x: 620, y: 120 }, data: { kind: "buyer", buyer: { buyerId: DEMO_BUYER.id, buyerName: DEMO_BUYER.name } } },
        ],
        [
          { id: "e_inbound_geo", source: "inbound", target: "geo", sourceHandle: "out", targetHandle: "in" },
          { id: "e_geo_buyer", source: "geo", target: "buyer_main", sourceHandle: "out", targetHandle: "in" },
        ],
      ),
      destinations: [
        { id: "dest_main", buyer_id: DEMO_BUYER.id, buyer_name: DEMO_BUYER.name, weight: 100, priority: 1 },
      ],
    },
  ];
}

/* ─── IVR flows ────────────────────────────────────────────────────── */

export function seedIvrFlows() {
  return [
    {
      id: "ivr_demo_main",
      name: `${DEMO_CAMPAIGN.name} — Pre-qualify`,
      description: "Age 65+, ZIP capture, language routing.",
      status: "active",
      campaign_id: DEMO_CAMPAIGN.id,
      campaign_name: DEMO_CAMPAIGN.name,
      language: "en",
      voice: "alloy",
      welcome_message: "Thanks for calling. Press 1 if you are 65 or older.",
      created_at: new Date(NOW - 30 * DAY).toISOString(),
    },
  ];
}

/* ─── Call queue (currently waiting) ───────────────────────────────── */

const QUEUE_NUMBERS = ["+12125550912", "+14155551404", "+17135552288", "+13055554417"];
const QUEUE_DEST = ["+18005551234", "+18005551235"];

export function seedQueue() {
  const rng = makeRng(11237);
  return QUEUE_NUMBERS.map((caller, i) => ({
    id: `q_demo_${i}`,
    caller_number: caller,
    destination_number: pick(QUEUE_DEST, rng),
    campaign_name: pick(CAMPAIGN_SEED.filter((c) => c.status === "active"), rng).name,
    status: i % 2 === 0 ? "waiting" : "rolling-over",
    wait_time_sec: intRange(rng, 8, 95),
    enqueued_at: NOW - intRange(rng, 10, 95) * 1000,
  }));
}

/* ─── VoIP / TCPA shields + blocked numbers ────────────────────────── */

export function seedVoipShield() {
  return {
    enabled: true,
    block_all_voip: false,
    allowed_carriers: ["AT&T", "Verizon", "T-Mobile"],
    blocked_count_today: 412,
    blocked_count_month: 8_904,
    accuracy_rate: 0.984,
    rules: [
      { id: "vs_1", name: "Block known voip pools", enabled: true, action: "drop" },
      { id: "vs_2", name: "Allow major US carriers", enabled: true, action: "allow" },
    ],
  };
}

export function seedTcpaShield() {
  return {
    enabled: true,
    provider: "ActiveProspect TrustedForm",
    consent_window_days: 90,
    blocked_count_today: 188,
    blocked_count_month: 4_022,
    compliance_rate: 0.992,
    rules: [
      { id: "ts_1", name: "Require TrustedForm certificate", enabled: true, action: "block-if-missing" },
      { id: "ts_2", name: "Block DNC matches", enabled: true, action: "drop" },
    ],
  };
}

export function seedBlockedNumbers() {
  const rng = makeRng(8841);
  const reasons = ["Spam complaint", "DNC list match", "Fraud signature", "Carrier flagged", "Manual block"];
  return Array.from({ length: 24 }, (_, i) => {
    const ac = pick(AREA_CODES, rng);
    const tail = String(intRange(rng, 1_000_000, 9_999_999));
    return {
      id: `bn_demo_${i.toString(36)}`,
      number: `+1${ac}${tail}`,
      formatted: `+1 (${ac}) ${tail.slice(0, 3)}-${tail.slice(3, 7)}`,
      reason: pick(reasons, rng),
      scope: i % 4 === 0 ? "global" : "campaign",
      added_by: "Alex Morgan",
      created_at: new Date(NOW - intRange(rng, 1, 90) * DAY).toISOString(),
    };
  });
}

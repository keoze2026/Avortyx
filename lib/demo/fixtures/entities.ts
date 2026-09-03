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
  { id: "c_health_001", name: "Medicare Open Enrollment 2026", vertical: "health-insurance", status: "active", payout_per_call: 65, total_calls: 18_421, conversion_rate: 0.31, revenue_today: 12_410 },
  { id: "c_health_002", name: "ACA Subsidy Verification", vertical: "health-insurance", status: "active", payout_per_call: 55, total_calls: 11_209, conversion_rate: 0.27, revenue_today: 6_820 },
  { id: "c_auto_001", name: "Auto Insurance — High Intent", vertical: "auto-insurance", status: "active", payout_per_call: 42, total_calls: 14_886, conversion_rate: 0.34, revenue_today: 9_180 },
  { id: "c_auto_002", name: "SR-22 Filings", vertical: "auto-insurance", status: "paused", payout_per_call: 88, total_calls: 2_103, conversion_rate: 0.41, revenue_today: 0 },
  { id: "c_home_001", name: "Roofing Storm Damage", vertical: "home-services", status: "active", payout_per_call: 92, total_calls: 4_502, conversion_rate: 0.38, revenue_today: 7_640 },
  { id: "c_home_002", name: "HVAC Installation Leads", vertical: "home-services", status: "active", payout_per_call: 75, total_calls: 6_811, conversion_rate: 0.29, revenue_today: 4_320 },
  { id: "c_solar_001", name: "Solar — Homeowner 700+ FICO", vertical: "solar", status: "active", payout_per_call: 110, total_calls: 3_988, conversion_rate: 0.22, revenue_today: 5_280 },
  { id: "c_legal_001", name: "Mass Tort Intake — Talc", vertical: "legal", status: "active", payout_per_call: 320, total_calls: 1_217, conversion_rate: 0.18, revenue_today: 8_960 },
  { id: "c_legal_002", name: "Personal Injury Auto", vertical: "legal", status: "active", payout_per_call: 180, total_calls: 2_894, conversion_rate: 0.24, revenue_today: 6_120 },
  { id: "c_edu_001", name: "Online Degree — Healthcare", vertical: "education", status: "draft", payout_per_call: 38, total_calls: 0, conversion_rate: 0, revenue_today: 0 },
  { id: "c_fin_001", name: "Debt Relief Consultation", vertical: "finance", status: "active", payout_per_call: 58, total_calls: 8_104, conversion_rate: 0.26, revenue_today: 5_440 },
  { id: "c_travel_001", name: "Cruise Cancellation Refund", vertical: "travel", status: "paused", payout_per_call: 24, total_calls: 4_298, conversion_rate: 0.19, revenue_today: 0 },
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
    daily_cap: 500,
    monthly_cap: 12_000,
    concurrency_cap: 25,
    geo_targets: ["US"],
    created_at: new Date(NOW - intRange(makeRng(c.id.length * 17), 30, 180) * DAY).toISOString(),
    advanced_settings: {},
    buyer_ids: [],
    publisher_ids: [],
  }));
}

/* ─── Buyers ───────────────────────────────────────────────────────── */

const BUYER_SEED = [
  { id: "b_apex", name: "Apex Insurance Group", organization: "Apex Insurance Holdings", contact_name: "Sarah Mitchell", contact_email: "sarah.mitchell@apex-ins.example", bid_amount: 65, daily_cap: 500, monthly_cap: 12_000, concurrency_cap: 25, calls_today: 187, calls_month: 4_212, spend_today: 12_155, spend_month: 273_780, lifetime_spend: 2_842_330, accept_rate: 0.82, conversion_rate: 0.31, status: "active", description: "Tier-1 Medicare & ACA buyer with national coverage." },
  { id: "b_solar_united", name: "Solar United", organization: "SU Holdings Inc.", contact_name: "Marcus Johnson", contact_email: "leads@solarunited.example", bid_amount: 110, daily_cap: 300, monthly_cap: 8_500, concurrency_cap: 18, calls_today: 142, calls_month: 3_098, spend_today: 15_620, spend_month: 340_780, lifetime_spend: 1_540_220, accept_rate: 0.74, conversion_rate: 0.22, status: "active", description: "Roof-owner verified solar leads, 7-state coverage." },
  { id: "b_pinnacle_legal", name: "Pinnacle Legal Partners", organization: "Pinnacle Legal LLC", contact_name: "Deborah Carter", contact_email: "intake@pinnacle-legal.example", bid_amount: 320, daily_cap: 100, monthly_cap: 2_500, concurrency_cap: 8, calls_today: 38, calls_month: 891, spend_today: 12_160, spend_month: 285_120, lifetime_spend: 1_287_440, accept_rate: 0.61, conversion_rate: 0.18, status: "active", description: "Mass tort intake — talc and Roundup litigation." },
  { id: "b_meridian_auto", name: "Meridian Auto Insurance", organization: "Meridian Insurance Co.", contact_name: "Eric Vasquez", contact_email: "ops@meridian-auto.example", bid_amount: 42, daily_cap: 600, monthly_cap: 15_000, concurrency_cap: 30, calls_today: 264, calls_month: 5_812, spend_today: 11_088, spend_month: 244_104, lifetime_spend: 1_982_410, accept_rate: 0.88, conversion_rate: 0.34, status: "active", description: "Auto insurance high-intent national buyer." },
  { id: "b_hearthside", name: "Hearthside Roofing Network", organization: "Hearthside Brands", contact_name: "Mia Brennan", contact_email: "intake@hearthside.example", bid_amount: 92, daily_cap: 250, monthly_cap: 6_500, concurrency_cap: 15, calls_today: 96, calls_month: 2_205, spend_today: 8_832, spend_month: 202_860, lifetime_spend: 894_720, accept_rate: 0.79, conversion_rate: 0.38, status: "active", description: "Storm-damage roofing leads, 14-state network." },
  { id: "b_clearpath_debt", name: "Clearpath Debt Solutions", organization: "Clearpath Financial", contact_name: "Trevor Ng", contact_email: "trev@clearpath.example", bid_amount: 58, daily_cap: 350, monthly_cap: 9_000, concurrency_cap: 20, calls_today: 158, calls_month: 3_491, spend_today: 9_164, spend_month: 202_478, lifetime_spend: 758_330, accept_rate: 0.71, conversion_rate: 0.26, status: "active", description: "Consumer debt consultation — 50-state." },
  { id: "b_lighthouse_aca", name: "Lighthouse ACA Verification", organization: "Lighthouse Health", contact_name: "Priya Raman", contact_email: "priya@lighthouse-aca.example", bid_amount: 55, daily_cap: 400, monthly_cap: 11_000, concurrency_cap: 22, calls_today: 122, calls_month: 2_889, spend_today: 6_710, spend_month: 158_895, lifetime_spend: 620_140, accept_rate: 0.76, conversion_rate: 0.27, status: "active", description: "ACA subsidy + verification buyer." },
  { id: "b_atlas_finance", name: "Atlas Finance Group", organization: "Atlas Capital", contact_name: "Daniel Reyes", contact_email: "dan@atlasfin.example", bid_amount: 48, daily_cap: 200, monthly_cap: 5_500, concurrency_cap: 12, calls_today: 0, calls_month: 1_204, spend_today: 0, spend_month: 57_792, lifetime_spend: 412_990, accept_rate: 0.65, conversion_rate: 0.21, status: "paused", description: "Consolidation loan refi buyer (currently paused)." },
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
  { id: "p_redline", name: "Redline Media Group", organization: "Redline Media LLC", contact_email: "ops@redline-media.example", payout_rate: 0.65, calls_today: 412, calls_month: 9_211, revenue_today: 16_840, revenue_month: 372_220, pending_payout: 8_412, conversion_rate: 0.29, numbers_assigned: 38, status: "active" },
  { id: "p_blueprint", name: "Blueprint Lead Network", organization: "Blueprint Inc.", contact_email: "alex@blueprint.example", payout_rate: 0.55, calls_today: 298, calls_month: 7_104, revenue_today: 11_122, revenue_month: 268_440, pending_payout: 6_220, conversion_rate: 0.31, numbers_assigned: 24, status: "active" },
  { id: "p_apex_dial", name: "Apex Dialer Partners", organization: "Apex Dialer Co.", contact_email: "sam@apexdial.example", payout_rate: 0.7, calls_today: 188, calls_month: 4_492, revenue_today: 9_980, revenue_month: 224_240, pending_payout: 4_810, conversion_rate: 0.34, numbers_assigned: 18, status: "active" },
  { id: "p_summit_traffic", name: "Summit Traffic Inc.", organization: "Summit Holdings", contact_email: "ops@summit-traffic.example", payout_rate: 0.6, calls_today: 121, calls_month: 2_894, revenue_today: 5_220, revenue_month: 123_980, pending_payout: 2_290, conversion_rate: 0.27, numbers_assigned: 14, status: "active" },
  { id: "p_northstar", name: "Northstar Digital", organization: "Northstar Brands", contact_email: "intake@northstar.example", payout_rate: 0.55, calls_today: 84, calls_month: 1_998, revenue_today: 2_980, revenue_month: 72_140, pending_payout: 1_320, conversion_rate: 0.24, numbers_assigned: 9, status: "active" },
  { id: "p_offline_media", name: "Offline Media (Paused)", organization: "Offline Inc.", contact_email: "stop@offline.example", payout_rate: 0.5, calls_today: 0, calls_month: 412, revenue_today: 0, revenue_month: 14_440, pending_payout: 0, conversion_rate: 0.19, numbers_assigned: 2, status: "paused" },
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
  const rng = makeRng(40231);
  return seedBuyers().slice(0, 6).map((b, i) => ({
    id: `d_demo_${i.toString(36)}`,
    name: `${b.name} — Primary`,
    tfn: `+1${pick(AREA_CODES, rng)}${String(intRange(rng, 1_000_000, 9_999_999))}`,
    type: "phone",
    target_value: "+18005551234",
    buyer_id: b.id,
    buyer_name: b.name,
    status: "active",
    daily_cap: 200,
    monthly_cap: 6_000,
    concurrency_cap: 12,
    enabled: true,
    weight: 1,
    priority: 100 - i * 5,
    created_at: new Date(NOW - intRange(rng, 30, 200) * DAY).toISOString(),
  }));
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
      id: "rp_demo_health",
      name: "Health Insurance — Geo Split",
      description: "Routes by caller state, with cap-aware fallback.",
      status: "active",
      rule_type: "visual-graph",
      priority: 1,
      campaign_id: "c_health_001",
      campaign_name: "Medicare Open Enrollment 2026",
      created_at: new Date(NOW - 45 * DAY).toISOString(),
      updated_at: new Date(NOW - 3 * DAY).toISOString(),
      conditions: graphCondition(
        [
          { id: "inbound", type: "inbound", position: { x: 60, y: 120 }, data: { kind: "inbound", inbound: { campaignId: "c_health_001" } } },
          { id: "geo", type: "geoFilter", position: { x: 340, y: 120 }, data: { kind: "geoFilter", geoFilter: { mode: "allow", states: ["TX", "FL", "OH"] } } },
          { id: "buyer_apex", type: "buyer", position: { x: 620, y: 120 }, data: { kind: "buyer", buyer: { buyerId: "b_apex", buyerName: "Apex Insurance Group" } } },
        ],
        [
          { id: "e_inbound_geo", source: "inbound", target: "geo", sourceHandle: "out", targetHandle: "in" },
          { id: "e_geo_buyer", source: "geo", target: "buyer_apex", sourceHandle: "out", targetHandle: "in" },
        ],
      ),
      destinations: [
        { id: "dest_health_apex", buyer_id: "b_apex", buyer_name: "Apex Insurance Group", weight: 100, priority: 1 },
      ],
    },
    {
      id: "rp_demo_solar",
      name: "Solar — FICO + Hours",
      description: "Business-hours filter, then FICO 700+ buyer priority.",
      status: "active",
      rule_type: "visual-graph",
      priority: 1,
      campaign_id: "c_solar_001",
      campaign_name: "Solar — Homeowner 700+ FICO",
      created_at: new Date(NOW - 22 * DAY).toISOString(),
      updated_at: new Date(NOW - 1 * DAY).toISOString(),
      conditions: graphCondition(
        [
          { id: "inbound", type: "inbound", position: { x: 60, y: 120 }, data: { kind: "inbound", inbound: { campaignId: "c_solar_001" } } },
          { id: "hours", type: "hoursFilter", position: { x: 340, y: 120 }, data: { kind: "hoursFilter", hoursFilter: { days: [1, 2, 3, 4, 5], startHour: 9, endHour: 20 } } },
          { id: "buyer_solar", type: "buyer", position: { x: 620, y: 120 }, data: { kind: "buyer", buyer: { buyerId: "b_solar_united", buyerName: "Solar United" } } },
        ],
        [
          { id: "e_inbound_hours", source: "inbound", target: "hours", sourceHandle: "out", targetHandle: "in" },
          { id: "e_hours_buyer", source: "hours", target: "buyer_solar", sourceHandle: "out", targetHandle: "in" },
        ],
      ),
      destinations: [
        { id: "dest_solar_united", buyer_id: "b_solar_united", buyer_name: "Solar United", weight: 100, priority: 1 },
      ],
    },
    {
      id: "rp_demo_legal",
      name: "Legal Intake — Mass Tort",
      description: "Vertical-specific tag filter into Pinnacle Legal.",
      status: "draft",
      rule_type: "visual-graph",
      priority: 1,
      campaign_id: "c_legal_001",
      campaign_name: "Mass Tort Intake — Talc",
      created_at: new Date(NOW - 9 * DAY).toISOString(),
      updated_at: new Date(NOW - 2 * DAY).toISOString(),
      // No condition blob on purpose — this plan renders via
      // `synthesizeGraph`, rebuilding inbound → buyer from `destinations`
      // alone, the same as a rule created directly through the API.
      conditions: [],
      destinations: [
        { id: "dest_legal_pinnacle", buyer_id: "b_pinnacle_legal", buyer_name: "Pinnacle Legal Partners", weight: 100, priority: 1 },
      ],
    },
  ];
}

/* ─── IVR flows ────────────────────────────────────────────────────── */

export function seedIvrFlows() {
  return [
    {
      id: "ivr_demo_health",
      name: "Medicare — Pre-qualify",
      description: "Age 65+, ZIP capture, language routing.",
      status: "active",
      campaign_id: "c_health_001",
      campaign_name: "Medicare Open Enrollment 2026",
      language: "en",
      voice: "alloy",
      welcome_message: "Thanks for calling about Medicare coverage. Press 1 if you are 65 or older.",
      created_at: new Date(NOW - 30 * DAY).toISOString(),
    },
    {
      id: "ivr_demo_solar",
      name: "Solar — Homeowner Verify",
      description: "Confirms homeowner status before connecting.",
      status: "active",
      campaign_id: "c_solar_001",
      campaign_name: "Solar — Homeowner 700+ FICO",
      language: "en",
      voice: "echo",
      welcome_message: "Press 1 if you own your home. Press 2 if you rent.",
      created_at: new Date(NOW - 18 * DAY).toISOString(),
    },
    {
      id: "ivr_demo_legal",
      name: "Legal Intake — Plaintiff Screen",
      description: "Diagnosis date and product-use questions.",
      status: "draft",
      campaign_id: "c_legal_001",
      campaign_name: "Mass Tort Intake — Talc",
      language: "en",
      voice: "shimmer",
      welcome_message: "Thanks for your interest in joining the talc litigation.",
      created_at: new Date(NOW - 7 * DAY).toISOString(),
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

/**
 * Call CDR generator + analytics fixtures.
 *
 * The demo dashboard needs heavy volume + a clean business-hours bell
 * curve for visual impact (sketched by the client: low overnight, climbing
 * through morning, sharp peak around 3–4pm, taper into evening).
 *
 * Today gets ~3,000 calls; each of the past 13 days gets ~200 calls so
 * the 14-day chart reads full. Calls are generated once and cached in
 * module memory — not localStorage — so we don't blow the storage quota.
 */

import { makeRng, pick, intRange, range, chance } from "../rng";
import { currentBucket, bucketInt, bucketRange } from "../bucket";

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

const AREA_CODES = [
  "212", "415", "713", "404", "305", "303", "617", "773", "602", "206",
  "619", "512", "214", "503", "702", "615", "904", "210", "480", "813",
  "832", "972", "469", "646", "718", "323", "747", "424", "510", "925",
];
const STATES = ["TX", "CA", "FL", "NY", "PA", "OH", "IL", "GA", "NC", "MI", "WA", "AZ", "MA", "VA", "NJ", "CO"];

const CAMPAIGN_REFS = [
  { id: "c_health_001", name: "Medicare Open Enrollment 2026", payout: 65, weight: 16 },
  { id: "c_health_002", name: "ACA Subsidy Verification", payout: 55, weight: 12 },
  { id: "c_auto_001", name: "Auto Insurance — High Intent", payout: 42, weight: 18 },
  { id: "c_home_001", name: "Roofing Storm Damage", payout: 92, weight: 8 },
  { id: "c_home_002", name: "HVAC Installation Leads", payout: 75, weight: 10 },
  { id: "c_solar_001", name: "Solar — Homeowner 700+ FICO", payout: 110, weight: 7 },
  { id: "c_legal_001", name: "Mass Tort Intake — Talc", payout: 320, weight: 3 },
  { id: "c_legal_002", name: "Personal Injury Auto", payout: 180, weight: 5 },
  { id: "c_fin_001", name: "Debt Relief Consultation", payout: 58, weight: 11 },
];
const TOTAL_CAMPAIGN_WEIGHT = CAMPAIGN_REFS.reduce((s, c) => s + c.weight, 0);

const BUYER_REFS = [
  { id: "b_apex", name: "Apex Insurance Group" },
  { id: "b_solar_united", name: "Solar United" },
  { id: "b_pinnacle_legal", name: "Pinnacle Legal Partners" },
  { id: "b_meridian_auto", name: "Meridian Auto Insurance" },
  { id: "b_hearthside", name: "Hearthside Roofing Network" },
  { id: "b_clearpath_debt", name: "Clearpath Debt Solutions" },
  { id: "b_lighthouse_aca", name: "Lighthouse ACA Verification" },
];

const PUBLISHER_REFS = [
  { id: "p_redline", name: "Redline Media Group" },
  { id: "p_blueprint", name: "Blueprint Lead Network" },
  { id: "p_apex_dial", name: "Apex Dialer Partners" },
  { id: "p_summit_traffic", name: "Summit Traffic Inc." },
  { id: "p_northstar", name: "Northstar Digital" },
];

/**
 * Per-bucket hourly distribution.
 *
 * The chart shape rotates every 2h. Four parameters define each bucket's
 * distribution; together they produce a wide range of believable
 * day-shapes:
 *
 *   center      — hour of the peak (10am–5pm)
 *   leftWidth   — hours of ramp-up before the peak (2–5)
 *   rightWidth  — hours of fade-down after the peak (2–6)
 *   sharpness   — 1.3 flat plateau … 3.5 sharp peak
 *
 * Each hour's weight is `cos(πx/2)^sharpness` where x is the normalized
 * distance from center. Hours outside `[center-leftWidth, center+rightWidth]`
 * are zeroed so we get a clean compact arc, not a noisy 24-hour spread.
 */
function bucketHourWeights(): number[] {
  const center = bucketRange(31, 10, 17);
  const leftWidth = bucketRange(33, 2, 5);
  const rightWidth = bucketRange(35, 2, 6);
  const sharpness = bucketRange(37, 1.3, 3.5);

  const weights = new Array(24).fill(0);
  let sum = 0;
  for (let h = 0; h < 24; h++) {
    const dist = h - center;
    const width = dist < 0 ? leftWidth : rightWidth;
    if (Math.abs(dist) > width) continue;
    const x = Math.abs(dist) / width;
    const w = Math.pow(Math.cos((x * Math.PI) / 2), sharpness);
    weights[h] = w;
    sum += w;
  }
  // Normalize so weights sum to 1.0 (pickHour expects this).
  return sum > 0 ? weights.map((w) => w / sum) : weights;
}

function pickHour(rng: () => number, weights: number[]): number {
  let r = rng();
  for (let h = 0; h < 24; h++) {
    r -= weights[h];
    if (r <= 0) return h;
  }
  // Fallback — return the bucket's peak hour rather than a hardcoded 15.
  for (let h = 0; h < 24; h++) if (weights[h] > 0) return h;
  return 13;
}

function pickCampaign(rng: () => number) {
  let r = rng() * TOTAL_CAMPAIGN_WEIGHT;
  for (const c of CAMPAIGN_REFS) {
    r -= c.weight;
    if (r <= 0) return c;
  }
  return CAMPAIGN_REFS[0];
}

function makePhone(rng: () => number): string {
  const ac = pick(AREA_CODES, rng);
  const tail = String(intRange(rng, 1_000_000, 9_999_999)).padStart(7, "0");
  return `+1${ac}${tail}`;
}

/** Snap to local midnight of today. */
function startOfToday(): number {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export interface DemoCallWire {
  id: string;
  caller_number: string;
  destination_number: string;
  status: string;
  duration: number;
  is_qualified: boolean;
  caller_area_code: string;
  caller_state: string;
  caller_country: string;
  campaign_id: string;
  campaign_name: string;
  buyer_id: string;
  buyer_name: string;
  publisher_id: string;
  publisher_name: string;
  revenue: string;
  buyer_payout: string;
  publisher_payout: string;
  recording_url: string;
  created_at: string;
  tags: string[];
  notes: string;
}

/** ─── Cached corpus ──────────────────────────────────────────────────────
 *  Generated once per session, kept in module memory. Not persisted to
 *  localStorage (would blow the 5–10 MB quota at this volume). */

interface CorpusOptions {
  todayCount: number;
  pastDays: number;
  pastDailyAvg: number;
  /** Convert rate — fraction of calls that complete + actually pay out. */
  convertRate: number;
}

/**
 * Per-bucket options. Each bucket gets its own headline volume, convert
 * rate, and past-day average so the dashboard reads as a different kind of
 * day every 2 hours — some buckets are quiet (3K, 65% convert), some are
 * peak performance (12K, 92% convert).
 */
function optsForCurrentBucket(): CorpusOptions {
  return {
    todayCount: bucketInt(7, 3_000, 12_000),
    pastDays: 13,
    // Past-day average lives in a similar order of magnitude as today so
    // the 14-day chart doesn't have today as a single skyscraper bar.
    pastDailyAvg: bucketInt(13, 400, 900),
    convertRate: bucketRange(11, 0.65, 0.92),
  };
}

let CACHE: DemoCallWire[] | null = null;
let CACHE_BUCKET = -1;

export function getDemoCalls(): DemoCallWire[] {
  const bucket = currentBucket();
  if (CACHE && CACHE_BUCKET === bucket) return CACHE;
  CACHE = buildCorpus(optsForCurrentBucket());
  CACHE_BUCKET = bucket;
  return CACHE;
}

function buildCorpus(opts: CorpusOptions): DemoCallWire[] {
  // Seed is tied to the current bucket — same bucket gets the same call
  // contents (campaign winners, buyer mix, caller numbers), the next
  // bucket reshuffles.
  const rng = makeRng(202_606_26 + currentBucket() * 31);
  const start = startOfToday();
  const out: DemoCallWire[] = [];

  // Build today's hour distribution once per bucket; reuse it for past
  // days so the day-shape stays coherent across the 14-day view.
  const weights = bucketHourWeights();

  // ─── Today ───────────────────────────────────────────────────────────
  // We intentionally allow timestamps anywhere in today's 24h window —
  // including hours that haven't happened yet in wall-clock time. This is a
  // marketing demo: the dashboard should always look like a full active
  // business day, regardless of when the demo is opened.
  for (let i = 0; i < opts.todayCount; i++) {
    const hour = pickHour(rng, weights);
    const minute = intRange(rng, 0, 59);
    const second = intRange(rng, 0, 59);
    const ts = start + hour * HOUR + minute * 60_000 + second * 1000;
    out.push(makeCall(`today_${i.toString(36)}`, ts, rng, opts.convertRate));
  }

  // ─── Past N days ─────────────────────────────────────────────────────
  for (let dayOffset = 1; dayOffset <= opts.pastDays; dayOffset++) {
    // Slight day-to-day variation so the 14-day chart has shape.
    const dayCount = Math.round(opts.pastDailyAvg * range(rng, 0.7, 1.3));
    const dayStart = start - dayOffset * DAY;
    for (let i = 0; i < dayCount; i++) {
      const hour = pickHour(rng, weights);
      const minute = intRange(rng, 0, 59);
      const second = intRange(rng, 0, 59);
      const ts = dayStart + hour * HOUR + minute * 60_000 + second * 1000;
      out.push(makeCall(`d${dayOffset}_${i.toString(36)}`, ts, rng, opts.convertRate));
    }
  }

  // A handful of today's calls are still in flight — mirrors what a real
  // backend's "calls so far today" listing legitimately contains. Without
  // this, every call in the corpus is already resolved (completed or
  // failed), so anything reading "live" from this data — the Call Summary
  // table's Live column — is structurally stuck at 0 no matter what's
  // happening on the Live Monitor page.
  const liveNowCount = bucketInt(41, 3, 9);
  for (let i = 0; i < liveNowCount; i++) {
    const startedAt = Date.now() - intRange(rng, 5, 240) * 1000;
    out.push(makeLiveCall(`live_today_${i.toString(36)}`, startedAt, rng));
  }

  // Sort newest → oldest.
  out.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return out;
}

const LIVE_FAILURE_STATUSES = ["missed", "rejected", "failed"];
const LIVE_STATUSES = ["ringing", "in-progress", "in-progress", "in-progress"];

/** Builds a still-in-flight call record — shared by the Live Monitor feed
 *  and by the handful of "right now" rows seeded into today's corpus above,
 *  so both stay in sync if the shape of a live record ever changes. */
function makeLiveCall(idSuffix: string, startedAt: number, rng: () => number): DemoCallWire {
  const camp = pickCampaign(rng);
  const buyer = pick(BUYER_REFS, rng);
  const publisher = pick(PUBLISHER_REFS, rng);
  return {
    id: idSuffix,
    caller_number: makePhone(rng),
    destination_number: `+1800${String(intRange(rng, 5_550_000, 5_559_999))}`,
    status: pick(LIVE_STATUSES, rng),
    duration: Math.floor((Date.now() - startedAt) / 1000),
    // Still ringing or in-progress — qualification only applies once a call
    // has actually completed.
    is_qualified: false,
    caller_area_code: pick(AREA_CODES, rng),
    caller_state: pick(STATES, rng),
    caller_country: "US",
    campaign_id: camp.id,
    campaign_name: camp.name,
    buyer_id: buyer.id,
    buyer_name: buyer.name,
    publisher_id: publisher.id,
    publisher_name: publisher.name,
    revenue: "0.00",
    buyer_payout: "0.00",
    publisher_payout: "0.00",
    recording_url: "",
    created_at: new Date(startedAt).toISOString(),
    tags: [],
    notes: "",
  };
}

function makeCall(
  idSuffix: string,
  startedAt: number,
  rng: () => number,
  convertRate: number,
): DemoCallWire {
  const camp = pickCampaign(rng);
  const buyer = pick(BUYER_REFS, rng);
  const publisher = pick(PUBLISHER_REFS, rng);
  const isConverted = chance(rng, convertRate);
  const status: string = isConverted ? "completed" : pick(LIVE_FAILURE_STATUSES, rng);
  // Qualified is a narrower bar than "connected" — not every completed call
  // clears it (lead score, buyer confirmation, etc., in a real backend).
  // Demo data mirrors that instead of treating the two as identical, which
  // the duration-only fallback heuristic would otherwise always do here
  // (every completed demo call already runs ≥90s).
  const isQualified = isConverted && chance(rng, 0.7);
  const duration = isConverted
    ? intRange(rng, 90, 720)
    : status === "missed"
      ? intRange(rng, 5, 35)
      : intRange(rng, 1, 12);
  const revenue = isConverted ? camp.payout : 0;
  const publisherPayout = isConverted ? Math.round(camp.payout * 0.58) : 0;
  const areaCode = pick(AREA_CODES, rng);
  return {
    id: `call_${idSuffix}`,
    caller_number: makePhone(rng),
    destination_number: `+1800${String(intRange(rng, 5_550_000, 5_559_999))}`,
    status,
    duration,
    is_qualified: isQualified,
    caller_area_code: areaCode,
    caller_state: pick(STATES, rng),
    caller_country: "US",
    campaign_id: camp.id,
    campaign_name: camp.name,
    buyer_id: buyer.id,
    buyer_name: buyer.name,
    publisher_id: publisher.id,
    publisher_name: publisher.name,
    revenue: revenue.toFixed(2),
    buyer_payout: revenue.toFixed(2),
    publisher_payout: publisherPayout.toFixed(2),
    recording_url: isConverted ? `https://demo.avortyx.io/rec/${idSuffix}.mp3` : "",
    created_at: new Date(startedAt).toISOString(),
    tags: isConverted ? ["converted"] : [],
    notes: "",
  };
}

/* ─── Today-only filter helper for the live KPI snapshot ──────────────── */

function todaysCalls(): DemoCallWire[] {
  const start = startOfToday();
  return getDemoCalls().filter((c) => Date.parse(c.created_at) >= start);
}

/* ─── Live (in-flight) call snapshot ──────────────────────────────────── */

/** Number of in-flight calls "right now" — varies per bucket so the topbar
 *  LIVE pill changes across the day. */
export function liveCallsCount(): number {
  return bucketInt(3, 3, 25);
}

export function generateLiveCalls(count = liveCallsCount()): DemoCallWire[] {
  const rng = makeRng(7_777);
  const rows: DemoCallWire[] = [];
  for (let i = 0; i < count; i++) {
    const startedAt = Date.now() - intRange(rng, 5, 240) * 1000;
    rows.push(makeLiveCall(`live_${i.toString(36)}`, startedAt, rng));
  }
  return rows;
}

/* ─── Dashboard KPI snapshot ──────────────────────────────────────────── */
/* Returns the wire shape `/api/analytics/dashboard` is supposed to return —
 * derived live from the today corpus so the donut, charts, and KPI tiles
 * all tell the same story. */

export function dashboardSnapshot() {
  const today = todaysCalls();
  const totalToday = today.length;
  const completed = today.filter((c) => c.status === "completed").length;
  const dropped = totalToday - completed;
  const liveCount = liveCallsCount();
  const totalRevenue = today.reduce((s, c) => s + Number(c.revenue || 0), 0);
  const totalPayout = today.reduce((s, c) => s + Number(c.publisher_payout || 0), 0);
  const totalProfit = totalRevenue - totalPayout;
  const totalDuration = today.reduce((s, c) => s + (c.duration || 0), 0);
  const avgDuration = totalToday > 0 ? Math.round(totalDuration / totalToday) : 0;
  const spamBlocked = 412;
  const duplicateBlocked = 86;
  return {
    total_calls: getDemoCalls().length,
    calls_today: totalToday,
    live_calls: liveCount,
    completed_calls: completed,
    converted_calls: completed,
    conversion_rate: totalToday > 0 ? completed / totalToday : 0,
    total_revenue: totalRevenue.toFixed(2),
    total_payout: totalPayout.toFixed(2),
    total_profit: totalProfit.toFixed(2),
    avg_call_duration: avgDuration,
    spam_blocked: spamBlocked,
    duplicate_blocked: duplicateBlocked,
    // Bonus aggregates the donut/other widgets read directly.
    total_missed: today.filter((c) => c.status === "missed").length,
    total_rejected: today.filter((c) => c.status === "rejected").length,
    not_connected: dropped,
  };
}

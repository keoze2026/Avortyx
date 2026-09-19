/**
 * Call CDR generator + analytics fixtures.
 *
 * Today follows the client's demo dataset exactly (see `day-profile.ts`):
 * 6 500 calls between 08:00 and 17:00 with a fixed per-hour volume and a
 * fixed number of calls in flight per hour. The day is read against the
 * wall clock, so the portal's "today" totals climb through the day the
 * way the dataset's cumulative column does, and the Live figure follows
 * the slot the viewer is in. Each of the past 13 days reuses the same
 * hourly shape at a lower volume so the 14-day views read full.
 *
 * Calls are generated once per rotation bucket and cached in module
 * memory — not localStorage — so we don't blow the storage quota.
 */

import { makeRng, pick, intRange, chance } from "../rng";
import { currentBucket, bucketRange } from "../bucket";
import { seedDestinations } from "./entities";
import { daySlotsFor, dayTotalFor, hourWeights, liveTargetAt } from "./day-profile";
import { demoClock } from "../clock";
import { zonedDayKey } from "@/lib/format";

/**
 * The TFN each buyer's seeded destination answers on, so a demo call's
 * `destination_number` is a number that actually exists on the Destinations
 * page. Calls used to dial a made-up `+1800555xxxx`, which meant nothing on
 * the dashboard's Destinations table (keyed by TFN) could ever match a call
 * — every row read 0 calls / $0 no matter the day.
 */
const DESTINATION_TFN_BY_BUYER = new Map<string, string>(
  seedDestinations().map((d) => [d.buyer_id as string, d.tfn as string]),
);

function destinationFor(buyerId: string, rng: () => number): string {
  return DESTINATION_TFN_BY_BUYER.get(buyerId) ?? `+1800${String(intRange(rng, 5_550_000, 5_559_999))}`;
}

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
 * Which publishers/buyers actually work each campaign. Both used to be
 * picked fully independent of the campaign, which produced patternless
 * pairings — the same publisher showing up on Medicare, Roofing, and Mass
 * Tort calls back to back, or "Pinnacle Legal Partners" (a mass-tort buyer)
 * receiving a roofing lead. Real lead-gen networks specialize by vertical;
 * this is that specialization. A small wildcard chance (see
 * `pickAffiliated`) keeps the mix from looking too rigid.
 */
const CAMPAIGN_PUBLISHERS: Record<string, string[]> = {
  c_health_001: ["p_redline"],
  c_health_002: ["p_redline", "p_northstar"],
  c_auto_001: ["p_blueprint", "p_apex_dial"],
  c_home_001: ["p_blueprint", "p_summit_traffic"],
  c_home_002: ["p_blueprint", "p_summit_traffic"],
  c_solar_001: ["p_apex_dial"],
  c_legal_001: ["p_northstar"],
  c_legal_002: ["p_northstar"],
  c_fin_001: ["p_redline", "p_summit_traffic"],
};

const CAMPAIGN_BUYERS: Record<string, string[]> = {
  c_health_001: ["b_apex"],
  c_health_002: ["b_apex", "b_lighthouse_aca"],
  c_auto_001: ["b_meridian_auto"],
  c_home_001: ["b_hearthside"],
  c_home_002: ["b_hearthside"],
  c_solar_001: ["b_solar_united"],
  c_legal_001: ["b_pinnacle_legal"],
  c_legal_002: ["b_pinnacle_legal"],
  c_fin_001: ["b_clearpath_debt"],
};

const WILDCARD_CHANCE = 0.1;

function pickAffiliated<T extends { id: string }>(
  rng: () => number,
  refs: readonly T[],
  affinityMap: Record<string, string[]>,
  campaignId: string,
): T {
  const eligibleIds = affinityMap[campaignId];
  if (eligibleIds?.length && !chance(rng, WILDCARD_CHANCE)) {
    const id = pick(eligibleIds, rng);
    const match = refs.find((r) => r.id === id);
    if (match) return match;
  }
  return pick(refs, rng);
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

/** A small pool of callers who ring back — about one call in twelve comes
 *  from one of these, which is what puts real numbers in the Call Summary's
 *  Dupe column (a repeat caller to the same campaign within the range). */
const REPEAT_CALLERS: string[] = (() => {
  const rng = makeRng(4_242);
  return Array.from({ length: 60 }, () => makePhone(rng));
})();
const REPEAT_CALLER_RATE = 0.08;

function makeCallerNumber(rng: () => number): string {
  return chance(rng, REPEAT_CALLER_RATE) ? pick(REPEAT_CALLERS, rng) : makePhone(rng);
}

/** Midnight today in the report timezone (the demo's business-day clock). */
function startOfToday(): number {
  return demoClock().startOfToday;
}

export interface DemoCallWire {
  id: string;
  caller_number: string;
  destination_number: string;
  status: string;
  duration: number;
  is_qualified: boolean;
  /** Repeat caller to the same campaign earlier in the day (set once the
   *  day's corpus is built — see `flagDuplicates`). */
  is_duplicate?: boolean;
  /** Backend's converted / spam verdicts (filterable on the call log). */
  is_converted?: boolean;
  is_spam?: boolean;
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
  pastDays: number;
  /** Convert rate — fraction of calls that complete + actually pay out. */
  convertRate: number;
}

/**
 * Per-bucket options. Each day's volume and shape are fixed by the dataset
 * (5 000–6 500 calls on the profile's hour curve, picked per date); what
 * still rotates every 2 hours is the convert rate, so the demo doesn't
 * read as a static screenshot.
 */
function optsForCurrentBucket(): CorpusOptions {
  return {
    pastDays: 13,
    convertRate: bucketRange(11, 0.65, 0.92),
  };
}

let CACHE: DemoCallWire[] | null = null;
let CACHE_KEY = "";

/**
 * Every call on the books right now. The full day is generated once per
 * bucket; what's returned is the slice that has happened by the wall
 * clock — a call scheduled for 15:20 doesn't exist at 09:00 — so the
 * cumulative totals grow through the day exactly like the dataset.
 */
export function getDemoCalls(): DemoCallWire[] {
  // Rebuilt when the rotation bucket rolls, and whenever the report
  // timezone (which fixes where "today" starts) or the day changes.
  const clock = demoClock();
  const key = `${currentBucket()}|${clock.timeZone}|${clock.dayKey}`;
  if (!CACHE || CACHE_KEY !== key) {
    CACHE = buildCorpus(optsForCurrentBucket());
    CACHE_KEY = key;
  }
  const now = Date.now();
  return CACHE.filter((c) => Date.parse(c.created_at) <= now);
}

function buildCorpus(opts: CorpusOptions): DemoCallWire[] {
  // Seed is tied to the current bucket — same bucket gets the same call
  // contents (campaign winners, buyer mix, caller numbers), the next
  // bucket reshuffles.
  const rng = makeRng(202_606_26 + currentBucket() * 31);
  const start = startOfToday();
  const out: DemoCallWire[] = [];

  // The dataset's hour shape, shared by today and the history so the
  // 14-day view stays coherent.
  const weights = hourWeights();

  // ─── Today ───────────────────────────────────────────────────────────
  // The dataset's curve scaled to today's total (5 000–6 500, fixed per
  // date): 08:00–17:00 with each hour's own count, uniformly placed inside
  // its hour. `getDemoCalls()` then hides the ones that haven't happened
  // yet.
  const clock = demoClock();
  let n = 0;
  for (const slot of daySlotsFor(clock.dayKey)) {
    for (let i = 0; i < slot.calls; i++, n++) {
      const minute = intRange(rng, 0, 59);
      const second = intRange(rng, 0, 59);
      const ts = start + slot.hour * HOUR + minute * 60_000 + second * 1000;
      out.push(makeCall(`today_${n.toString(36)}`, ts, rng, opts.convertRate));
    }
  }

  // ─── Past N days ─────────────────────────────────────────────────────
  for (let dayOffset = 1; dayOffset <= opts.pastDays; dayOffset++) {
    // Each past day ends on its own figure inside the 5 000–6 500 band, so
    // yesterday never matches today and the 14-day chart has shape.
    const dayStart = start - dayOffset * DAY;
    const dayCount = dayTotalFor(zonedDayKey(dayStart + 12 * HOUR, clock.timeZone));
    for (let i = 0; i < dayCount; i++) {
      const hour = pickHour(rng, weights);
      const minute = intRange(rng, 0, 59);
      const second = intRange(rng, 0, 59);
      const ts = dayStart + hour * HOUR + minute * 60_000 + second * 1000;
      out.push(makeCall(`d${dayOffset}_${i.toString(36)}`, ts, rng, opts.convertRate));
    }
  }

  // Sort newest → oldest.
  out.sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  flagDuplicates(out);
  return out;
}

/** Mark every call whose caller already rang the same campaign earlier the
 *  same day. Walks oldest → newest so the first call is the original. */
function flagDuplicates(calls: DemoCallWire[]): void {
  const seen = new Set<string>();
  for (let i = calls.length - 1; i >= 0; i--) {
    const c = calls[i];
    const key = `${c.campaign_id}|${c.caller_number}|${c.created_at.slice(0, 10)}`;
    c.is_duplicate = seen.has(key);
    seen.add(key);
  }
}

/** Demo-only price: every call bills $1 of revenue; every connected call
 *  pays out $1 (client spec — "revenue = total calls, payout = connected"). */
const DEMO_PRICE_PER_CALL = 1;

/** Average connected-call length for the current bucket: 17–21 minutes. */
const ACL_CENTER_SEC = () => Math.round(bucketRange(43, 17 * 60, 21 * 60));

const LIVE_FAILURE_STATUSES = ["missed", "rejected", "failed"];
const LIVE_STATUSES = ["ringing", "in-progress", "in-progress", "in-progress"];

/** Builds a still-in-flight call record — shared by the Live Monitor feed
 *  and by the handful of "right now" rows seeded into today's corpus above,
 *  so both stay in sync if the shape of a live record ever changes. */
function makeLiveCall(idSuffix: string, startedAt: number, rng: () => number): DemoCallWire {
  const camp = pickCampaign(rng);
  const buyer = pickAffiliated(rng, BUYER_REFS, CAMPAIGN_BUYERS, camp.id);
  const publisher = pickAffiliated(rng, PUBLISHER_REFS, CAMPAIGN_PUBLISHERS, camp.id);
  return {
    id: idSuffix,
    caller_number: makePhone(rng),
    destination_number: destinationFor(buyer.id, rng),
    status: pick(LIVE_STATUSES, rng),
    duration: Math.floor((Date.now() - startedAt) / 1000),
    // Still ringing or in-progress — qualification only applies once a call
    // has actually completed.
    is_qualified: false,
    is_converted: false,
    is_spam: false,
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
  const buyer = pickAffiliated(rng, BUYER_REFS, CAMPAIGN_BUYERS, camp.id);
  const publisher = pickAffiliated(rng, PUBLISHER_REFS, CAMPAIGN_PUBLISHERS, camp.id);
  const isConverted = chance(rng, convertRate);
  const status: string = isConverted ? "completed" : pick(LIVE_FAILURE_STATUSES, rng);
  // Qualified is a narrower bar than "connected" — not every completed call
  // clears it (lead score, buyer confirmation, etc., in a real backend).
  // Demo data mirrors that instead of treating the two as identical, which
  // the duration-only fallback heuristic would otherwise always do here
  // (every completed demo call already runs ≥90s).
  const isQualified = isConverted && chance(rng, 0.7);
  // Connected calls average 17–21 minutes (the client's target AHT for the
  // demo). The centre is picked per rotation bucket so the ACL column
  // reads a slightly different figure every couple of hours, and each
  // call sits within ±7 minutes of it. Missed / rejected stay short.
  const duration = isConverted
    ? intRange(rng, ACL_CENTER_SEC() - 420, ACL_CENTER_SEC() + 420)
    : status === "missed"
      ? intRange(rng, 5, 35)
      : intRange(rng, 1, 12);
  // Demo economics (client spec): a flat $1 per call. Revenue accrues on
  // every call that comes in (total calls × $1); payout is only owed on
  // connected calls (connected calls × $1). Profit is therefore the
  // no-answer count in dollars.
  const revenue = DEMO_PRICE_PER_CALL;
  const payout = isConverted ? DEMO_PRICE_PER_CALL : 0;
  const areaCode = pick(AREA_CODES, rng);
  return {
    id: `call_${idSuffix}`,
    caller_number: makeCallerNumber(rng),
    destination_number: destinationFor(buyer.id, rng),
    status,
    duration,
    is_qualified: isQualified,
    is_converted: isConverted,
    is_spam: false,
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
    buyer_payout: payout.toFixed(2),
    publisher_payout: payout.toFixed(2),
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

/** Number of in-flight calls "right now" — the dataset's live figure for
 *  the current hour (0 outside 08:00–17:00). */
export function liveCallsCount(): number {
  return liveTargetAt();
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

/* ─── Per-destination counters ───────────────────────────────────────── */
/* What the backend puts on every `/api/destinations/` row: today's call
 * count and the number in flight, keyed by the destination's TFN. Today's
 * count includes live calls — the whole point of the field is that a
 * completed-call log can't. */

export interface DestinationCounters {
  daily_calls: number;
  live_calls: number;
  daily_revenue: number;
  daily_spend: number;
}

export function destinationCounters(): Map<string, DestinationCounters> {
  const map = new Map<string, DestinationCounters>();
  const bump = (c: DemoCallWire, live: boolean) => {
    const row = map.get(c.destination_number) ?? { daily_calls: 0, live_calls: 0, daily_revenue: 0, daily_spend: 0 };
    row.daily_calls += 1;
    if (live) row.live_calls += 1;
    row.daily_revenue += Number(c.revenue || 0);
    row.daily_spend += Number(c.publisher_payout || 0);
    map.set(c.destination_number, row);
  };
  for (const c of todaysCalls()) bump(c, false);
  for (const c of generateLiveCalls()) bump(c, true);
  return map;
}

/* ─── Per-campaign counters ──────────────────────────────────────────── */
/* Read-only aggregates the backend puts on every `/api/campaigns/` row,
 * derived from the same corpus so the Campaigns table's LIVE / DAILY /
 * MONTHLY / GLOBAL columns and revenue agree with the dashboard. */

export interface CampaignCounters {
  live_calls: number;
  hourly_calls: number;
  daily_calls: number;
  monthly_calls: number;
  global_calls: number;
  daily_revenue: number;
}

export function campaignCounters(): Map<string, CampaignCounters> {
  const map = new Map<string, CampaignCounters>();
  const row = (id: string) => {
    let r = map.get(id);
    if (!r) {
      r = { live_calls: 0, hourly_calls: 0, daily_calls: 0, monthly_calls: 0, global_calls: 0, daily_revenue: 0 };
      map.set(id, r);
    }
    return r;
  };
  const clock = demoClock();
  const dayStart = clock.startOfToday;
  const hourStart = dayStart + clock.hour * HOUR;
  const monthStart = clock.startOfMonth;
  for (const c of getDemoCalls()) {
    const r = row(c.campaign_id);
    const ts = Date.parse(c.created_at);
    r.global_calls += 1;
    if (ts >= monthStart) r.monthly_calls += 1;
    if (ts >= dayStart) {
      r.daily_calls += 1;
      r.daily_revenue += Number(c.revenue || 0);
    }
    if (ts >= hourStart) r.hourly_calls += 1;
  }
  for (const c of generateLiveCalls()) {
    const r = row(c.campaign_id);
    r.live_calls += 1;
    r.daily_calls += 1;
    r.hourly_calls += 1;
    r.monthly_calls += 1;
    r.global_calls += 1;
  }
  return map;
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

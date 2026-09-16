/**
 * Destinations service — /api/destinations/*.
 *
 * Endpoints (confirmed by backend dev, June 2026):
 *   GET    /api/destinations/?page=&page_size=&status=&buyer_id=&search=
 *   GET    /api/destinations/stats/   → header roll-ups across the org
 *   GET    /api/destinations/{id}/
 *   POST   /api/destinations/
 *   PATCH  /api/destinations/{id}/    (also toggles enabled via { enabled })
 *   DELETE /api/destinations/{id}/
 *
 * A Destination is a buyer-owned dial target with name, TFN/SIP URI, caps,
 * filters, business hours, and live usage counters. The wire shape mirrors
 * the frontend `Destination` type via the case-adapter; usage counters and
 * `buyer_name` are read-only echoes.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";
import type {
  BusinessHourSlot,
  Destination,
  DestinationForwardType,
  FilterGroup,
} from "@/lib/types";

/* ─── Frontend shapes (in addition to the canonical Destination type) ─── */

export interface DestinationStats {
  activeLive: number;
  totalLive: number;
  totalCC: number;
  activeTfns: number;
  vacantCC: number;
}

export interface DestinationListQuery {
  page?: number;
  pageSize?: number;
  status?: "all" | "enabled" | "disabled";
  buyerId?: string;
  search?: string;
}

/* ─── Wire shapes ─────────────────────────────────────────────────────── */

/**
 * A destination row as the backend serialises it. Two spellings are in
 * circulation and both are read:
 *
 *   contract §3.9            aggregate row (backend dev, Sep 2026)
 *   ───────────────          ─────────────────────────────────────
 *   tfn                      destination
 *   name                     (absent → the number is the label)
 *   buyer_id / buyer_name    buyer  (name only)
 *   daily_cap                max_calls_daily
 *   enabled                  status ("active" | …)
 *   daily_calls              calls_today
 *   hourly_/daily_/monthly_/global_revenue, hourly_/daily_/global_spend
 */
interface DestinationWire {
  id: string | number;
  buyerId?: string | number | null;
  buyerName?: string;
  /** Aggregate-row spelling of `buyer_name`. */
  buyer?: string;
  tfn?: string;
  /** Aggregate-row spelling of `tfn`. */
  destination?: string;
  name?: string;
  /** Aggregate-row spelling of `enabled` — "active" means enabled. */
  status?: string;
  /**
   * Canonical wire field is `routing_type` (camelCased to `routingType` by
   * the http layer). Backend enum: `external` | `sip`.
   *
   * We also tolerate legacy `forward_type` echoes from older responses —
   * either field is read on the way in and mapped to the FE's
   * `DestinationForwardType` (`number` | `sip`) below.
   */
  routingType?: string;
  forwardType?: string;
  concurrencyCap?: number;
  maxConcurrency?: number;
  hourlyCap?: number;
  maxCallsHourly?: number;
  dailyCap?: number;
  maxCallsDaily?: number;
  monthlyCap?: number;
  maxCallsMonthly?: number;
  globalCap?: number;
  maxCallsGlobal?: number;
  enabled?: boolean;
  ringDurationSec?: number;
  timezone?: string | null;
  /* ── Read-only aggregates computed from the Call table. Every counter is
   *    accepted under both the `<period>_calls` spelling (contract §3.9) and
   *    the `calls_<period>` spelling some responses use, so a rename on the
   *    backend never silently zeroes a column again. Money fields arrive as
   *    decimal strings or numbers. ── */
  liveCalls?: number;
  hourlyCalls?: number;
  callsHour?: number;
  dailyCalls?: number;
  callsToday?: number;
  monthlyCalls?: number;
  callsMonth?: number;
  globalCalls?: number;
  callsGlobal?: number;
  hourlyRevenue?: number | string;
  revenueHour?: number | string;
  dailyRevenue?: number | string;
  revenueToday?: number | string;
  revenue?: number | string;
  monthlyRevenue?: number | string;
  revenueMonth?: number | string;
  globalRevenue?: number | string;
  revenueGlobal?: number | string;
  lifetimeRevenue?: number | string;
  hourlySpend?: number | string;
  dailySpend?: number | string;
  spendToday?: number | string;
  spend?: number | string;
  monthlySpend?: number | string;
  spendMonth?: number | string;
  globalSpend?: number | string;
  lifetimeSpend?: number | string;
  filterEnabled?: boolean;
  filterGroups?: FilterGroup[];
  businessHoursEnabled?: boolean;
  businessHourSlots?: BusinessHourSlot[];
  createdAt?: string;
  updatedAt?: string;
}

interface DestinationStatsWire {
  activeLive: number;
  totalLive: number;
  totalCc: number;
  activeTfns: number;
  vacantCc: number;
}

/* ─── Mappers ─────────────────────────────────────────────────────────── */

/**
 * The backend enum is `external` | `sip`; the FE type is the older
 * `number` | `sip`. Map at the wire boundary so the rest of the app
 * doesn't need to learn the new vocabulary.
 */
function normalizeForwardType(raw: string | null | undefined): DestinationForwardType {
  const v = (raw ?? "").toLowerCase();
  return v === "sip" ? "sip" : "number";
}

/** FE forward type → wire `routing_type` enum (`external` | `sip`). */
function forwardTypeToWire(t: DestinationForwardType | undefined): "external" | "sip" | undefined {
  if (t === "sip") return "sip";
  if (t === "number") return "external";
  return undefined; // unknown / empty → omit so backend default kicks in
}

/** Decimal-string-or-number → number; anything unparseable → 0. */
function toNum(v: number | string | null | undefined): number {
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** First defined value among the accepted spellings of one aggregate. */
function firstOf(...values: Array<number | string | null | undefined>): number {
  for (const v of values) if (v !== undefined && v !== null) return toNum(v);
  return 0;
}

function wireToDestination(w: DestinationWire): Destination {
  const tfn = w.tfn ?? w.destination ?? "";
  return {
    id: String(w.id),
    buyerId: w.buyerId != null ? String(w.buyerId) : "",
    buyerName: w.buyerName ?? w.buyer ?? undefined,
    tfn,
    // The aggregate row has no separate label — the number is the name.
    name: w.name ?? tfn,
    // Prefer the canonical `routing_type` field; fall back to legacy
    // `forward_type` if the backend ever echoes it instead.
    forwardType: normalizeForwardType(w.routingType ?? w.forwardType),
    concurrencyCap: w.concurrencyCap ?? w.maxConcurrency ?? 0,
    dailyCap: w.dailyCap ?? w.maxCallsDaily ?? 0,
    monthlyCap: w.monthlyCap ?? w.maxCallsMonthly ?? 0,
    // `enabled` on the contract shape; `status: "active"` on the aggregate
    // row. A row with neither is treated as enabled — it was returned.
    enabled: w.enabled ?? (w.status ? w.status.toLowerCase() === "active" : true),
    ringDurationSec: w.ringDurationSec ?? 25,
    filterEnabled: !!w.filterEnabled,
    filterGroups: Array.isArray(w.filterGroups) ? w.filterGroups : [],
    businessHoursEnabled: !!w.businessHoursEnabled,
    businessHourSlots: Array.isArray(w.businessHourSlots) ? w.businessHourSlots : [],
    timezone: w.timezone ?? undefined,
    // These were already declared on `DestinationWire` above but never
    // actually read here — the Destinations table's LIVE/HOURLY/DAILY/
    // MONTHLY/GLOBAL columns were instead deriving their own counts
    // client-side from the calls cache, which structurally can't contain
    // ringing/in-progress rows (that cache is a completed-call log). Wiring
    // these through is what actually fixes the LIVE column.
    liveCalls: w.liveCalls ?? 0,
    hourlyCalls: firstOf(w.hourlyCalls, w.callsHour),
    // The dashboard's Destinations table and the destination detail stats
    // show these for "today" directly — no client-side tally of the calls
    // cache, which holds completed calls only.
    dailyCalls: firstOf(w.dailyCalls, w.callsToday),
    monthlyCalls: firstOf(w.monthlyCalls, w.callsMonth),
    globalCalls: firstOf(w.globalCalls, w.callsGlobal),
    // Money aggregates. These were never read before, which is why every
    // "Revenue today" figure derived from a destination sat at $0.
    hourlyRevenue: firstOf(w.hourlyRevenue, w.revenueHour),
    dailyRevenue: firstOf(w.dailyRevenue, w.revenueToday, w.revenue),
    monthlyRevenue: firstOf(w.monthlyRevenue, w.revenueMonth),
    globalRevenue: firstOf(w.globalRevenue, w.revenueGlobal, w.lifetimeRevenue),
    hourlySpend: toNum(w.hourlySpend),
    dailySpend: firstOf(w.dailySpend, w.spendToday, w.spend),
    monthlySpend: firstOf(w.monthlySpend, w.spendMonth),
    globalSpend: firstOf(w.globalSpend, w.lifetimeSpend),
  };
}

/** Build a writable subset of the wire shape from a Destination patch.
 *  Skips read-only / computed fields (live counters, buyer_name, timestamps). */
function destinationToWire(patch: Partial<Destination>): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  // buyerId is optional — empty string means "no buyer assigned yet", send
  // null so the backend stores an unassigned destination.
  if (patch.buyerId !== undefined) {
    body.buyerId = patch.buyerId === "" ? null : patch.buyerId;
  }
  if (patch.tfn !== undefined) body.tfn = patch.tfn;
  if (patch.name !== undefined) body.name = patch.name;
  // Backend schema: `routing_type` is enum (`external` | `sip`). Empty
  // string fails validation, so we omit the field entirely when the FE
  // value is missing / unknown and let the backend's `external` default
  // kick in.
  if (patch.forwardType !== undefined) {
    const mapped = forwardTypeToWire(patch.forwardType);
    if (mapped !== undefined) body.routingType = mapped;
  }
  if (patch.concurrencyCap !== undefined) body.concurrencyCap = patch.concurrencyCap;
  if (patch.dailyCap !== undefined) body.dailyCap = patch.dailyCap;
  if (patch.monthlyCap !== undefined) body.monthlyCap = patch.monthlyCap;
  if (patch.enabled !== undefined) body.enabled = patch.enabled;
  if (patch.ringDurationSec !== undefined) body.ringDurationSec = patch.ringDurationSec;
  if (patch.timezone !== undefined) body.timezone = patch.timezone ?? null;
  if (patch.filterEnabled !== undefined) body.filterEnabled = patch.filterEnabled;
  if (patch.filterGroups !== undefined) body.filterGroups = patch.filterGroups;
  if (patch.businessHoursEnabled !== undefined) body.businessHoursEnabled = patch.businessHoursEnabled;
  if (patch.businessHourSlots !== undefined) body.businessHourSlots = patch.businessHourSlots;
  return body;
}

/* ─── Public service ──────────────────────────────────────────────────── */

export const destinationsService = {
  async list(query: DestinationListQuery = {}): Promise<Paginated<Destination>> {
    const res = await http.get<Paginated<DestinationWire>>("/api/destinations/", { query });
    return { ...res, items: res.items.map(wireToDestination) };
  },

  async get(id: string): Promise<Destination> {
    return wireToDestination(await http.get<DestinationWire>(`/api/destinations/${id}/`));
  },

  async create(input: Omit<Destination, "id">): Promise<Destination> {
    return wireToDestination(
      await http.post<DestinationWire>("/api/destinations/", { body: destinationToWire(input) }),
    );
  },

  async update(id: string, patch: Partial<Destination>): Promise<Destination> {
    return wireToDestination(
      await http.patch<DestinationWire>(`/api/destinations/${id}/`, {
        body: destinationToWire(patch),
      }),
    );
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/api/destinations/${id}/`);
  },

  async setEnabled(id: string, enabled: boolean): Promise<Destination> {
    return wireToDestination(
      await http.patch<DestinationWire>(`/api/destinations/${id}/`, { body: { enabled } }),
    );
  },

  async stats(): Promise<DestinationStats> {
    const w = await http.get<DestinationStatsWire>("/api/destinations/stats/");
    return {
      activeLive: w.activeLive ?? 0,
      totalLive: w.totalLive ?? 0,
      totalCC: w.totalCc ?? 0,
      activeTfns: w.activeTfns ?? 0,
      vacantCC: w.vacantCc ?? 0,
    };
  },
};

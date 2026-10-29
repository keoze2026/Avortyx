/**
 * Buyers service — talks to /api/buyers/*.
 *
 * Returns frontend-shaped `Buyer` objects so the store can drop them
 * straight into state without further translation. Stats fields the list
 * endpoint doesn't return default to 0 — Phase 2 will hydrate them from
 * the per-buyer /stats endpoint when the user opens a buyer detail page.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";
import type { Buyer, BuyerPayoutModel, BuyerStatus } from "@/lib/types";

/* ─── Wire shapes (post case-adapter) ─────────────────────────────────── */

interface BuyerListWire {
  id: string;
  name: string;
  status: string;
  routingType: string;
  phoneNumber: string;
  payoutAmount: string;
  createdAt: string;
  /** Read-only echo of the workspace the buyer belongs to. Backend confirmed
   *  this field is returned (snake-case `organization_name` → camelCase here)
   *  and must NOT be sent in any create/update body. */
  organizationName?: string;
  /** Editable fields the backend now persists end-to-end. `contactEmail` is
   *  the snake_case `contact_email` after the http layer's adapter — the FE
   *  type calls this `email`, mapped 1:1 below. */
  contactName?: string;
  contactEmail?: string;
  payoutModel?: string;
  /** Read-only usage counters. Read here when present so a backend that
   *  includes them on the list (the same pattern as campaigns/destinations)
   *  lights the table up without a second round-trip.
   *  `GET /api/buyers/{id}/stats` is the authoritative source and is merged
   *  in on the detail page. Same wire family as the stats payload. */
  liveCalls?: number;
  hourlyCalls?: number;
  dailyCalls?: number;
  monthlyCalls?: number;
  globalCalls?: number;
  hourlySpend?: number | string;
  dailySpend?: number | string;
  monthlySpend?: number | string;
  globalSpend?: number | string;
  /** List spellings of the four windows (see BuyerStatsWire). */
  callsHourly?: number;
  callsGlobal?: number;
  spendHourly?: number | string;
  spendGlobal?: number | string;
  /** The buyer's concurrent-call (CC) limit - `Buyer.max_concurrency`, the
   *  field routing checks. 0 = unlimited. Read when the list carries it. */
  maxConcurrency?: number;
  /** Legacy spellings — still read as fallbacks. */
  callsToday?: number;
  callsMonth?: number;
  spendToday?: number | string;
  spendMonth?: number | string;
  lifetimeSpend?: number | string;
  totalSpend?: number | string;
  acceptRate?: number;
  conversionRate?: number;
  /** CH-405: caps, cap usage and TFN caps on each list row. */
  dailyCap?: number;
  monthlyCap?: number;
  capUsedToday?: number;
  capUsedMonth?: number;
  tfnCount?: number;
  tfnCapTotal?: number;
  tfnUncapped?: number;
}

interface BuyerWire extends BuyerListWire {
  description?: string;
  sipEndpoint?: string;
  minCallDuration?: number;
  dupWindowDays?: number;
  qualityScore?: number;
  /** FK reference (uuid). Read-only — display via `organizationName` above. */
  organizationId?: string;
  createdById?: string | null;
  cap?: {
    daily?: number;
    monthly?: number;
    concurrency?: number;
  } | null;
  campaigns?: Array<{ campaignId: string; campaignName?: string }>;
}

/**
 * `GET /api/buyers/{id}/stats` (and the same fields inlined on list rows).
 *
 * Wire family (camelCased by the http layer):
 *   live_calls · hourly_calls · daily_calls · monthly_calls · global_calls
 *   hourly_spend · daily_spend · monthly_spend · global_spend
 * The older `calls_today` / `spend_today` / `lifetime_spend` spellings are
 * accepted as fallbacks. Previously only the legacy names were declared,
 * so every real payload fell through to the 0 default.
 */
interface BuyerStatsWire {
  /** Spellings used by the buyers LIST (`GET /api/buyers/`): calls_hourly,
   *  calls_today, calls_month, calls_global, spend_hourly, spend_today,
   *  spend_month, spend_global - all four windows for every row in one call. */
  callsHourly?: number;
  callsGlobal?: number;
  spendHourly?: number | string;
  spendGlobal?: number | string;
  liveCalls?: number;
  hourlyCalls?: number;
  dailyCalls?: number;
  monthlyCalls?: number;
  globalCalls?: number;
  hourlySpend?: number | string;
  dailySpend?: number | string;
  monthlySpend?: number | string;
  globalSpend?: number | string;
  callsToday?: number;
  callsMonth?: number;
  spendToday?: number | string;
  spendMonth?: number | string;
  lifetimeSpend?: number | string;
  totalSpend?: number | string;
  acceptRate?: number;
  conversionRate?: number;
}

/** The slice of `Buyer` that `GET /api/buyers/{id}/stats` refreshes. */
export type BuyerStats = Pick<
  Buyer,
  | "liveCalls"
  | "hourlyCalls"
  | "callsToday"
  | "callsMonth"
  | "globalCalls"
  | "hourlySpend"
  | "spendToday"
  | "spendMonth"
  | "lifetimeSpend"
  | "acceptRate"
  | "conversionRate"
>;

/** Rates arrive as either a 0..1 fraction or a 0..100 percentage depending
 *  on the endpoint; normalise to the 0..1 the FE type uses. */
function toRate(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return v > 1 ? v / 100 : v;
}

/** First defined value among the accepted spellings of one aggregate. */
function firstOf(...values: Array<number | string | null | undefined>): number {
  for (const v of values) if (v !== undefined && v !== null) return toNum(v);
  return 0;
}

function statsWireToStats(w: BuyerStatsWire): BuyerStats {
  return {
    liveCalls: w.liveCalls ?? 0,
    hourlyCalls: firstOf(w.callsHourly, w.hourlyCalls),
    callsToday: firstOf(w.dailyCalls, w.callsToday),
    callsMonth: firstOf(w.monthlyCalls, w.callsMonth),
    globalCalls: firstOf(w.callsGlobal, w.globalCalls),
    hourlySpend: firstOf(w.spendHourly, w.hourlySpend),
    spendToday: firstOf(w.dailySpend, w.spendToday),
    spendMonth: firstOf(w.monthlySpend, w.spendMonth),
    lifetimeSpend: firstOf(w.spendGlobal, w.globalSpend, w.lifetimeSpend, w.totalSpend),
    acceptRate: toRate(w.acceptRate),
    conversionRate: toRate(w.conversionRate),
  };
}

/* ─── Mappers ─────────────────────────────────────────────────────────── */

function normalizeStatus(raw: string | null | undefined): BuyerStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paused" || s === "capped" || s === "pending") return s;
  return "active";
}

function toNum(s: string | number | undefined, fallback = 0): number {
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function normalizePayoutModel(raw: string | undefined): BuyerPayoutModel {
  return raw?.toLowerCase() === "tiered" ? "tiered" : "flat";
}

function listWireToBuyer(w: BuyerListWire): Buyer {
  return {
    id: w.id,
    name: w.name,
    // Read-only echo from the backend's `organization_name` field. The FE
    // never sends this back; the user can only see it.
    organization: w.organizationName ?? "",
    contactName: w.contactName,
    // Wire field is `contact_email`; the FE type calls this `email` (the
    // user's email for contacting the buyer, not their login email).
    email: w.contactEmail,
    status: normalizeStatus(w.status),
    bidAmount: toNum(w.payoutAmount),
    payoutModel: normalizePayoutModel(w.payoutModel),
    concurrencyCap: typeof w.maxConcurrency === "number" ? w.maxConcurrency : 0,
    concurrencyKnown: typeof w.maxConcurrency === "number",
    dailyCap: w.dailyCap ?? 0,
    monthlyCap: w.monthlyCap ?? 0,
    capUsedToday: w.capUsedToday,
    capUsedMonth: w.capUsedMonth,
    tfnCount: w.tfnCount,
    tfnCapTotal: w.tfnCapTotal,
    tfnUncapped: w.tfnUncapped,
    // Usage counters: read off the list payload when the backend includes
    // them (0 otherwise) — these used to be hardcoded to 0 regardless of
    // what the response carried.
    ...statsWireToStats(w),
    // The list carries the spend windows (the buyers list endpoint now does),
    // so the page needs no per-buyer /stats calls.
    statsFromList:
      (w.spendHourly ?? w.hourlySpend) !== undefined && (w.dailySpend ?? w.spendToday) !== undefined,
    // Live calls are shown only when the list sends them; otherwise the row
    // shows just the CC limit instead of a made-up 0.
    liveKnown: w.liveCalls !== undefined,
    campaignIds: [],
    createdAt: Date.parse(w.createdAt) || Date.now(),
  };
}

function detailWireToBuyer(w: BuyerWire): Buyer {
  return {
    ...listWireToBuyer(w),
    description: w.description,
    // Prefer `organization_name` (human-readable) over `organization_id`
    // (uuid). The legacy id-only fallback stays in place for old responses
    // that haven't been updated yet.
    organization: w.organizationName ?? w.organizationId ?? "",
    // `max_concurrency` on the buyer is what routing checks; the cap
    // record's copy is only a fallback for old responses.
    concurrencyCap: w.maxConcurrency ?? w.cap?.concurrency ?? 0,
    concurrencyKnown: w.maxConcurrency !== undefined || w.cap?.concurrency !== undefined,
    dailyCap: w.cap?.daily ?? 0,
    monthlyCap: w.cap?.monthly ?? 0,
    campaignIds: (w.campaigns ?? []).map((c) => c.campaignId),
  };
}

/* ─── Public service ──────────────────────────────────────────────────── */

export const buyersService = {
  async list(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<Buyer>> {
    const res = await http.get<Paginated<BuyerListWire>>("/api/buyers/", { query });
    return {
      ...res,
      items: res.items.map(listWireToBuyer),
    };
  },

  async get(id: string): Promise<Buyer> {
    const wire = await http.get<BuyerWire>(`/api/buyers/${id}`);
    return detailWireToBuyer(wire);
  },

  async create(input: Omit<Buyer, "id" | "createdAt">): Promise<Buyer> {
    // Backend schema for `routing_type` is enum (`external` | `sip`) with a
    // default of `external`. The create dialog doesn't expose a SIP option
    // yet, so we OMIT the field entirely and let the backend default kick
    // in. Previously we sent `routingType: "standard"` which 422'd against
    // the validator. Per backend dev — "if you are not sending it, leave
    // the field out entirely".
    const wire = await http.post<BuyerWire>("/api/buyers/", {
      body: {
        name: input.name,
        description: input.description,
        payoutAmount: String(input.bidAmount ?? 0),
        payoutModel: input.payoutModel ?? "flat",
        maxConcurrency: input.concurrencyCap || undefined,
        contactName: input.contactName,
        // FE `email` ↔ wire `contact_email`. Empty values stay undefined so
        // the backend's "field is optional" path triggers instead of being
        // told to persist an empty string.
        contactEmail: input.email || undefined,
      },
    });
    return detailWireToBuyer(wire);
  },

  async update(id: string, patch: Partial<Buyer>): Promise<Buyer> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.bidAmount !== undefined) body.payoutAmount = String(patch.bidAmount);
    if (patch.payoutModel !== undefined) body.payoutModel = patch.payoutModel;
    if (patch.contactName !== undefined) body.contactName = patch.contactName;
    // FE `email` ↔ wire `contact_email`.
    if (patch.email !== undefined) body.contactEmail = patch.email;
    const wire = await http.patch<BuyerWire>(`/api/buyers/${id}`, { body });
    return detailWireToBuyer(wire);
  },

  /**
   * Set the buyer's CC limit (0 = unlimited) on `Buyer.max_concurrency` -
   * the field the routing engine checks before sending a call to this buyer
   * (`PATCH /api/buyers/{id}`). The Caps endpoint writes `BuyerCap`, which
   * routing does not read, so a limit saved only there never took effect.
   */
  async setConcurrency(id: string, maxConcurrency: number): Promise<number> {
    const wire = await http.patch<BuyerWire>(`/api/buyers/${id}`, { body: { maxConcurrency } });
    return typeof wire?.maxConcurrency === "number" ? wire.maxConcurrency : maxConcurrency;
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/api/buyers/${id}`);
  },

  async setStatus(id: string, status: BuyerStatus): Promise<void> {
    // Backend exposes activate/pause as POST endpoints; everything else
    // routes through update.
    if (status === "active") {
      await http.post(`/api/buyers/${id}/activate`);
      return;
    }
    if (status === "paused") {
      await http.post(`/api/buyers/${id}/pause`);
      return;
    }
    // "capped" / "pending" don't have dedicated endpoints — fall through to
    // a status patch so the server can persist the requested state.
    await http.patch(`/api/buyers/${id}`, { body: { status } });
  },

  async updateCap(
    id: string,
    cap: { daily?: number; monthly?: number; concurrency?: number },
  ): Promise<void> {
    await http.patch(`/api/buyers/${id}/cap`, { body: cap });
  },

  async getStats(id: string): Promise<BuyerStats> {
    return statsWireToStats(await http.get<BuyerStatsWire>(`/api/buyers/${id}/stats`));
  },

  async assignCampaign(id: string, campaignId: string): Promise<void> {
    await http.post(`/api/buyers/${id}/campaigns`, { body: { campaignId } });
  },

  async removeCampaign(id: string, campaignId: string): Promise<void> {
    await http.delete(`/api/buyers/${id}/campaigns/${campaignId}`);
  },

  /* ─── Per-buyer reporting visibility ─────────────────────────────────────
   * Backend persists which reporting columns the buyer's own dashboard
   * surfaces — admin controls the allowlist. Wire shape is a string array
   * of snake_case column keys; FE uses a camelCase boolean record (kept
   * compatible with the publisher-side equivalent). */
  async getReportingConfig(id: string): Promise<string[]> {
    const res = await http.get<{ visibleColumns?: string[] }>(
      `/api/buyers/${id}/reporting-config`,
    );
    return Array.isArray(res.visibleColumns) ? res.visibleColumns : [];
  },

  async setReportingConfig(id: string, visibleColumns: string[]): Promise<void> {
    await http.put(`/api/buyers/${id}/reporting-config`, {
      body: { visibleColumns },
    });
  },
};

/**
 * Phone Numbers + DNI Pools service.
 *
 *   /api/numbers/*       — tracking number CRUD, purchase, search, assignment
 *   /api/dni/pools/*     — number pools used by the rotation engine
 *
 * Returns frontend-shaped `TrackingNumber` and `NumberPool` objects.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";
import type {
  NumberPool,
  NumberStatus,
  NumberType,
  RotationStrategy,
  TrackingNumber,
} from "@/lib/types";

/* ─── Tracking number wire shapes ─────────────────────────────────────── */

interface NumberWire {
  id: string;
  number: string;
  /** Backend may surface the line kind under either `type` (legacy) or
   *  `number_type` (current — `toll_free` / `local` / `international`).
   *  After the case adapter `number_type` arrives as `numberType`. We
   *  accept both and prefer `numberType`. Reading only `type` made every
   *  number from the new backend default to "local" in the UI. */
  type?: string;
  numberType?: string;
  status?: string;
  campaignId?: string;
  campaignName?: string;
  poolId?: string;
  poolName?: string;
  state?: string;
  city?: string;
  /** Backend may surface country as either `country` or `country_code`. */
  country?: string;
  countryCode?: string;
  /** Carrier / vendor (UI labels this "Publisher"). */
  vendor?: string;
  monthlyCost?: string | number;
  callsToday?: number;
  callsMonthly?: number;
  conversionRate?: number;
  /** Concurrent channel allocation. Try several naming conventions. */
  allocatedCapacity?: string | number;
  allocated?: string | number;
  capacity?: string | number;
  /** Renewal date — backend may return ISO string or epoch ms. */
  renewsAt?: string | number;
  renewalDate?: string | number;
  provisionedAt?: string | number;
  lastCallAt?: string | number;
  /** Editable fields surfaced in the row edit dialog. Without these on the
   *  wire shape, wireToNumber would silently drop them and the
   *  response-reconcile pattern would revert every successful save. */
  label?: string | null;
  capEnabled?: boolean;
  dailyCap?: string | number;
  monthlyCap?: string | number;
  concurrencyEnabled?: boolean;
  concurrencyCap?: string | number;
  /* Publisher / payout fields */
  publisherId?: string | null;
  vendorEnabled?: boolean;
  payoutPerCall?: string | number;
  payoutType?: string;
  payoutOn?: string;
  dupeRevenue?: string;
  dupeRevenueDays?: number;
  /* Traffic source */
  trafficSourceEnabled?: boolean;
  trafficSourceId?: string | null;
}

function normalizeNumberStatus(raw?: string): NumberStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paused" || s === "pending" || s === "expired") return s;
  return "active";
}

function normalizeNumberType(raw?: string): NumberType {
  const s = (raw ?? "").toLowerCase();
  if (s === "tollfree" || s === "toll_free" || s === "toll-free") return "tollfree";
  if (s === "international") return "international";
  return "local";
}

function toNum(s: string | number | undefined, fallback = 0): number {
  if (typeof s === "number") return s;
  if (typeof s === "string") {
    const n = Number(s);
    return Number.isFinite(n) ? n : fallback;
  }
  return fallback;
}

function toTs(v: string | number | undefined): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const t = Date.parse(v);
    return Number.isFinite(t) ? t : Date.now();
  }
  return Date.now();
}

function wireToNumber(w: NumberWire): TrackingNumber {
  // Pick whichever allocation/renew key the backend chose to populate.
  const allocatedRaw = w.allocatedCapacity ?? w.allocated ?? w.capacity;
  const renewRaw = w.renewsAt ?? w.renewalDate;
  return {
    id: w.id,
    number: w.number,
    type: normalizeNumberType(w.numberType ?? w.type),
    status: normalizeNumberStatus(w.status),
    campaignId: w.campaignId,
    campaignName: w.campaignName,
    poolId: w.poolId,
    poolName: w.poolName,
    state: w.state,
    city: w.city,
    country: w.country ?? w.countryCode,
    vendor: w.vendor,
    monthlyCost: toNum(w.monthlyCost),
    callsToday: w.callsToday ?? 0,
    callsMonthly: w.callsMonthly ?? 0,
    conversionRate: w.conversionRate ?? 0,
    allocatedCapacity:
      allocatedRaw !== undefined && allocatedRaw !== null ? toNum(allocatedRaw) : undefined,
    renewsAt: renewRaw !== undefined && renewRaw !== null ? toTs(renewRaw) : undefined,
    provisionedAt: toTs(w.provisionedAt),
    lastCallAt: w.lastCallAt !== undefined ? toTs(w.lastCallAt) : undefined,
    // Round-trip the editable fields so a successful PATCH actually changes
    // what the user sees. `label: null` from the backend clears the field.
    label: w.label ?? undefined,
    capEnabled: w.capEnabled,
    dailyCap:
      w.dailyCap !== undefined && w.dailyCap !== null ? toNum(w.dailyCap) : undefined,
    monthlyCap:
      w.monthlyCap !== undefined && w.monthlyCap !== null ? toNum(w.monthlyCap) : undefined,
    concurrencyEnabled: w.concurrencyEnabled,
    concurrencyCap:
      w.concurrencyCap !== undefined && w.concurrencyCap !== null
        ? toNum(w.concurrencyCap)
        : undefined,
    publisherId: w.publisherId ?? undefined,
    vendorEnabled: w.vendorEnabled,
    payoutPerCall:
      w.payoutPerCall !== undefined && w.payoutPerCall !== null
        ? toNum(w.payoutPerCall)
        : undefined,
    payoutType: normalizePayoutType(w.payoutType),
    payoutOn: normalizePayoutOn(w.payoutOn),
    dupeRevenue: normalizeDupeRevenue(w.dupeRevenue),
    dupeRevenueDays: w.dupeRevenueDays,
    trafficSourceEnabled: w.trafficSourceEnabled,
    trafficSourceId: w.trafficSourceId ?? undefined,
  };
}

function normalizePayoutType(raw: string | undefined): TrackingNumber["payoutType"] {
  const s = (raw ?? "").toLowerCase();
  return s === "percentage" ? "percentage" : s === "amount" ? "amount" : undefined;
}

function normalizePayoutOn(raw: string | undefined): TrackingNumber["payoutOn"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "converted" || s === "connected" || s === "length") return s;
  return undefined;
}

function normalizeDupeRevenue(raw: string | undefined): TrackingNumber["dupeRevenue"] {
  const s = (raw ?? "").toLowerCase().replace(/-/g, "");
  if (s === "disabled") return "disabled";
  if (s === "enabled") return "enabled";
  if (s === "timelimit" || s === "time_limit") return "timeLimit";
  return undefined;
}

/* ─── Phone number search result (POST /api/phone-numbers/search) ─────── */

/** Shape returned by the Twilio-backed number search endpoint.
 *  Keys are camelCase because the http layer converts the snake_case response. */
export interface PhoneNumberSearchResult {
  /** E.164 string, e.g. "+18005551001" — pass verbatim to phoneNumberPurchase. */
  phoneNumber: string;
  friendlyName?: string;
  numberType?: string;
  monthlyCost?: number;
  region?: string;
}

/* ─── DNI pool wire shapes ────────────────────────────────────────────── */

interface PoolWire {
  id: string;
  name: string;
  campaignId: string;
  campaignName?: string;
  rotationStrategy?: string;
  numberCount?: number;
  callsToday?: number;
  active?: boolean;
  country?: string;
  closedBrowserDelaySec?: number;
  idleTimeSec?: number;
  autoBuy?: boolean;
  attachedNumberIds?: string[];
  /* Detail-page editable fields — round-tripped now that the backend
   * persists them on /api/dni/pools/{id}. */
  replacementNumber?: string | null;
  phoneNumberFormat?: string;
  vendorEnabled?: boolean;
  vendorId?: string | null;
  trafficSourcesEnabled?: boolean;
  trafficSources?: Array<{
    id: string;
    name: string;
    integration: string;
    events: number;
    conversions: number;
  }>;
}

function normalizeRotation(raw?: string): RotationStrategy {
  const s = (raw ?? "").toLowerCase();
  if (s === "weighted") return "weighted";
  if (s === "priority") return "priority";
  return "round-robin";
}

function normalizePhoneFormat(raw: string | undefined): NumberPool["phoneNumberFormat"] {
  const s = (raw ?? "").toLowerCase();
  if (s === "national") return "national";
  if (s === "international") return "international";
  return s === "e164" || s === "" ? (s === "" ? undefined : "E164") : undefined;
}

function wireToPool(w: PoolWire): NumberPool {
  return {
    id: w.id,
    name: w.name,
    campaignId: w.campaignId,
    campaignName: w.campaignName ?? "",
    rotationStrategy: normalizeRotation(w.rotationStrategy),
    numberCount: w.numberCount ?? (w.attachedNumberIds?.length ?? 0),
    callsToday: w.callsToday ?? 0,
    active: w.active ?? true,
    country: w.country,
    closedBrowserDelaySec: w.closedBrowserDelaySec,
    idleTimeSec: w.idleTimeSec,
    autoBuy: w.autoBuy,
    attachedNumberIds: w.attachedNumberIds,
    // Detail-page fields — round-tripped now that the backend persists them.
    replacementNumber: w.replacementNumber ?? undefined,
    phoneNumberFormat: normalizePhoneFormat(w.phoneNumberFormat),
    vendorEnabled: w.vendorEnabled,
    vendorId: w.vendorId ?? undefined,
    trafficSourcesEnabled: w.trafficSourcesEnabled,
    trafficSources: w.trafficSources,
  };
}

/* ─── Public services ─────────────────────────────────────────────────── */

export const numbersService = {
  async list(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<TrackingNumber>> {
    const res = await http.get<Paginated<NumberWire>>("/api/numbers/", { query });
    return { ...res, items: res.items.map(wireToNumber) };
  },

  async get(id: string): Promise<TrackingNumber> {
    return wireToNumber(await http.get<NumberWire>(`/api/numbers/${id}`));
  },

  async update(id: string, patch: Partial<TrackingNumber>): Promise<TrackingNumber> {
    const body: Record<string, unknown> = {};
    // Use `in` so an explicit `campaignId: undefined` (the detach signal from
    // Campaign → Tracking Numbers) reaches the wire. `!== undefined` would
    // silently drop it and the backend would keep the old campaign link.
    if ("campaignId" in patch) body.campaignId = patch.campaignId ?? null;
    if (patch.status !== undefined) body.status = patch.status;
    if (patch.label !== undefined) body.label = patch.label;
    // Cap fields.
    if (patch.allocatedCapacity !== undefined) body.allocatedCapacity = patch.allocatedCapacity;
    if (patch.capEnabled !== undefined) body.capEnabled = patch.capEnabled;
    if (patch.dailyCap !== undefined) body.dailyCap = patch.dailyCap;
    if (patch.monthlyCap !== undefined) body.monthlyCap = patch.monthlyCap;
    if (patch.concurrencyEnabled !== undefined) body.concurrencyEnabled = patch.concurrencyEnabled;
    if (patch.concurrencyCap !== undefined) body.concurrencyCap = patch.concurrencyCap;
    // Publisher / payout fields. `payoutType`, `payoutOn`, and `dupeRevenue`
    // ship as snake_case on the wire — the http layer's camelToSnake handles
    // the keys; the *values* are FE-side enum strings which the backend
    // accepts as-is (per the dev's confirmation).
    // `publisherId` uses `in` so passing `undefined` clears the FK; backend
    // accepts null for "no publisher" on the foreign-key field.
    if ("publisherId" in patch) body.publisherId = patch.publisherId ?? null;
    if (patch.vendorEnabled !== undefined) body.vendorEnabled = patch.vendorEnabled;
    if (patch.payoutPerCall !== undefined) body.payoutPerCall = patch.payoutPerCall;
    if (patch.payoutType !== undefined) body.payoutType = patch.payoutType;
    if (patch.payoutOn !== undefined) body.payoutOn = patch.payoutOn;
    if (patch.dupeRevenue !== undefined) {
      // FE camelCase `timeLimit` → wire snake_case `time_limit` so the
      // backend enum matches. `disabled` / `enabled` are already snake-safe.
      body.dupeRevenue = patch.dupeRevenue === "timeLimit" ? "time_limit" : patch.dupeRevenue;
    }
    if (patch.dupeRevenueDays !== undefined) body.dupeRevenueDays = patch.dupeRevenueDays;
    // Traffic source.
    if ("trafficSourceId" in patch) body.trafficSourceId = patch.trafficSourceId ?? null;
    if (patch.trafficSourceEnabled !== undefined) body.trafficSourceEnabled = patch.trafficSourceEnabled;
    return wireToNumber(
      await http.patch<NumberWire>(`/api/numbers/${id}`, { body }),
    );
  },

  async release(id: string): Promise<void> {
    await http.delete(`/api/numbers/${id}/release`);
  },

  async search(query: {
    type?: NumberType;
    areaCode?: string;
    country?: string;
  }): Promise<NumberWire[]> {
    return http.post<NumberWire[]>("/api/numbers/search", { body: query });
  },

  async purchase(input: {
    number: string;
    campaignId?: string;
  }): Promise<TrackingNumber> {
    // Backend expects `phone_number` (not `number`). The http layer
    // camelToSnake-s the body, so we pass `phoneNumber` here and it
    // arrives as `phone_number` on the wire.
    return wireToNumber(
      await http.post<NumberWire>("/api/numbers/purchase", {
        body: { phoneNumber: input.number, campaignId: input.campaignId },
      }),
    );
  },

  /**
   * Search available Twilio numbers.
   * Maps to POST /api/phone-numbers/search.
   * The http layer converts camelCase keys → snake_case on the wire, so
   * `numberType` arrives as `number_type`, `countryCode` as `country_code`.
   */
  async phoneNumberSearch(query: {
    numberType: "toll_free" | "local";
    countryCode?: string;
    limit?: number;
    areaCode?: string;
  }): Promise<PhoneNumberSearchResult[]> {
    const body: Record<string, unknown> = {
      numberType: query.numberType,
      countryCode: query.countryCode ?? "US",
      limit: query.limit ?? 5,
    };
    if (query.areaCode) body.areaCode = query.areaCode;
    const res = await http.post<
      PhoneNumberSearchResult[] | { items: PhoneNumberSearchResult[] }
    >("/api/phone-numbers/search", { body });
    return Array.isArray(res) ? res : res.items;
  },

  /**
   * Purchase a specific Twilio number returned by phoneNumberSearch.
   * Maps to POST /api/phone-numbers/purchase.
   * `phoneNumber` must be the exact E.164 string from the search result —
   * never a client-generated value.
   */
  async phoneNumberPurchase(input: {
    phoneNumber: string;
    numberType: "toll_free" | "local";
    campaignId?: string;
  }): Promise<TrackingNumber> {
    return wireToNumber(
      await http.post<NumberWire>("/api/phone-numbers/purchase", {
        body: {
          phoneNumber: input.phoneNumber,
          numberType: input.numberType,
          campaignId: input.campaignId,
        },
      }),
    );
  },

  async importNumber(input: {
    number: string;
    vendor?: string;
    campaignId?: string;
  }): Promise<TrackingNumber> {
    return wireToNumber(
      await http.post<NumberWire>("/api/numbers/import", {
        body: {
          phoneNumber: input.number,
          vendor: input.vendor,
          // Forward campaignId so backends that accept it can attach in
          // one round-trip. Backends that ignore the field stay unaffected;
          // we fall back to /assign in the store for those.
          campaignId: input.campaignId,
        },
      }),
    );
  },

  async assign(id: string, campaignId: string): Promise<void> {
    await http.post(`/api/numbers/${id}/assign`, { body: { campaignId } });
  },
};

export const poolsService = {
  async list(
    query: { page?: number; pageSize?: number } = {},
  ): Promise<Paginated<NumberPool>> {
    const res = await http.get<Paginated<PoolWire>>("/api/dni/pools", { query });
    return { ...res, items: res.items.map(wireToPool) };
  },

  async get(id: string): Promise<NumberPool> {
    return wireToPool(await http.get<PoolWire>(`/api/dni/pools/${id}`));
  },

  async create(input: Omit<NumberPool, "id">): Promise<NumberPool> {
    return wireToPool(
      await http.post<PoolWire>("/api/dni/pools", {
        body: {
          name: input.name,
          campaignId: input.campaignId,
          rotationStrategy: input.rotationStrategy,
          country: input.country,
          closedBrowserDelaySec: input.closedBrowserDelaySec,
          idleTimeSec: input.idleTimeSec,
          autoBuy: input.autoBuy,
        },
      }),
    );
  },

  async update(id: string, patch: Partial<NumberPool>): Promise<NumberPool> {
    return wireToPool(await http.patch<PoolWire>(`/api/dni/pools/${id}`, { body: patch }));
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/api/dni/pools/${id}`);
  },

  async addNumber(poolId: string, numberId: string): Promise<void> {
    await http.post(`/api/dni/pools/${poolId}/numbers`, { body: { numberId } });
  },

  async removeNumber(poolId: string, numberId: string): Promise<void> {
    await http.delete(`/api/dni/pools/${poolId}/numbers/${numberId}`);
  },
};

/**
 * Spam & Fraud Protection service — /api/spam/*.
 * Powers the VoIP Shield, TCPA Shield, and Blocked Numbers surfaces.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";

export interface SpamEntry {
  id: string;
  number: string;
  /** Set when the block belongs to one publisher's numbers only. */
  publisherId?: string;
  reason?: string;
  isActive: boolean;
  expiresAt?: number;
  createdAt: number;
}

export interface SpamReport {
  id: string;
  number: string;
  reportType: string;
  source: string;
  confidence?: number;
  createdAt: number;
}

interface SpamEntryWire {
  id: string;
  /** Canonical wire field is `phone_number` (camelCased here by the http
   *  layer). The legacy `number` alias stays in the type as a fallback for
   *  any older response that hasn't been migrated yet. */
  phoneNumber?: string;
  number?: string;
  publisherId?: string | null;
  reason?: string;
  isActive: boolean;
  expiresAt?: string | null;
  createdAt: string;
}

interface SpamReportWire {
  id: string;
  phoneNumber?: string;
  number?: string;
  reportType: string;
  source: string;
  confidence?: number;
  createdAt: string;
}

function toTs(s: string | null | undefined): number | undefined {
  if (!s) return undefined;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : undefined;
}

function wireToEntry(w: SpamEntryWire): SpamEntry {
  return {
    id: w.id,
    // Prefer the canonical `phone_number` field; fall back to legacy `number`.
    number: w.phoneNumber ?? w.number ?? "",
    publisherId: w.publisherId ?? undefined,
    reason: w.reason,
    isActive: !!w.isActive,
    expiresAt: toTs(w.expiresAt ?? null),
    createdAt: toTs(w.createdAt) ?? Date.now(),
  };
}

function wireToReport(w: SpamReportWire): SpamReport {
  return {
    id: w.id,
    number: w.phoneNumber ?? w.number ?? "",
    reportType: w.reportType,
    source: w.source,
    confidence: w.confidence,
    createdAt: toTs(w.createdAt) ?? Date.now(),
  };
}

/**
 * Normalize a list response that may arrive in one of several conventions:
 *   - `{ items, total, page, page_size }`  (our documented shape)
 *   - `{ results, count, next, previous }` (Django REST Framework default)
 *   - `{ data: [...] }`                    (alternative envelope)
 *   - bare `[...]`                          (no envelope)
 *
 * If the shape is unknown but the payload is non-empty, log a dev-only
 * warning so we can spot a backend rename quickly without trial-and-error.
 */
function extractList<T>(
  raw: unknown,
  endpoint: string,
): { items: T[]; total: number; page: number; pageSize: number } {
  if (Array.isArray(raw)) {
    return { items: raw as T[], total: raw.length, page: 1, pageSize: raw.length };
  }
  if (raw && typeof raw === "object") {
    const o = raw as Record<string, unknown>;
    const items =
      (Array.isArray(o.items) && (o.items as T[])) ||
      (Array.isArray(o.results) && (o.results as T[])) ||
      (Array.isArray(o.data) && (o.data as T[])) ||
      null;
    if (items) {
      return {
        items,
        total: typeof o.total === "number"
          ? o.total
          : typeof o.count === "number"
            ? o.count
            : items.length,
        page: typeof o.page === "number" ? o.page : 1,
        pageSize:
          typeof o.pageSize === "number"
            ? o.pageSize
            : typeof o.pageSize === "string"
              ? Number(o.pageSize)
              : items.length,
      };
    }
  }
  if (process.env.NODE_ENV !== "production") {
    // eslint-disable-next-line no-console
    console.warn(
      `[spamService] ${endpoint} returned an unrecognized list shape:`,
      raw,
    );
  }
  return { items: [], total: 0, page: 1, pageSize: 0 };
}

export const spamService = {
  /* ─── Blacklist ──────────────────────────────────────────────────── */
  /** `publisherId` lists the blocks of that publisher's numbers only; without it the
   *  workspace list comes back (publisher-scoped blocks are left out of it). */
  async listBlacklist(query: { page?: number; pageSize?: number; publisherId?: string } = {}): Promise<Paginated<SpamEntry>> {
    const raw = await http.get<unknown>("/api/spam/blacklist", { query });
    const page = extractList<SpamEntryWire>(raw, "/api/spam/blacklist");
    return { ...page, items: page.items.map(wireToEntry) };
  },
  async getBlacklistEntry(id: string): Promise<SpamEntry> {
    return wireToEntry(await http.get<SpamEntryWire>(`/api/spam/blacklist/${id}`));
  },
  async createBlacklist(input: { number: string; reason?: string; publisherId?: string }): Promise<SpamEntry> {
    // Backend expects `phone_number` (not `number`). The http layer
    // camel-cases this to snake on the wire — pass `phoneNumber` and it
    // arrives as `phone_number`. Previously sending `number` 422'd.
    return wireToEntry(
      await http.post<SpamEntryWire>("/api/spam/blacklist", {
        body: { phoneNumber: input.number, reason: input.reason, publisherId: input.publisherId },
      }),
    );
  },
  async updateBlacklist(id: string, patch: Partial<SpamEntry>): Promise<SpamEntry> {
    const body: Record<string, unknown> = {};
    // `phone_number` is intentionally immutable on the backend — sending it
    // returns 400 (confirmed by the backend dev). We deliberately drop
    // `patch.number` here so accidental callers can't trigger that error.
    if (patch.reason !== undefined) body.reason = patch.reason;
    if (patch.isActive !== undefined) body.isActive = patch.isActive;
    if (patch.expiresAt !== undefined) body.expiresAt = patch.expiresAt;
    return wireToEntry(
      await http.patch<SpamEntryWire>(`/api/spam/blacklist/${id}`, { body }),
    );
  },
  async deactivateBlacklist(id: string): Promise<void> {
    await http.post(`/api/spam/blacklist/${id}/deactivate`);
  },
  async deleteBlacklist(id: string): Promise<void> {
    await http.delete(`/api/spam/blacklist/${id}`);
  },

  /* ─── Whitelist ──────────────────────────────────────────────────── */
  async listWhitelist(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<SpamEntry>> {
    const raw = await http.get<unknown>("/api/spam/whitelist", { query });
    const page = extractList<SpamEntryWire>(raw, "/api/spam/whitelist");
    return { ...page, items: page.items.map(wireToEntry) };
  },
  async getWhitelistEntry(id: string): Promise<SpamEntry> {
    return wireToEntry(await http.get<SpamEntryWire>(`/api/spam/whitelist/${id}`));
  },
  async createWhitelist(input: { number: string; reason?: string }): Promise<SpamEntry> {
    // Same field-rename rule as the blacklist endpoint above.
    return wireToEntry(
      await http.post<SpamEntryWire>("/api/spam/whitelist", {
        body: { phoneNumber: input.number, reason: input.reason },
      }),
    );
  },
  async updateWhitelist(id: string, patch: Partial<SpamEntry>): Promise<SpamEntry> {
    const body: Record<string, unknown> = {};
    // `phone_number` is immutable on the whitelist endpoint too — same rule
    // as blacklist above.
    if (patch.reason !== undefined) body.reason = patch.reason;
    if (patch.isActive !== undefined) body.isActive = patch.isActive;
    if (patch.expiresAt !== undefined) body.expiresAt = patch.expiresAt;
    return wireToEntry(
      await http.patch<SpamEntryWire>(`/api/spam/whitelist/${id}`, { body }),
    );
  },
  async deleteWhitelist(id: string): Promise<void> {
    await http.delete(`/api/spam/whitelist/${id}`);
  },

  /* ─── Spam reports & anonymous-block toggle ──────────────────────── */
  async listReports(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<SpamReport>> {
    const raw = await http.get<unknown>("/api/spam/reports", { query });
    const page = extractList<SpamReportWire>(raw, "/api/spam/reports");
    return { ...page, items: page.items.map(wireToReport) };
  },

  async checkNumber(number: string): Promise<{ isSpam: boolean; confidence?: number; reason?: string }> {
    // Matches the rest of the spam resource: send as `phoneNumber` so the
    // http layer serializes the query param as `phone_number`.
    return http.get(`/api/spam/check`, { query: { phoneNumber: number } });
  },

  async listAnonymousBlocks(): Promise<Array<{ id: string; campaignId: string; isActive: boolean }>> {
    return http.get("/api/spam/anonymous-block");
  },

  async createAnonymousBlock(input: { campaignId: string; isActive?: boolean }) {
    return http.post("/api/spam/anonymous-block", { body: input });
  },

  async updateAnonymousBlock(campaignId: string, patch: { isActive: boolean }) {
    return http.patch(`/api/spam/anonymous-block/${campaignId}`, { body: patch });
  },

  /* ─── Shields (VoIP + TCPA) ─────────────────────────────────────────
   * Backend stores named shield policies with a `shieldType` discriminator,
   * a list of guarded campaign ids, and an active flag. Carrier-block lists
   * piggyback on the policy as a free-form array (frontend uses this for
   * `blockedCarriers`). */
  async listShields(
    query: { shieldType?: ShieldType; page?: number; pageSize?: number } = {},
  ): Promise<Shield[]> {
    const raw = await http.get<unknown>("/api/spam/shields/", { query });
    // Reuse the same tolerant envelope extractor as the blacklist/whitelist
    // list endpoints so DRF `{ results }`, `{ data }`, or bare-array shapes
    // all parse correctly. Previously a non-`{items}` shape made the list
    // render empty after refresh.
    return extractList<ShieldWire>(raw, "/api/spam/shields/").items.map(wireToShield);
  },

  async getShield(id: string): Promise<Shield> {
    return wireToShield(await http.get<ShieldWire>(`/api/spam/shields/${id}/`));
  },

  async createShield(input: {
    name: string;
    shieldType: ShieldType;
    campaignIds?: string[];
    blockedCarriers?: string[];
    isActive?: boolean;
  }): Promise<Shield> {
    return wireToShield(
      await http.post<ShieldWire>("/api/spam/shields/", {
        body: {
          name: input.name,
          shieldType: input.shieldType,
          campaignIds: input.campaignIds ?? [],
          blockedCarriers: input.blockedCarriers ?? [],
          isActive: input.isActive ?? true,
        },
      }),
    );
  },

  /**
   * Partial update via PATCH. The backend dev shipped PATCH support on
   * 2026-06-23; the previous PUT-with-full-object workaround was dropped.
   *
   * Documented PATCH-allowed fields per the dev's message:
   *   `name`, `campaign_ids`, `is_active`
   *
   * We also send `blocked_carriers` here because the dev didn't explicitly
   * call it out and it's the only mechanism we have for managing the VoIP
   * carrier list + TCPA provider meta blob. If a future call hits a 422 on
   * `blocked_carriers`, ping the backend dev to add it to the writable
   * field set or expose a dedicated sub-endpoint.
   */
  async updateShield(id: string, patch: Partial<Shield>): Promise<Shield> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.campaignIds !== undefined) body.campaignIds = patch.campaignIds;
    if (patch.isActive !== undefined) body.isActive = patch.isActive;
    if (patch.blockedCarriers !== undefined) body.blockedCarriers = patch.blockedCarriers;
    return wireToShield(
      await http.patch<ShieldWire>(`/api/spam/shields/${id}/`, { body }),
    );
  },

  async deleteShield(id: string): Promise<void> {
    await http.delete(`/api/spam/shields/${id}/`);
  },
};

/* ─── Shield types ──────────────────────────────────────────────────── */

export type ShieldType = "voip" | "tcpa";

export interface Shield {
  id: string;
  name: string;
  shieldType: ShieldType;
  campaignIds: string[];
  blockedCarriers: string[];
  isActive: boolean;
}

interface ShieldWire {
  id: string;
  name: string;
  shieldType: string;
  campaignIds?: string[];
  blockedCarriers?: string[];
  isActive?: boolean;
}

function normalizeShieldType(raw: string): ShieldType {
  return raw === "tcpa" ? "tcpa" : "voip";
}

function wireToShield(w: ShieldWire): Shield {
  return {
    id: w.id,
    name: w.name,
    shieldType: normalizeShieldType(w.shieldType),
    campaignIds: Array.isArray(w.campaignIds) ? w.campaignIds.map(String) : [],
    blockedCarriers: Array.isArray(w.blockedCarriers) ? w.blockedCarriers.map(String) : [],
    isActive: w.isActive ?? true,
  };
}

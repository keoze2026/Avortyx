/**
 * Publishers service — talks to /api/publishers/*.
 * Mirrors the buyers/campaigns service pattern.
 */

import { http } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/types";
import type { Publisher, PublisherStatus } from "@/lib/types";

/* ─── Wire shapes ─────────────────────────────────────────────────────── */

interface PublisherListWire {
  id: string;
  name: string;
  status: string;
  email: string;
  payoutAmount: string;
  uniqueId: string;
  createdAt: string;
  /** Read-only echo of the workspace the publisher belongs to. Backend
   *  confirmed this field is returned (`organization_name`) and must NOT
   *  be sent in any create/update body. */
  organizationName?: string;
}

interface PublisherWire extends PublisherListWire {
  description?: string;
  phoneNumber?: string;
  /** FK reference (uuid). Read-only — display via `organizationName` above. */
  organizationId?: string;
  createdById?: string | null;
  cap?: { daily?: number; monthly?: number; concurrency?: number } | null;
  campaigns?: Array<{ campaignId: string; campaignName?: string }>;
}

/* ─── Mappers ─────────────────────────────────────────────────────────── */

function normalizeStatus(raw: string | null | undefined): PublisherStatus {
  const s = (raw ?? "").toLowerCase();
  if (s === "paused" || s === "pending") return s;
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

function listWireToPublisher(w: PublisherListWire): Publisher {
  return {
    id: w.id,
    name: w.name,
    // Read-only echo from the backend's `organization_name` field.
    organization: w.organizationName ?? "",
    email: w.email,
    status: normalizeStatus(w.status),
    payoutRate: toNum(w.payoutAmount),
    callsToday: 0,
    callsMonth: 0,
    revenueToday: 0,
    revenueMonth: 0,
    lifetimeRevenue: 0,
    pendingPayout: 0,
    conversionRate: 0,
    numbersAssigned: 0,
    campaignIds: [],
    createdAt: Date.parse(w.createdAt) || Date.now(),
  };
}

function detailWireToPublisher(w: PublisherWire): Publisher {
  return {
    ...listWireToPublisher(w),
    description: w.description,
    // Prefer human-readable name; fall back to the uuid for legacy responses.
    organization: w.organizationName ?? w.organizationId ?? "",
    campaignIds: (w.campaigns ?? []).map((c) => c.campaignId),
  };
}

/* ─── Public service ──────────────────────────────────────────────────── */

export const publishersService = {
  async list(query: { page?: number; pageSize?: number } = {}): Promise<Paginated<Publisher>> {
    const res = await http.get<Paginated<PublisherListWire>>("/api/publishers/", { query });
    return { ...res, items: res.items.map(listWireToPublisher) };
  },

  async get(id: string): Promise<Publisher> {
    const wire = await http.get<PublisherWire>(`/api/publishers/${id}`);
    return detailWireToPublisher(wire);
  },

  async create(input: Omit<Publisher, "id" | "createdAt">): Promise<Publisher> {
    const wire = await http.post<PublisherWire>("/api/publishers/", {
      body: {
        name: input.name,
        description: input.description,
        email: input.email,
        payoutAmount: String(input.payoutRate ?? 0),
      },
    });
    return detailWireToPublisher(wire);
  },

  async update(id: string, patch: Partial<Publisher>): Promise<Publisher> {
    const body: Record<string, unknown> = {};
    if (patch.name !== undefined) body.name = patch.name;
    if (patch.description !== undefined) body.description = patch.description;
    if (patch.email !== undefined) body.email = patch.email;
    if (patch.payoutRate !== undefined) body.payoutAmount = String(patch.payoutRate);
    const wire = await http.patch<PublisherWire>(`/api/publishers/${id}`, { body });
    return detailWireToPublisher(wire);
  },

  async remove(id: string): Promise<void> {
    await http.delete(`/api/publishers/${id}`);
  },

  async setStatus(id: string, status: PublisherStatus): Promise<void> {
    if (status === "active") {
      await http.post(`/api/publishers/${id}/activate`);
      return;
    }
    if (status === "paused") {
      await http.post(`/api/publishers/${id}/pause`);
      return;
    }
    await http.patch(`/api/publishers/${id}`, { body: { status } });
  },

  async updateCap(
    id: string,
    cap: { daily?: number; monthly?: number; concurrency?: number },
  ): Promise<void> {
    await http.patch(`/api/publishers/${id}/cap`, { body: cap });
  },

  async assignCampaign(id: string, campaignId: string): Promise<void> {
    await http.post(`/api/publishers/${id}/campaigns`, { body: { campaignId } });
  },

  async removeCampaign(id: string, campaignId: string): Promise<void> {
    await http.delete(`/api/publishers/${id}/campaigns/${campaignId}`);
  },

  /**
   * Publisher payouts history — backed by GET /api/publishers/{id}/payouts.
   * Returns whatever the backend ships; the caller maps to the frontend's
   * PayoutRecord shape so this service doesn't depend on lib/types.
   */
  async payouts(id: string): Promise<PayoutWire[]> {
    const res = await http.get<{ items?: PayoutWire[] } | PayoutWire[]>(
      `/api/publishers/${id}/payouts`,
    );
    if (Array.isArray(res)) return res;
    return res.items ?? [];
  },

  /**
   * POST /api/publishers/{id}/invite — send the publisher a link to set up
   * their own login.
   *
   * The endpoint has existed and nothing called it. The Members list on the
   * publisher settings tab wrote the invited address to a zustand store backed
   * by localStorage and showed a success toast, so the row read "Invited"
   * forever, no email was ever sent, and the entry did not exist outside the
   * one browser that made it.
   */
  async invite(id: string, email: string): Promise<void> {
    await http.post(`/api/publishers/${id}/invite`, { body: { email } });
  },
};

/** Lightweight wire shape for a payout row; backend may add fields over time. */
export interface PayoutWire {
  id?: string;
  amount: string | number;
  status?: string;
  callsCount?: number;
  period?: string;
  periodStart?: string;
  periodEnd?: string;
  paidAt?: string | null;
  scheduledFor?: string;
  createdAt?: string;
}

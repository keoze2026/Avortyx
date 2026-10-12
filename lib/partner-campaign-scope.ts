/**
 * Which campaigns a PUBLISHER or BUYER login may see: the ones assigned to it.
 *
 * The server's campaign list (GET /api/campaigns) currently returns every
 * campaign in the workspace to every login, so a publisher saw campaign names
 * that were never assigned to it. Until the backend limits that list, the
 * frontend drops the others before anything is shown.
 *
 * NOTE: this only hides them on screen. The full list still reaches the
 * browser, so the real fix is on the backend (see the backend guide).
 *
 * How "assigned" is found, using data the server already limits to the partner:
 *   1. GET /api/publishers/ (or /api/buyers/) returns only the partner's own record
 *   2. GET /api/publishers/{id} (or /api/buyers/{id}) lists its assigned campaigns
 * Admins and employees: no limit (returns null).
 */

import { buyersService } from "@/lib/api/services/buyers.service";
import { publishersService } from "@/lib/api/services/publishers.service";

type PartnerRole = "buyer" | "publisher";

const REFRESH_MS = 5 * 60_000;
let cache: { key: string; at: number; promise: Promise<Set<string>> } | null = null;

async function loadAssigned(role: PartnerRole): Promise<Set<string>> {
  const svc = role === "publisher" ? publishersService : buyersService;
  // A partner login only ever gets its own record back from the list.
  const page = await svc.list({ page: 1, pageSize: 50 });
  const ids = new Set<string>();
  for (const own of page.items) {
    const full = await svc.get(own.id);
    for (const c of full.campaignIds ?? []) if (c) ids.add(String(c));
  }
  return ids;
}

/**
 * The campaign ids this login may see, or null when there is no limit
 * (admin / employee). Cached for a few minutes; a failed lookup is retried
 * next time and, meanwhile, shows nothing rather than everything.
 */
export function allowedCampaignIds(role: string | undefined, userId: string | undefined): Promise<Set<string> | null> {
  if (role !== "buyer" && role !== "publisher") return Promise.resolve(null);
  const key = `${role}:${userId ?? ""}`;
  if (cache && cache.key === key && Date.now() - cache.at < REFRESH_MS) return cache.promise;
  const promise = loadAssigned(role).catch(() => {
    cache = null;
    return new Set<string>();
  });
  cache = { key, at: Date.now(), promise };
  return promise;
}

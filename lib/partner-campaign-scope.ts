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
 *   3. Publishers only: GET /api/numbers/ returns only the publisher's own
 *      tracking numbers, and each number says which campaign it is on. A
 *      publisher that was given TFNs on a campaign (without being added to the
 *      campaign's publisher list) sees that campaign too - this is how the
 *      server itself decides what a publisher may see.
 * Admins and employees: no limit (returns null).
 */

import { buyersService } from "@/lib/api/services/buyers.service";
import { numbersService } from "@/lib/api/services/numbers.service";
import { publishersService } from "@/lib/api/services/publishers.service";

type PartnerRole = "buyer" | "publisher";

const REFRESH_MS = 5 * 60_000;
let cache: { key: string; at: number; promise: Promise<Set<string>> } | null = null;

/** Campaigns that hold at least one of this publisher's own tracking numbers. */
async function campaignsOfOwnNumbers(): Promise<Set<string>> {
  const PAGE_SIZE = 200; // the server's maximum page size
  const ids = new Set<string>();
  for (let page = 1; page <= 50; page++) {
    const res = await numbersService.list({ page, pageSize: PAGE_SIZE });
    for (const n of res.items) if (n.campaignId) ids.add(String(n.campaignId));
    const total = (res as { total?: number }).total;
    if (res.items.length < PAGE_SIZE || (typeof total === "number" && page * PAGE_SIZE >= total)) break;
  }
  return ids;
}

async function loadAssigned(role: PartnerRole): Promise<Set<string>> {
  const svc = role === "publisher" ? publishersService : buyersService;
  const ids = new Set<string>();
  // Both lookups run; one failing must not hide what the other found.
  const [assigned, viaNumbers] = await Promise.allSettled([
    (async () => {
      // A partner login only ever gets its own record back from the list.
      const page = await svc.list({ page: 1, pageSize: 50 });
      const out: string[] = [];
      for (const own of page.items) {
        const full = await svc.get(own.id);
        for (const c of full.campaignIds ?? []) if (c) out.push(String(c));
      }
      return out;
    })(),
    role === "publisher" ? campaignsOfOwnNumbers() : Promise.resolve(new Set<string>()),
  ]);
  if (assigned.status === "fulfilled") assigned.value.forEach((c) => ids.add(c));
  if (viaNumbers.status === "fulfilled") viaNumbers.value.forEach((c) => ids.add(c));
  if (assigned.status === "rejected" && viaNumbers.status === "rejected") throw assigned.reason;
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

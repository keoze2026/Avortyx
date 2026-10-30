/**
 * CH-415 (Sir's Campaign Group design): the Group page's rows, built only from
 * what the server sends - the group's destination lines (priority / weight in
 * each campaign, GET /api/campaign-groups/{id}/destinations) and the real
 * Destination records (live-call limit, caps, on / off) from the Destinations
 * page's own list. Nothing here is a sample or a guess: a figure the server
 * did not send stays empty.
 */

import type { GroupLine } from "@/lib/api/services/campaign-groups.service";
import type { Destination } from "@/lib/types/destination";

export const digits10 = (v: string | null | undefined) => (v ?? "").replace(/\D/g, "").slice(-10);

/** "+18888919621" -> "+1 (888) 891-9621"; anything else as it came. */
export function formatUs(number: string): string {
  const d = number.replace(/\D/g, "");
  const ten = d.length === 11 && d.startsWith("1") ? d.slice(1) : d.length === 10 ? d : "";
  return ten ? `+1 (${ten.slice(0, 3)}) ${ten.slice(3, 6)}-${ten.slice(6)}` : number;
}

export interface GroupRow {
  /** The line's number as the server keys it (E.164). */
  number: string;
  digits: string;
  buyerId: string | null;
  buyerName: string;
  line: GroupLine;
  /** The buyer's Destination record for this number, when there is one. */
  dest: Destination | null;
  priorities: number[];
  weights: number[];
  minPriority: number;
  maxPriority: number;
  /** Not the same priority in every campaign it is in. */
  mixed: boolean;
  /** A priority above 100 - most likely a typo (Sir's "Needs a check"). */
  check: boolean;
  inCount: number;
  ofCount: number;
  /** On / off on the Destinations page; null when there is no record. */
  enabled: boolean | null;
  hasLimits: boolean;
}

/** The buyer's own record for the number: same buyer first, live ones first. */
export function matchDestination(line: GroupLine, destinations: Destination[]): Destination | null {
  const d = digits10(line.number);
  const same = destinations.filter((x) => digits10(x.tfn) === d);
  if (!same.length) return null;
  const mine = line.buyerId ? same.filter((x) => x.buyerId === line.buyerId) : same;
  const pool = mine.length ? mine : line.buyerId ? [] : same;
  return pool.find((x) => x.enabled) ?? pool[0] ?? null;
}

export function buildRows(lines: GroupLine[], destinations: Destination[]): GroupRow[] {
  return lines.map((line) => {
    const dest = matchDestination(line, destinations);
    const priorities = [...line.priorities].sort((a, b) => a - b);
    const weights = [...line.weights].sort((a, b) => a - b);
    const limits = dest
      ? (dest.concurrencyCap ?? 0) > 0 || (dest.hourlyCap ?? 0) > 0 || (dest.dailyCap ?? 0) > 0 || (dest.monthlyCap ?? 0) > 0
      : false;
    return {
      number: line.number,
      digits: digits10(line.number),
      buyerId: line.buyerId,
      buyerName: line.buyerName || dest?.buyerName || "",
      line,
      dest,
      priorities,
      weights,
      minPriority: priorities[0] ?? 1,
      maxPriority: priorities[priorities.length - 1] ?? 1,
      mixed: priorities.length > 1,
      check: priorities.some((p) => p > 100),
      inCount: line.inCount,
      ofCount: line.ofCount,
      enabled: dest ? dest.enabled : null,
      hasLimits: limits,
    };
  });
}

/** Sir: active lines always on top, then by priority, then by buyer. */
export function sortRows(rows: GroupRow[]): GroupRow[] {
  return [...rows].sort((a, b) => {
    const on = Number(b.enabled === true) - Number(a.enabled === true);
    if (on) return on;
    if (a.minPriority !== b.minPriority) return a.minPriority - b.minPriority;
    const n = a.buyerName.localeCompare(b.buyerName, undefined, { numeric: true, sensitivity: "base" });
    return n || a.number.localeCompare(b.number);
  });
}

export type RowFilter = "all" | "mixed" | "notAll" | "limits";

export function filterRows(
  rows: GroupRow[],
  f: { search: string; buyer: string; campaign: string; kind: RowFilter },
): GroupRow[] {
  const q = f.search.trim().toLowerCase();
  const qd = q.replace(/\D/g, "");
  return rows.filter((r) => {
    if (q && !(r.buyerName.toLowerCase().includes(q) || (qd && r.digits.includes(qd)))) return false;
    if (f.buyer !== "all" && r.buyerName !== f.buyer) return false;
    if (f.campaign !== "all" && !r.line.campaigns.some((c) => c.campaignId === f.campaign)) return false;
    if (f.kind === "mixed" && !r.mixed) return false;
    if (f.kind === "notAll" && r.inCount >= r.ofCount) return false;
    if (f.kind === "limits" && !r.hasLimits) return false;
    return true;
  });
}

/**
 * Roughly what share of calls a line would get at this priority and weight
 * when every line is available - the lines already on that priority in this
 * group, each counted once at its weight there.
 */
export function shareAt(rows: GroupRow[], priority: number, weight: number, exceptDigits?: string) {
  let others = 0;
  let total = 0;
  for (const r of rows) {
    if (r.digits === exceptDigits || r.enabled === false) continue;
    const at = r.line.campaigns.find((c) => c.priority === priority);
    if (!at) continue;
    others += 1;
    total += Math.max(0, at.weight);
  }
  const pct = weight > 0 && total + weight > 0 ? Math.round((weight / (total + weight)) * 100) : 0;
  return { others, pct };
}

import type { Call } from "@/lib/types";

/** The outcome buckets surfaced on the Reports page: every clickable total in
 *  the Call Summary's footer row. */
export type CallStatusFilter =
  | "total"
  | "connected"
  | "qualified"
  | "converted"
  | "notConnected"
  | "live"
  | "repeated";

/**
 * Single source of truth for what "Connected", "Qualified" and "Not
 * Connected" mean.
 *
 * Both the Call Summary totals (components/reports/call-summary-table.tsx)
 * and the Reports page's click-to-filter behaviour read from this function —
 * so clicking a total is guaranteed to show exactly the calls that total
 * counted. Keeping the definitions in one place is what makes that guarantee
 * hold; duplicating the same three conditions in two files is how they'd
 * eventually drift apart.
 */
export function matchesCallStatusFilter(call: Call, filter: CallStatusFilter): boolean {
  if (filter === "total") {
    // The Incoming total: every call that came in.
    return true;
  }
  if (filter === "converted") {
    // Same rule the Call Summary counts Converted with: the backend's own
    // verdict when the record carries it, else a paid completed call.
    return call.isConverted ?? (call.status === "completed" && call.payout > 0);
  }
  if (filter === "repeated") {
    // The caller rang this campaign before (CH-230) - the same is_duplicate
    // flag the Repeated count is summed from, on screen and on the server.
    // It fell through to the Not Connected rule below, so clicking Repeated
    // could list nothing.
    return call.isDuplicate === true;
  }
  if (filter === "live") {
    // Calls still going on right now: ringing or talking.
    return call.status === "ringing" || call.status === "in-progress";
  }
  if (filter === "connected") {
    return call.status === "completed" || call.status === "in-progress";
  }
  if (filter === "qualified") {
    // Prefer the backend's own verdict — it's the exact same field
    // `is_qualified=true` filters by server-side, so a call counted here is
    // guaranteed to be one the click-filter's backend request also returns.
    // Only fall back to the duration heuristic for records that don't carry
    // the flag at all (demo-mode fixtures, or a backend response that
    // predates the field) — never let the two silently disagree on a call
    // that does carry it.
    if (call.isQualified != null) return call.isQualified;
    return call.status === "completed" && call.durationSec >= 60;
  }
  return call.status === "missed" || call.status === "rejected" || call.status === "failed";
}
/** The three outcomes the Reports chart and the Total Calls ring show, the
 *  same three Revo shows:
 *    "converted"    - the call converted (blue). Under a destination paid on
 *                     Incoming a missed call converts too, so it is blue.
 *    "notConverted" - answered, but did not convert (yellow).
 *    "noAnswer"     - not answered AND did not convert (red). A missed call
 *                     only turns red when it did not convert.
 *  A record that does not carry the converted verdict (a partner login with
 *  the Converted column switched off) falls back to connected = blue, so the
 *  chart never invents a split it was not told. */
export type ConversionBucket = "converted" | "notConverted" | "noAnswer";

export function conversionBucket(call: Call): ConversionBucket {
  const connected = matchesCallStatusFilter(call, "connected");
  if (call.isConverted == null) return connected ? "converted" : "noAnswer";
  if (call.isConverted) return "converted";
  return connected ? "notConverted" : "noAnswer";
}

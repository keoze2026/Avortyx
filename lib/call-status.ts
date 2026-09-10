import type { Call } from "@/lib/types";

/** The three headline outcome buckets surfaced on the Reports page. */
export type CallStatusFilter = "connected" | "qualified" | "notConnected";

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
  if (filter === "connected") {
    return call.status === "completed" || call.status === "in-progress";
  }
  if (filter === "qualified") {
    return call.status === "completed" && call.durationSec >= 60;
  }
  return call.status === "missed" || call.status === "rejected" || call.status === "failed";
}

/**
 * Backend query params for GET /api/analytics/calls, per the analytics API
 * contract — Connected sends `status=ANSWERED`, Qualified sends
 * `is_qualified=true` (case-adapted automatically from `isQualified`, see
 * lib/api/http.ts). "Not Connected" has no contracted param yet, so the
 * Reports page keeps filtering it client-side with matchesCallStatusFilter()
 * above instead of hitting the backend for it.
 */
export function callStatusFilterToQuery(
  filter: Extract<CallStatusFilter, "connected" | "qualified">,
): { status?: string; isQualified?: boolean } {
  if (filter === "connected") return { status: "ANSWERED" };
  return { isQualified: true };
}

/**
 * A Destination is one TFN (toll-free number) owned by a buyer.
 *
 * A single buyer can have many destinations — e.g. one per product line
 * ("Tier-1 ACA" vs "Tier-1 Medicare") or one per shift. Each destination
 * carries its OWN concurrency cap and daily/monthly caps; CC and Cap are
 * never campaign-level in the Ringba data model. The router picks a
 * destination based on the campaign's buyers and their destinations' caps.
 */

export type DestinationForwardType = "number" | "sip";

export type Weekday = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

export interface BusinessHourSlot {
  id: string;
  days: Weekday[];
  /** "HH:MM" 24-hour. */
  from: string;
  /** "HH:MM" 24-hour. */
  to: string;
}

export interface FilterCondition {
  id: string;
  parameter: string;
  operator: string;
  value: string;
}

/** A filter group — conditions inside a group are OR-ed; groups are AND-ed. */
export interface FilterGroup {
  id: string;
  conditions: FilterCondition[];
}

export interface Destination {
  id: string;
  buyerId: string;
  /** The toll-free number that calls are actually dialed to. */
  tfn: string;
  /** Friendly label, e.g. "Tier-1 ACA Inbound". */
  name: string;
  /** Max simultaneous live calls allowed on this destination. */
  concurrencyCap: number;
  /** Max calls per day. 0 = unlimited. */
  dailyCap: number;
  /** Max calls per month. 0 = unlimited. */
  monthlyCap: number;
  /** When false, the router skips this destination. */
  enabled: boolean;
  /* ─── Advanced settings (optional — populated via the settings tab) ─── */
  /** "number" routes to a TFN, "sip" routes to a SIP endpoint. */
  forwardType?: DestinationForwardType;
  /** Seconds to ring before redirecting / failing over (default 25). */
  ringDurationSec?: number;
  /** When true, the router applies the filter rules below. */
  filterEnabled?: boolean;
  /** AND-of-groups, OR-within-group condition tree. */
  filterGroups?: FilterGroup[];
  /** When true, the router only dials this destination inside the slots. */
  businessHoursEnabled?: boolean;
  businessHourSlots?: BusinessHourSlot[];
  /** Per-destination timezone override (IANA, e.g. "America/New_York"). */
  timezone?: string;

  /* ─── Read-only usage counters, per BACKEND-CONTRACT.md §3.9 ─────────── */
  /** Currently ringing / in-progress calls on this destination. */
  liveCalls: number;
  /** Calls started in the current hour. */
  hourlyCalls: number;
  /** Calls started today. */
  dailyCalls: number;
  /** Calls started this calendar month. */
  monthlyCalls: number;
  /** Lifetime call count. */
  globalCalls: number;
}

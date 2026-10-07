export type NumberStatus = "active" | "paused" | "pending" | "expired";
export type NumberType = "local" | "tollfree" | "international";

export type PayoutType = "amount" | "percentage";
export type PayoutOn = "converted" | "connected" | "length";
export type DupeRevenue = "disabled" | "enabled" | "timeLimit";

export interface TrackingNumber {
  id: string;
  /** E.164 dial-string — e.g. "+15125550123". */
  number: string;
  type: NumberType;
  status: NumberStatus;

  campaignId?: string;
  campaignName?: string;
  poolId?: string;
  poolName?: string;

  state?: string;
  city?: string;
  /** ISO country name or code from the backend. Undefined shows as a dash. */
  country?: string;

  monthlyCost: number;
  callsToday: number;
  callsMonthly: number;
  /** Concurrent calls on this number right now. The backend counts these from
   *  the call log and sends them as `live`. */
  liveCalls?: number;
  /** Calls this hour / over the number's whole life. The backend does not
   *  aggregate either yet, so both are undefined and the columns show a dash
   *  rather than a figure derived from something else. */
  callsHourly?: number;
  callsGlobal?: number;
  conversionRate: number; // 0..1

  /** How many concurrent channels / DIDs the carrier has allocated to this
   *  number. Undefined shows as a dash. */
  allocatedCapacity?: number;
  /** Next rental renewal date (ms epoch). Undefined shows as a dash - this is
   *  a date money moves on and must never be invented. */
  renewsAt?: number;

  /** The carrier actually carrying this number, and its short code. Distinct
   *  from `vendor`, which is where the number was bought: two toll-frees from
   *  different carriers both read `Other` there. */
  carrierId?: string;
  carrierName?: string;
  carrierCode?: string;
  /** When the number was put on a campaign (ms epoch). Undefined shows a dash
   *  — an unassigned number has no such date and inventing one is a lie about
   *  when it started earning. */
  assignedAt?: number;

  provisionedAt: number;
  lastCallAt?: number;

  /* ─── Tracking-number edit dialog fields ────────────────────────────
   * These describe how the publisher (vendor in classic call-tracking
   * lingo — see the campaign settings edit dialog) is compensated and
   * what caps / traffic-source plumbing is wired around the number. */
  /** Optional friendly label shown in the NAME column. */
  label?: string;
  /** Publisher / vendor name powering this tracking number. */
  vendor?: string;
  /** Publisher record id, when one is selected from the publishers store. */
  publisherId?: string;
  /** Name of the linked publisher (backend `publisher_name`). */
  publisherName?: string;
  /** Whether the publisher payout is enabled at all. */
  vendorEnabled?: boolean;
  /** Per-call payout amount (USD) when payoutType === "amount". */
  payoutPerCall?: number;
  payoutType?: PayoutType;
  payoutOn?: PayoutOn;
  /** Duplicate-call revenue handling. */
  dupeRevenue?: DupeRevenue;
  /** Days a duplicate stays unbilled when dupeRevenue === "timeLimit". */
  dupeRevenueDays?: number;

  /** Traffic-source toggle + selected entry. */
  trafficSourceEnabled?: boolean;
  trafficSourceId?: string;

  /** Cap settings. */
  capEnabled?: boolean;
  dailyCap?: number;
  monthlyCap?: number;
  /** Concurrency settings. */
  concurrencyEnabled?: boolean;
  concurrencyCap?: number;
}

export type RotationStrategy = "round-robin" | "weighted" | "priority";

export type PhoneNumberFormat = "E164" | "national" | "international";

export interface TrafficSourceEntry {
  id: string;
  name: string;
  integration: string;
  events: number;
  conversions: number;
}

export interface NumberPool {
  id: string;
  name: string;
  campaignId: string;
  campaignName: string;
  rotationStrategy: RotationStrategy;
  numberCount: number;
  callsToday: number;
  /** Whether new incoming traffic gets assigned a number from this pool. */
  active: boolean;

  /* ── Editable settings (set on the create dialog + detail page) ── */
  country?: string;
  /** Pool reservation timeout after a closed browser, in seconds. */
  closedBrowserDelaySec?: number;
  /** Max idle time a number is held for a user, in seconds. */
  idleTimeSec?: number;
  autoBuy?: boolean;

  /* ── Detail-page-only fields ── */
  /** "Replacement Number" — number to replace with one from the pool. */
  replacementNumber?: string;
  phoneNumberFormat?: PhoneNumberFormat;
  /** Ids of TrackingNumbers attached to this pool. */
  attachedNumberIds?: string[];
  vendorEnabled?: boolean;
  vendorId?: string;
  trafficSourcesEnabled?: boolean;
  trafficSources?: TrafficSourceEntry[];
}
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
  /** Total/average connected call length in seconds, per CH-102's one
   *  definition (connected = completed or in-progress). From the backend. */
  /** "high" when any retirement rule can take the number, else "low". */
  risk?: "low" | "high";
  tclSeconds?: number;
  aclSeconds?: number;
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
  /** When the number stops taking calls (ms epoch), e.g. a 30-day carrier
   *  validity. Undefined = no end date. */
  expiresAt?: number;
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

/** CH-456: how busy a number pool is (server figures). */
export interface PoolStats {
  inUse: number;
  cooling: number;
  free: number;
  peakVisitors7d: number;
  fallbackToday: number;
  callsToday: number;
  cooldownMinutes: number;
  tooSmall: boolean;
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
  /** CH-456: shown when the pool runs out; allowed websites (empty = any). */
  fallbackNumber?: string;
  allowedDomains?: string[];
  /** CH-456: the pool's figures, from the server. */
  stats?: PoolStats;
  vendorEnabled?: boolean;
  vendorId?: string;
  trafficSourcesEnabled?: boolean;
  trafficSources?: TrafficSourceEntry[];
  /** CH-460/461: Sir's number pool design. */
  design?: PoolDesign;
}

/** CH-461: rules a pool applies to calls on its numbers (server defaults). */
export interface PoolProtection {
  maxCallsPerCaller10m: number;
  numberFloodPerMin: number;
  shortCallSec: number;
  shortCallsPerCaller30m: number;
  blockAnonymous: boolean;
  assignPerIp10m: number;
  callGraceSec: number;
  blockHours: number;
}

export type PoolNumberState = "in_use" | "available" | "cooling" | "quarantined";

export interface PoolNumberRow {
  id: string;
  number: string;
  display: string;
  phoneNumberId?: string | null;
  state: PoolNumberState;
  /** The visit's source while in use; the reason while pulled out. */
  shownTo: string;
  heldForSec: number | null;
  callsToday: number;
}

export interface FoundNumber {
  number: string;
  display: string;
  where: string;
  label: string;
}

export interface PoolLander {
  id: string;
  url: string;
  found: FoundNumber[];
  swap: string[];
  scanError: string;
  lastScannedAt: string | null;
  snippetSeenAt: string | null;
}

export interface PoolCall {
  id: number;
  startedAt: string;
  caller: string;
  number: string;
  source: string;
  durationSec: number | null;
  blockedReason: string;
  callLogId: string | null;
}

/** CH-461: what the server sends for the pool page (Sir's design). */
export interface PoolDesign {
  publicKey: string;
  statusLabel: "active" | "attention" | "paused";
  cooldownSeconds: number;
  captureParams: string[];
  protection: PoolProtection;
  impressionsToday: number;
  missesToday: number;
  attributedToday: number;
  numbersQuarantined: number;
  snippetSeenAt: string | null;
  snippetSeenHost: string;
  landersCount: number;
  /* Pool page only (GET /api/dni/pools/{id}). */
  numberRows?: PoolNumberRow[];
  callsBySource?: Array<{ source: string; calls: number }>;
  spam?: {
    repeatCallersBlocked: number;
    silentCallersBlocked: number;
    numbersPulledForFlooding: number;
    complaints: number;
  };
  blockedToday?: number;
  landers?: PoolLander[];
  swapNumbers?: string[];
}
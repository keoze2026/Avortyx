export type CallStatus =
  | "ringing"
  | "in-progress"
  | "completed"
  | "missed"
  | "rejected"
  | "failed";

export interface Call {
  /** Seconds the caller waited before pickup, from the backend. undefined =
   *  never answered (or an older backend); shown as a dash, never invented. */
  ttc?: number | null;
  /** Why the call didn't go through, from the backend (`block_reason`), e.g.
   *  "Duplicate call", "Campaign cap reached". Empty / undefined = no reason. */
  failReason?: string;
  id: string;
  campaignId: string;
  campaignName: string;
  buyerId?: string;
  buyerName?: string;
  publisherId?: string;
  publisherName?: string;
  callerNumber: string;
  /** The number the caller dialled — our tracking number (TFN). */
  calledNumber: string;
  /** Where the call was forwarded to: the buyer's destination. Distinct from
   *  `calledNumber`, and the two were conflated — the Destination tab listed
   *  the TFN that was rung instead of the number the call was sent to. */
  destinationNumber: string;
  startedAt: number;
  durationSec: number;
  status: CallStatus;
  /** The backend's own status word, tidied to lower-case with hyphens —
   *  e.g. "no-answer", "busy", "failed". `status` groups outcomes for totals
   *  and filters (busy and no-answer are both "missed"); this keeps the exact
   *  outcome so screens can label it precisely. */
  statusRaw?: string;
  /** The caller's line type from the backend (`ipqs_line_type`), e.g.
   *  "mobile", "landline", "voip". Undefined when the backend has none. */
  lineType?: string;
  payout: number;
  revenue: number;
  /** Caller geo as the backend resolved it, from the lookup provider.
   *  `zip` and `timezone` arrive alongside country/state/city; any of them is
   *  an empty string or undefined when the provider returned nothing for that
   *  call, which is normal - coverage is partial, not total. */
  geo: { country: string; state?: string; city?: string; zip?: string; timezone?: string };
  /** IPQualityScore fraud score, 0-100. Undefined when the call was never
   *  scored - which is every call until IPQS is switched on. */
  fraudScore?: number;
  recordingUrl?: string;
  /** The backend's own qualification verdict, when it sends one — see
   *  matchesCallStatusFilter() in lib/call-status.ts for how this is used
   *  and what happens when a record doesn't carry it. */
  isQualified?: boolean;
  /** Backend's duplicate-caller verdict (`is_duplicate`), when it sends one.
   *  Counted into the Call Summary "Dupe" column; absent = not counted. */
  isDuplicate?: boolean;
  /** Backend's converted verdict (`is_converted`). When present it decides
   *  the Call Summary's Converted / Paid columns; otherwise
   *  "completed with a payout" is used. */
  isConverted?: boolean;
  /** Backend's spam verdict (`is_spam`). */
  isSpam?: boolean;
  /** Caller's carrier as the backend resolved it ("Verizon", "AT&T", …). */
  carrier?: string;
}

/** Real-time event emitted by the (mock) socket. */
export type CallEvent =
  | { kind: "call:incoming"; call: Call }
  | { kind: "call:progress"; id: string; durationSec: number; status: CallStatus }
  | { kind: "call:completed"; id: string; durationSec: number; payout: number; revenue: number };
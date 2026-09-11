export type CallStatus =
  | "ringing"
  | "in-progress"
  | "completed"
  | "missed"
  | "rejected"
  | "failed";

export interface Call {
  id: string;
  campaignId: string;
  campaignName: string;
  buyerId?: string;
  buyerName?: string;
  publisherId?: string;
  publisherName?: string;
  callerNumber: string;
  destinationNumber: string;
  startedAt: number;
  durationSec: number;
  status: CallStatus;
  payout: number;
  revenue: number;
  geo: { country: string; state?: string; city?: string };
  recordingUrl?: string;
  /** The backend's own qualification verdict, when it sends one — see
   *  matchesCallStatusFilter() in lib/call-status.ts for how this is used
   *  and what happens when a record doesn't carry it. */
  isQualified?: boolean;
}

/** Real-time event emitted by the (mock) socket. */
export type CallEvent =
  | { kind: "call:incoming"; call: Call }
  | { kind: "call:progress"; id: string; durationSec: number; status: CallStatus }
  | { kind: "call:completed"; id: string; durationSec: number; payout: number; revenue: number };

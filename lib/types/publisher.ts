export type PublisherStatus = "active" | "paused" | "pending";

export interface Publisher {
  id: string;
  name: string;
  organization: string;
  email?: string;
  contactName?: string;
  description?: string;
  status: PublisherStatus;

  /** % of buyer payout passed through to this publisher */
  payoutRate: number;

  callsToday: number;
  callsMonth: number;
  revenueToday: number;
  revenueMonth: number;
  lifetimeRevenue: number;

  /** Earned but not yet paid out */
  pendingPayout: number;

  /** 0..1 share of sent calls that convert */
  conversionRate: number;

  numbersAssigned: number;
  campaignIds: string[];
  createdAt: number;
  /** CH-423: its calls as the server counts them (Reports' "Paid" = payable).
   *  Undefined when the server does not send them - never estimated. */
  usage?: PublisherUsage;
}

export interface PublisherUsage {
  /** Payable calls in the last 60 minutes. */
  callsHour: number;
  payableToday: number;
  /** Every call it sent today, and how many the buyer answered. */
  sentToday: number;
  answeredToday: number;
  payableMonth: number;
  payableGlobal: number;
  /** Campaigns its live TFNs send to, and how many TFNs. */
  campaigns: { id: string; name: string }[];
  tfnCount: number;
}

/** CH-423: the Publishers page's own totals, from the server. */
export interface PublishersSummary {
  payableToday: number;
  /** Payable calls per Eastern hour today, 0..23. */
  payableByHour: number[];
  pendingPayouts: number;
  pendingPayoutAmount: number;
}

export type PayoutStatus = "paid" | "pending" | "processing" | "failed";

export interface PayoutRecord {
  id: string;
  publisherId: string;
  amount: number;
  callsCount: number;
  status: PayoutStatus;
  /** Period covered, e.g. "2026-05-01 → 2026-05-15" */
  period: string;
  paidAt?: number;
  scheduledFor: number;
}

export type BuyerStatus = "active" | "paused" | "capped" | "pending";

export type BuyerPayoutModel = "flat" | "tiered";

export interface Buyer {
  id: string;
  name: string;
  organization: string;
  email?: string;
  contactName?: string;
  description?: string;
  status: BuyerStatus;

  bidAmount: number;
  payoutModel: BuyerPayoutModel;

  concurrencyCap: number;
  dailyCap: number;
  monthlyCap: number;

  /* ─── Read-only aggregates the backend computes from the Call table.
   *     Wire family: live_calls, hourly_calls, daily_calls, monthly_calls,
   *     global_calls, hourly_spend, daily_spend, monthly_spend, global_spend.
   *     The FE keeps its older names for the day / month / lifetime figures
   *     (mapped at the service boundary) and adds the rest. ─── */
  callsToday: number;
  callsMonth: number;
  spendToday: number;
  spendMonth: number;
  lifetimeSpend: number;
  /** Currently ringing / in-progress calls on this buyer's destinations. */
  liveCalls: number;
  /** Calls this hour. */
  hourlyCalls: number;
  /** Lifetime call count. */
  globalCalls: number;
  /** Spend (payout) this hour. */
  hourlySpend: number;

  /** 0..1 — share of routed calls accepted */
  acceptRate: number;
  /** 0..1 — share of accepted calls that qualify / pay out */
  conversionRate: number;

  campaignIds: string[];
  createdAt: number;
}
